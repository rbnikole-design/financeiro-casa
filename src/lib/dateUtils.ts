import { FormInstallmentPreview } from '../types';

/**
 * Parses "YYYY-MM-DD" safely without timezone offset issues.
 */
export function parseISODate(dateStr: string): { year: number; month: number; day: number } {
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    };
  }
  return {
    year: parseInt(parts[0], 10),
    month: parseInt(parts[1], 10),
    day: parseInt(parts[2], 10),
  };
}

/**
 * Formats a year and month (1-12) to "MM/AAAA"
 */
export function formatMonthYear(year: number, month: number): string {
  const mm = String(month).padStart(2, '0');
  const aaaa = String(year);
  return `${mm}/${aaaa}`;
}

/**
 * Parses "MM/AAAA" into year and month (1-12)
 */
export function parseMonthYear(monthYearStr: string): { year: number; month: number } {
  if (!monthYearStr || !monthYearStr.includes('/')) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  const [mm, aaaa] = monthYearStr.split('/');
  const month = parseInt(mm, 10) || 1;
  const year = parseInt(aaaa, 10) || new Date().getFullYear();
  return { year, month };
}

/**
 * Adds months to a given year and month (1-12)
 */
export function addMonths(startYear: number, startMonth: number, monthsToAdd: number): { year: number; month: number } {
  const totalMonths = startMonth - 1 + monthsToAdd;
  const yearOffset = Math.floor(totalMonths / 12);
  const resultMonth = (totalMonths % 12 + 12) % 12 + 1;
  const resultYear = startYear + yearOffset;
  return { year: resultYear, month: resultMonth };
}

/**
 * Formats a number to Brazilian Real string (e.g. "R$ 1.234,56")
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'R$ 0,00';
  }
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Parses a Brazilian Real input or raw string into a number
 */
export function parseCurrencyInput(value: string | number): number {
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  if (!value) return 0;

  // Clean characters except numbers, comma, and dot
  const clean = value.replace(/[^\d,.-]/g, '');
  if (clean.includes(',')) {
    // Brazilian format 1.234,56 -> 1234.56
    const withoutThousands = clean.replace(/\./g, '');
    const withDotDecimal = withoutThousands.replace(',', '.');
    const num = parseFloat(withDotDecimal);
    return isNaN(num) ? 0 : num;
  }
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

/**
 * Calculates the first invoice month for a Credit Card purchase according to Brazilian banking standards:
 * - D >= F: If purchase day D is on or after closing day F, that invoice is already closed,
 *   so the purchase enters the invoice that closes in the NEXT month (month + 1).
 * - D < F: The purchase occurred strictly before closing day F, so it closes in THIS month.
 * - If due day V <= F (e.g. Closes 25, Vence 05): The invoice that closes in month C has its due date in month C + 1.
 * - If due day V > F (e.g. Closes 10, Vence 17): The invoice that closes in month C has its due date in month C.
 */
export function calculateCreditCardFirstMonth(
  purchaseDateISO: string,
  closingDay: number,
  dueDay: number
): { monthStr: string; year: number; month: number } {
  const { year, month, day: D } = parseISODate(purchaseDateISO);
  const F = Math.max(1, Math.min(31, closingDay || 1));
  const V = Math.max(1, Math.min(31, dueDay || 10));

  // 1. Has the invoice for the purchase month already closed?
  // Any purchase on or after closing day (D >= F) goes to next month's closing
  const closesNextMonth = D >= F;
  const closingMonthOffset = closesNextMonth ? 1 : 0;

  // 2. Is the due date in the same month as the closing, or the subsequent month?
  const dueMonthOffsetFromClosing = V > F ? 0 : 1;

  const totalOffset = closingMonthOffset + dueMonthOffsetFromClosing;
  const target = addMonths(year, month, totalOffset);
  return {
    monthStr: formatMonthYear(target.year, target.month),
    year: target.year,
    month: target.month,
  };
}

/**
 * Calculates the first competence month for "Outros pagamentos"
 * The competence month is simply the month of the provided due date.
 */
export function calculateOtherPaymentsFirstMonth(
  dueDateISO: string
): { monthStr: string; year: number; month: number; dueDay: number } {
  const { year, month, day: D } = parseISODate(dueDateISO);
  return {
    monthStr: formatMonthYear(year, month),
    year,
    month,
    dueDay: D,
  };
}

/**
 * Generates the list of installment rows to be saved
 */
export function generateInstallmentRows(params: {
  paymentType: 'Cartão de Crédito' | 'Outros';
  dateISO: string; // Purchase date for Card, Due date for Outros
  expenseNature: 'Fixo' | 'Variável';
  totalValue: number;
  numMonths: number;
  cardClosingDay?: number;
  cardDueDay?: number;
  customDueDay?: number;
  customStartMonth?: string; // Optional manual override "MM/AAAA"
}): FormInstallmentPreview[] {
  const {
    paymentType,
    dateISO,
    expenseNature,
    totalValue,
    numMonths,
    cardClosingDay = 1,
    cardDueDay = 10,
    customDueDay,
    customStartMonth,
  } = params;

  const validNumMonths = Math.max(1, Math.floor(numMonths || 1));
  const installmentValue =
    expenseNature === 'Variável'
      ? parseFloat((totalValue / validNumMonths).toFixed(2))
      : totalValue;

  let startYear: number;
  let startMonth: number;
  let dueDay: number;

  if (customStartMonth && customStartMonth.includes('/')) {
    const parsed = parseMonthYear(customStartMonth);
    startYear = parsed.year;
    startMonth = parsed.month;
    dueDay = paymentType === 'Cartão de Crédito' ? cardDueDay : (customDueDay ?? 10);
  } else if (paymentType === 'Cartão de Crédito') {
    const firstMonthInfo = calculateCreditCardFirstMonth(dateISO, cardClosingDay, cardDueDay);
    startYear = firstMonthInfo.year;
    startMonth = firstMonthInfo.month;
    dueDay = cardDueDay;
  } else {
    const firstMonthInfo = calculateOtherPaymentsFirstMonth(dateISO);
    startYear = firstMonthInfo.year;
    startMonth = firstMonthInfo.month;
    dueDay = customDueDay !== undefined ? customDueDay : firstMonthInfo.dueDay;
  }

  const items: FormInstallmentPreview[] = [];
  for (let i = 1; i <= validNumMonths; i++) {
    const curMonthInfo = addMonths(startYear, startMonth, i - 1);
    const monthStr = formatMonthYear(curMonthInfo.year, curMonthInfo.month);
    const isLast = i === validNumMonths;

    items.push({
      month: monthStr,
      installment: `${i}/${validNumMonths}`,
      value: installmentValue,
      dueDay,
      isLast,
    });
  }

  return items;
}

/**
 * Returns a numerical sort value for "MM/AAAA" strings (e.g. "08/2026" -> 202608)
 */
export function getMonthSortValue(monthYearStr: string): number {
  const { year, month } = parseMonthYear(monthYearStr);
  return year * 100 + month;
}

/**
 * Calculates due status for display in "Vencimentos" section
 */
export function calculateDueStatus(
  dueDay: number,
  selectedMonthStr: string,
  allPaid: boolean
): { label: string; variant: 'today' | 'upcoming' | 'normal' | 'paid' } {
  if (allPaid) {
    return { label: 'Pago', variant: 'paid' };
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  const { year: selYear, month: selMonth } = parseMonthYear(selectedMonthStr);

  const isCurrentMonth = selYear === currentYear && selMonth === currentMonth;

  if (isCurrentMonth) {
    if (dueDay === currentDay) {
      return { label: 'Vence hoje', variant: 'today' };
    }
    if (dueDay > currentDay && dueDay - currentDay <= 5) {
      const diff = dueDay - currentDay;
      return {
        label: `Vence em ${diff} ${diff === 1 ? 'dia' : 'dias'}`,
        variant: 'upcoming',
      };
    }
  }

  return { label: `Vence dia ${dueDay}`, variant: 'normal' };
}

/**
 * Formats a Date object to "YYYY-MM-DD" for HTML input[type="date"]
 */
export function toISODateInput(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converts ISO "YYYY-MM-DD" to Brazilian format "DD/MM/AAAA"
 */
export function formatToBrazilianDate(isoDateStr: string): string {
  if (!isoDateStr) return '';
  if (isoDateStr.includes('/')) return isoDateStr;
  const parts = isoDateStr.split('-');
  if (parts.length === 3) {
    const [yyyy, mm, dd] = parts;
    return `${dd.padStart(2, '0')}/${mm.padStart(2, '0')}/${yyyy}`;
  }
  return isoDateStr;
}

/**
 * Converts Brazilian format "DD/MM/AAAA" to ISO "YYYY-MM-DD"
 */
export function formatToISODate(brazilianDateStr: string): string {
  if (!brazilianDateStr) return '';
  if (brazilianDateStr.includes('-')) return brazilianDateStr;
  const parts = brazilianDateStr.split('/');
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  return brazilianDateStr;
}
