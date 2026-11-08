import { ExpenseRow, InstallmentPurchase } from '../types';
import { parseMonthYear, formatMonthYear, addMonths, getMonthSortValue } from './dateUtils';

/**
 * Parses an installment string like "3/10" or "03 / 10" into { current: 3, total: 10 }
 */
export function parseInstallmentString(installmentStr?: string): { current: number; total: number } | null {
  if (!installmentStr) return null;
  const match = installmentStr.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return null;

  const current = parseInt(match[1], 10);
  const total = parseInt(match[2], 10);

  if (isNaN(current) || isNaN(total) || total <= 0) return null;
  return { current, total };
}

/**
 * Groups all expense rows into unified InstallmentPurchase items
 */
export function groupInstallmentPurchases(
  expenses: ExpenseRow[],
  referenceMonth?: string
): InstallmentPurchase[] {
  const groupsMap = new Map<string, { rows: ExpenseRow[]; totalInst: number }>();

  // 1. Identify all installment rows (total > 1)
  expenses.forEach((row) => {
    const parsed = parseInstallmentString(row.installment);
    if (!parsed || parsed.total <= 1) return;

    // Grouping key: Normalized description + Origin + totalInstallments + (purchaseDate or rounded value)
    const normDesc = (row.description || '').trim().toLowerCase();
    const normOrigin = (row.origin || '').trim().toLowerCase();
    const pDate = row.purchaseDate ? row.purchaseDate.trim() : '';
    const roundedVal = Math.round((row.value || 0) * 10) / 10;

    const groupKey = `${normDesc}::${normOrigin}::${parsed.total}::${pDate || roundedVal}`;

    const existing = groupsMap.get(groupKey);
    if (existing) {
      existing.rows.push(row);
    } else {
      groupsMap.set(groupKey, { rows: [row], totalInst: parsed.total });
    }
  });

  const referenceSort = referenceMonth ? getMonthSortValue(referenceMonth) : getMonthSortValue(formatMonthYear(new Date().getFullYear(), new Date().getMonth() + 1));

  const result: InstallmentPurchase[] = [];

  // 2. Build detailed InstallmentPurchase objects
  groupsMap.forEach(({ rows, totalInst }, key) => {
    // Sort rows by parsed current installment
    rows.sort((a, b) => {
      const pa = parseInstallmentString(a.installment)?.current || 0;
      const pb = parseInstallmentString(b.installment)?.current || 0;
      return pa - pb;
    });

    const representative = rows[0];
    const maxRow = rows[rows.length - 1];

    const parsedMin = parseInstallmentString(representative.installment);
    const parsedMax = parseInstallmentString(maxRow.installment);

    const minCurr = parsedMin?.current || 1;
    const maxCurr = parsedMax?.current || totalInst;

    // Determine installment value
    const installmentValue = representative.value || (rows.reduce((sum, r) => sum + r.value, 0) / rows.length);
    const totalPurchaseValue = installmentValue * totalInst;

    // Find row in reference month, if any
    const rowInRefMonth = referenceMonth ? rows.find((r) => r.month === referenceMonth) : undefined;
    let currentInstallment = 1;

    if (rowInRefMonth) {
      currentInstallment = parseInstallmentString(rowInRefMonth.installment)?.current || 1;
    } else {
      // Find row with month closest to reference month or fallback to latest row
      let closestRow = rows[0];
      let minDiff = Infinity;
      rows.forEach((r) => {
        const diff = Math.abs(getMonthSortValue(r.month) - referenceSort);
        if (diff < minDiff) {
          minDiff = diff;
          closestRow = r;
        }
      });
      const parsedClosest = parseInstallmentString(closestRow.installment);
      currentInstallment = parsedClosest?.current || maxCurr;
    }

    // Determine first and last competence months
    let firstMonth = representative.month;
    let lastMonth = maxRow.month;

    // If rows don't cover all installments, extrapolate mathematically
    if (representative.month && parsedMin) {
      const { year, month } = parseMonthYear(representative.month);
      const startInfo = addMonths(year, month, -(parsedMin.current - 1));
      firstMonth = formatMonthYear(startInfo.year, startInfo.month);

      const endInfo = addMonths(startInfo.year, startInfo.month, totalInst - 1);
      lastMonth = formatMonthYear(endInfo.year, endInfo.month);
    }

    // Count paid installments:
    // Rows explicitly marked paid, or installments whose month sort value is strictly before reference month and marked paid
    const explicitlyPaidRowsCount = rows.filter((r) => r.paid).length;
    // Estimated paid count: at least the explicitly marked ones
    const paidInstallmentsCount = Math.min(totalInst, explicitlyPaidRowsCount);

    // Remaining calculations
    // How many installments remain after the current reference month?
    const lastMonthSort = getMonthSortValue(lastMonth);
    const isFinished = lastMonthSort < referenceSort || paidInstallmentsCount >= totalInst;

    const remainingInstallmentsCount = isFinished ? 0 : Math.max(0, totalInst - paidInstallmentsCount);
    const remainingValue = remainingInstallmentsCount * installmentValue;

    result.push({
      id: key,
      description: representative.description,
      group: representative.group,
      origin: representative.origin,
      paymentType: representative.paymentType,
      purchaseDate: representative.purchaseDate || undefined,
      totalInstallments: totalInst,
      currentInstallment,
      installmentValue,
      totalPurchaseValue,
      paidInstallmentsCount,
      remainingInstallmentsCount,
      remainingValue,
      firstMonth,
      lastMonth,
      isFinished,
      dueDay: representative.dueDay || 10,
      rows,
    });
  });

  // Sort by active first (unfinished), then highest remaining value descending
  result.sort((a, b) => {
    if (a.isFinished !== b.isFinished) return a.isFinished ? 1 : -1;
    return b.remainingValue - a.remainingValue;
  });

  return result;
}

export interface MonthInstallmentProjection {
  month: string; // "MM/AAAA"
  year: number;
  monthNum: number;
  totalCommitted: number;
  activePurchasesCount: number;
  purchases: {
    description: string;
    origin: string;
    group: string;
    installmentText: string;
    installmentNumber: number;
    totalInstallments: number;
    value: number;
    paid: boolean;
  }[];
}

/**
 * Projects monthly installment commitments across a future window (e.g. 12 months)
 */
export function calculateMonthlyInstallmentProjection(
  purchases: InstallmentPurchase[],
  startMonthStr: string,
  monthsCount: number = 12
): MonthInstallmentProjection[] {
  const { year: startY, month: startM } = parseMonthYear(startMonthStr);
  const projections: MonthInstallmentProjection[] = [];

  for (let offset = 0; offset < monthsCount; offset++) {
    const curMonthInfo = addMonths(startY, startM, offset);
    const curMonthStr = formatMonthYear(curMonthInfo.year, curMonthInfo.month);
    const curSort = getMonthSortValue(curMonthStr);

    let totalCommitted = 0;
    const activePurchases: MonthInstallmentProjection['purchases'] = [];

    purchases.forEach((p) => {
      // Check if purchase has an explicit row for this month
      const rowForMonth = p.rows.find((r) => r.month === curMonthStr);

      if (rowForMonth) {
        const parsed = parseInstallmentString(rowForMonth.installment);
        totalCommitted += rowForMonth.value;
        activePurchases.push({
          description: p.description,
          origin: p.origin,
          group: p.group,
          installmentText: rowForMonth.installment,
          installmentNumber: parsed?.current || 1,
          totalInstallments: p.totalInstallments,
          value: rowForMonth.value,
          paid: rowForMonth.paid,
        });
      } else {
        // Extrapolate if this month falls between firstMonth and lastMonth
        const firstSort = getMonthSortValue(p.firstMonth);
        const lastSort = getMonthSortValue(p.lastMonth);

        if (curSort >= firstSort && curSort <= lastSort) {
          // Calculate which installment number falls on this month
          const { year: fY, month: fM } = parseMonthYear(p.firstMonth);
          const monthDiff = (curMonthInfo.year - fY) * 12 + (curMonthInfo.month - fM);
          const instNum = monthDiff + 1;

          if (instNum >= 1 && instNum <= p.totalInstallments) {
            totalCommitted += p.installmentValue;
            activePurchases.push({
              description: p.description,
              origin: p.origin,
              group: p.group,
              installmentText: `${instNum}/${p.totalInstallments}`,
              installmentNumber: instNum,
              totalInstallments: p.totalInstallments,
              value: p.installmentValue,
              paid: false,
            });
          }
        }
      }
    });

    projections.push({
      month: curMonthStr,
      year: curMonthInfo.year,
      monthNum: curMonthInfo.month,
      totalCommitted,
      activePurchasesCount: activePurchases.length,
      purchases: activePurchases.sort((a, b) => b.value - a.value),
    });
  }

  return projections;
}
