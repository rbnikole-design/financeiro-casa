import { CreditCard, Revenue, ExpenseRow, FormInstallmentPreview, DEFAULT_SPREADSHEET_ID } from '../types';
import { parseCurrencyInput } from './dateUtils';

const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

interface SheetsApiError {
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

async function fetchWithAuth(
  url: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<any> {
  const headers = {
    ...options.headers,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    const apiError = data as SheetsApiError;
    const msg = apiError?.error?.message || `Erro ${response.status}: ${response.statusText}`;
    throw new Error(msg);
  }

  return data;
}

/**
 * Checks which sheet tabs exist in the spreadsheet.
 */
export async function getSpreadsheetDetails(
  spreadsheetId: string,
  accessToken: string
): Promise<{ title: string; sheetNames: string[] }> {
  const data = await fetchWithAuth(
    `${BASE_URL}/${spreadsheetId}?fields=properties.title,sheets.properties.title`,
    accessToken
  );
  const title = data.properties?.title || 'Planilha';
  const sheetNames = (data.sheets || []).map((s: any) => s.properties?.title as string);
  return { title, sheetNames };
}

/**
 * Converts a 0-based column index to spreadsheet letter (0 -> A, 9 -> J, 10 -> K, 26 -> AA)
 */
export function columnIndexToLetter(colIndex: number): string {
  let letter = '';
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export interface BaseDadosColumnMap {
  month: number;
  purchaseDate: number;
  description: number;
  group: number;
  paymentType: number;
  origin: number;
  installment: number;
  value: number;
  dueDay: number;
  lastInstallment: number;
  paid: number;
  paidColLetter: string;
  totalColumns: number;
}

// Cached detected paid column letter across loads
let detectedPaidColLetter: string = 'J';

/**
 * Dynamically maps headers from "Base de Dados" row 1 to column indices
 */
export function getBaseDadosColumnMap(headerRow: string[] = []): BaseDadosColumnMap {
  let month = -1;
  let purchaseDate = -1;
  let description = -1;
  let group = -1;
  let paymentType = -1;
  let origin = -1;
  let installment = -1;
  let value = -1;
  let dueDay = -1;
  let lastInstallment = -1;
  let paid = -1;

  headerRow.forEach((h, idx) => {
    const colName = String(h || '').trim().toLowerCase();
    
    // Purchase date: "data da compra", "data compra", "dt compra", "data"
    if (
      (colName.includes('data') && colName.includes('compra')) ||
      colName === 'data' ||
      colName.includes('dt. compra') ||
      colName.includes('dt compra')
    ) {
      if (purchaseDate === -1) purchaseDate = idx;
    }
    // Last installment: "última parcela", "ultima parcela"
    else if (colName.includes('última') || colName.includes('ultima')) {
      if (lastInstallment === -1) lastInstallment = idx;
    }
    // Installment: "parcela", "parc"
    else if (colName.includes('parcela') || colName.includes('parc')) {
      if (installment === -1) installment = idx;
    }
    // Due date / day: "vencimento", "venc", "dia venc"
    else if (colName.includes('venc')) {
      if (dueDay === -1) dueDay = idx;
    }
    // Paid status: "pago", "status", "pg"
    else if (colName.includes('pago') || colName === 'status' || colName === 'pg') {
      if (paid === -1) paid = idx;
    }
    // Month / Competência: "mês", "mes", "competência"
    else if (colName === 'mês' || colName === 'mes' || colName.includes('compet')) {
      if (month === -1) month = idx;
    }
    // Description: "descrição", "descricao", "item"
    else if (colName.includes('descri') || colName === 'item') {
      if (description === -1) description = idx;
    }
    // Group / Category: "grupo", "categoria"
    else if (colName.includes('grup') || colName.includes('categor')) {
      if (group === -1) group = idx;
    }
    // Payment type: "tipo pgto", "tipo", "forma pgto"
    else if (colName.includes('tipo') || colName.includes('forma')) {
      if (paymentType === -1) paymentType = idx;
    }
    // Origin / Card: "origem", "titular", "cartão"
    else if (colName.includes('origem') || colName.includes('cart') || colName.includes('titular')) {
      if (origin === -1) origin = idx;
    }
    // Value: "valor"
    else if (colName.includes('valor')) {
      if (value === -1) value = idx;
    }
  });

  // Fallbacks if some headers were not matched by name
  if (month === -1) month = 0;
  if (description === -1) description = headerRow.length > 10 && purchaseDate === 1 ? 2 : 1;
  if (group === -1) group = 2;
  if (paymentType === -1) paymentType = 3;
  if (origin === -1) origin = 4;
  if (installment === -1) installment = 5;
  if (value === -1) value = 6;
  if (dueDay === -1) dueDay = 7;
  if (lastInstallment === -1) lastInstallment = 8;
  if (paid === -1) paid = 9;

  const paidColLetter = columnIndexToLetter(paid >= 0 ? paid : 9);

  return {
    month,
    purchaseDate,
    description,
    group,
    paymentType,
    origin,
    installment,
    value,
    dueDay,
    lastInstallment,
    paid,
    paidColLetter,
    totalColumns: Math.max(headerRow.length, 11),
  };
}

/**
 * Ensures standard tabs and headers exist in the spreadsheet if empty.
 */
export async function ensureSheetStructure(
  spreadsheetId: string,
  accessToken: string
): Promise<void> {
  const { sheetNames } = await getSpreadsheetDetails(spreadsheetId, accessToken);
  
  const requiredSheets: { name: string; headers: string[] }[] = [
    {
      name: 'Base de Dados',
      headers: [
        'Mês',
        'Data da Compra',
        'Descrição',
        'Grupo',
        'Tipo Pgto',
        'Origem',
        'Parcela',
        'Valor',
        'Vencimento',
        'Última Parcela',
        'Pago',
      ],
    },
    {
      name: 'Cartões',
      headers: ['Cartão - Titular', 'Vencimento', 'Fechamento Fatura'],
    },
    {
      name: 'Receitas',
      headers: ['Mês', 'Valor'],
    },
  ];

  // 1. Create missing sheets
  const missingSheets = requiredSheets.filter((rs) => !sheetNames.includes(rs.name));
  if (missingSheets.length > 0) {
    const requests = missingSheets.map((ms) => ({
      addSheet: {
        properties: {
          title: ms.name,
        },
      },
    }));

    await fetchWithAuth(`${BASE_URL}/${spreadsheetId}:batchUpdate`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ requests }),
    });
  }

  // 2. Check and write headers for missing ones
  for (const sheet of requiredSheets) {
    try {
      const headerRes = await fetchWithAuth(
        `${BASE_URL}/${spreadsheetId}/values/'${encodeURIComponent(sheet.name)}'!A1:Z1`,
        accessToken
      );
      if (!headerRes.values || headerRes.values.length === 0 || headerRes.values[0].length === 0) {
        await fetchWithAuth(
          `${BASE_URL}/${spreadsheetId}/values/'${encodeURIComponent(sheet.name)}'!A1:append?valueInputOption=USER_ENTERED`,
          accessToken,
          {
            method: 'POST',
            body: JSON.stringify({
              values: [sheet.headers],
            }),
          }
        );
      } else if (sheet.name === 'Base de Dados') {
        // If Base de Dados already exists, check if 'Data da Compra' exists
        const existingHeaders: string[] = headerRes.values[0] || [];
        const hasPurchaseDate = existingHeaders.some((h) =>
          /data.*compra|compra.*data|^data$/i.test(String(h || '').trim())
        );
        if (!hasPurchaseDate && existingHeaders.length > 0) {
          // Add 'Data da Compra' at the next column header
          const nextCol = columnIndexToLetter(existingHeaders.length);
          await fetchWithAuth(
            `${BASE_URL}/${spreadsheetId}/values/'${encodeURIComponent('Base de Dados')}'!${nextCol}1?valueInputOption=USER_ENTERED`,
            accessToken,
            {
              method: 'PUT',
              body: JSON.stringify({
                values: [['Data da Compra']],
              }),
            }
          );
        }
      }
    } catch (e) {
      console.warn(`Could not verify header for ${sheet.name}:`, e);
    }
  }
}

/**
 * Loads all credit cards from "Cartões" sheet
 */
export async function loadCreditCards(
  spreadsheetId: string,
  accessToken: string
): Promise<CreditCard[]> {
  try {
    const data = await fetchWithAuth(
      `${BASE_URL}/${spreadsheetId}/values/'${encodeURIComponent('Cartões')}'!A1:C`,
      accessToken
    );

    if (!data.values || !Array.isArray(data.values) || data.values.length === 0) {
      return [];
    }

    const firstRow = data.values[0] || [];
    const firstColStr = String(firstRow[0] || '').toLowerCase();
    const secondColStr = String(firstRow[1] || '').toLowerCase();
    const thirdColStr = String(firstRow[2] || '').toLowerCase();

    // Check if row 0 is header
    const isFirstRowHeader =
      firstColStr.includes('cart') ||
      firstColStr.includes('titular') ||
      secondColStr.includes('venc') ||
      secondColStr.includes('fech') ||
      thirdColStr.includes('venc') ||
      thirdColStr.includes('fech') ||
      isNaN(parseInt(String(firstRow[1]), 10));

    let dueColIdx = 1;
    let closingColIdx = 2;

    if (isFirstRowHeader) {
      if (secondColStr.includes('fech') && thirdColStr.includes('venc')) {
        closingColIdx = 1;
        dueColIdx = 2;
      } else if (secondColStr.includes('venc') && thirdColStr.includes('fech')) {
        dueColIdx = 1;
        closingColIdx = 2;
      }
    }

    const startRowIdx = isFirstRowHeader ? 1 : 0;
    const cards: CreditCard[] = [];

    for (let i = startRowIdx; i < data.values.length; i++) {
      const row = data.values[i];
      if (!row || row.length === 0 || !row[0]) continue;
      const name = String(row[0]).trim();
      if (!name) continue;

      let dueVal = parseInt(row[dueColIdx], 10);
      let closingVal = parseInt(row[closingColIdx], 10);

      if (isNaN(dueVal)) dueVal = 10;
      if (isNaN(closingVal)) closingVal = 1;

      cards.push({
        name,
        dueDay: dueVal,
        closingDay: closingVal,
        rowIndex: i + 1, // 1-based row index in sheet
      });
    }

    return cards;
  } catch (error: any) {
    console.error('Error loading credit cards:', error);
    return [];
  }
}

/**
 * Updates a credit card row in the "Cartões" sheet
 */
export async function updateCreditCard(
  spreadsheetId: string,
  accessToken: string,
  rowIndex: number,
  card: CreditCard
): Promise<void> {
  await fetchWithAuth(
    `${BASE_URL}/${spreadsheetId}/values/'${encodeURIComponent('Cartões')}'!A${rowIndex}:C${rowIndex}?valueInputOption=USER_ENTERED`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify({
        values: [[card.name, card.dueDay, card.closingDay]],
      }),
    }
  );
}

/**
 * Clears/removes a credit card row in the "Cartões" sheet
 */
export async function deleteCreditCard(
  spreadsheetId: string,
  accessToken: string,
  rowIndex: number
): Promise<void> {
  await fetchWithAuth(
    `${BASE_URL}/${spreadsheetId}/values/'${encodeURIComponent('Cartões')}'!A${rowIndex}:C${rowIndex}:clear`,
    accessToken,
    {
      method: 'POST',
    }
  );
}

/**
 * Appends a new credit card to "Cartões" sheet
 */
export async function addCreditCard(
  spreadsheetId: string,
  accessToken: string,
  card: CreditCard
): Promise<void> {
  await fetchWithAuth(
    `${BASE_URL}/${spreadsheetId}/values/'${encodeURIComponent('Cartões')}'!A:C:append?valueInputOption=USER_ENTERED`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        values: [[card.name, card.dueDay, card.closingDay]],
      }),
    }
  );
}

/**
 * Loads all monthly revenues from "Receitas" sheet
 */
export async function loadRevenues(
  spreadsheetId: string,
  accessToken: string
): Promise<Revenue[]> {
  try {
    const data = await fetchWithAuth(
      `${BASE_URL}/${spreadsheetId}/values/'${encodeURIComponent('Receitas')}'!A2:B`,
      accessToken
    );

    if (!data.values || !Array.isArray(data.values)) {
      return [];
    }

    const revenues: Revenue[] = [];
    data.values.forEach((row: any[], index: number) => {
      if (!row || row.length === 0 || !row[0]) return;
      const month = String(row[0]).trim();
      const rawVal = row[1];
      const value = typeof rawVal === 'number' ? rawVal : parseCurrencyInput(String(rawVal || 0));
      revenues.push({
        month,
        value,
        rowIndex: index + 2,
      });
    });

    return revenues;
  } catch (error: any) {
    console.error('Error loading revenues:', error);
    return [];
  }
}

/**
 * Loads all expense rows from "Base de Dados" sheet
 */
export async function loadExpenses(
  spreadsheetId: string,
  accessToken: string
): Promise<ExpenseRow[]> {
  try {
    const data = await fetchWithAuth(
      `${BASE_URL}/${spreadsheetId}/values/'${encodeURIComponent('Base de Dados')}'!A1:Z`,
      accessToken
    );

    if (!data.values || !Array.isArray(data.values) || data.values.length === 0) {
      return [];
    }

    const headerRow: string[] = data.values[0] || [];
    const colMap = getBaseDadosColumnMap(headerRow);
    detectedPaidColLetter = colMap.paidColLetter;

    // If 'Data da Compra' is missing from headers, ensure it gets added to row 1
    if (colMap.purchaseDate === -1 && headerRow.length > 0) {
      const nextColLetter = columnIndexToLetter(headerRow.length);
      try {
        await fetchWithAuth(
          `${BASE_URL}/${spreadsheetId}/values/'${encodeURIComponent('Base de Dados')}'!${nextColLetter}1?valueInputOption=USER_ENTERED`,
          accessToken,
          {
            method: 'PUT',
            body: JSON.stringify({
              values: [['Data da Compra']],
            }),
          }
        );
      } catch (err) {
        console.warn('Could not auto-append Data da Compra header:', err);
      }
    }

    const expenses: ExpenseRow[] = [];
    data.values.slice(1).forEach((row: any[], index: number) => {
      if (!row || row.length === 0) return;
      const month = String(row[colMap.month] || '').trim();
      if (!month) return;

      const purchaseDate =
        colMap.purchaseDate !== -1 ? String(row[colMap.purchaseDate] || '').trim() : undefined;
      const description =
        colMap.description !== -1 ? String(row[colMap.description] || '').trim() : '';
      const group =
        colMap.group !== -1 ? String(row[colMap.group] || 'Outros').trim() : 'Outros';
      const paymentType =
        colMap.paymentType !== -1 ? String(row[colMap.paymentType] || 'Outros').trim() : 'Outros';
      const origin =
        colMap.origin !== -1 ? String(row[colMap.origin] || '').trim() : '';
      const installment =
        colMap.installment !== -1 ? String(row[colMap.installment] || '1/1').trim() : '1/1';
      const rawVal = colMap.value !== -1 ? row[colMap.value] : 0;
      const value = typeof rawVal === 'number' ? rawVal : parseCurrencyInput(String(rawVal || 0));
      const dueDay =
        colMap.dueDay !== -1 ? parseInt(String(row[colMap.dueDay] || '1'), 10) || 1 : 1;
      const lastInstallment =
        colMap.lastInstallment !== -1 ? String(row[colMap.lastInstallment] || '').trim() : '';
      const paidStr =
        colMap.paid !== -1 ? String(row[colMap.paid] || '').trim() : '';
      const paid =
        paidStr.toLowerCase() === 'sim' ||
        paidStr.toLowerCase() === 'pago' ||
        paidStr.toLowerCase() === 'true';

      expenses.push({
        rowIndex: index + 2,
        month,
        purchaseDate,
        description,
        group,
        paymentType,
        origin,
        installment,
        value,
        dueDay,
        lastInstallment,
        paid,
      });
    });

    return expenses;
  } catch (error: any) {
    console.error('Error loading expenses:', error);
    return [];
  }
}

/**
 * Appends multiple calculated expense installment rows to "Base de Dados"
 */
export async function appendExpenseInstallments(
  spreadsheetId: string,
  accessToken: string,
  params: {
    description: string;
    group: string;
    paymentType: string;
    origin: string;
    purchaseDate?: string;
    installments: FormInstallmentPreview[];
  }
): Promise<void> {
  const { description, group, paymentType, origin, purchaseDate, installments } = params;

  // 1. Fetch current header row to map columns dynamically
  let colMap: BaseDadosColumnMap;
  try {
    const headerRes = await fetchWithAuth(
      `${BASE_URL}/${spreadsheetId}/values/'${encodeURIComponent('Base de Dados')}'!A1:Z1`,
      accessToken
    );
    const headers: string[] = headerRes.values?.[0] || [];
    if (headers.length === 0) {
      const standardHeaders = [
        'Mês',
        'Data da Compra',
        'Descrição',
        'Grupo',
        'Tipo Pgto',
        'Origem',
        'Parcela',
        'Valor',
        'Vencimento',
        'Última Parcela',
        'Pago',
      ];
      await fetchWithAuth(
        `${BASE_URL}/${spreadsheetId}/values/'${encodeURIComponent('Base de Dados')}'!A1:append?valueInputOption=USER_ENTERED`,
        accessToken,
        {
          method: 'POST',
          body: JSON.stringify({ values: [standardHeaders] }),
        }
      );
      colMap = getBaseDadosColumnMap(standardHeaders);
    } else {
      colMap = getBaseDadosColumnMap(headers);
      if (colMap.purchaseDate === -1) {
        // Append 'Data da Compra' column header to row 1
        const nextCol = columnIndexToLetter(headers.length);
        try {
          await fetchWithAuth(
            `${BASE_URL}/${spreadsheetId}/values/'${encodeURIComponent('Base de Dados')}'!${nextCol}1?valueInputOption=USER_ENTERED`,
            accessToken,
            {
              method: 'PUT',
              body: JSON.stringify({ values: [['Data da Compra']] }),
            }
          );
          colMap.purchaseDate = headers.length;
          colMap.totalColumns = Math.max(colMap.totalColumns, headers.length + 1);
        } catch (e) {
          console.warn('Could not add Data da Compra header:', e);
        }
      }
    }
  } catch (err) {
    console.warn('Fallback to standard column map:', err);
    colMap = getBaseDadosColumnMap([
      'Mês',
      'Data da Compra',
      'Descrição',
      'Grupo',
      'Tipo Pgto',
      'Origem',
      'Parcela',
      'Valor',
      'Vencimento',
      'Última Parcela',
      'Pago',
    ]);
  }

  // 2. Build rows mapped to dynamic column positions
  const numCols = Math.max(colMap.totalColumns, 11);
  const rows = installments.map((inst) => {
    const row = new Array(numCols).fill('');

    if (colMap.month !== -1) row[colMap.month] = inst.month;
    if (colMap.purchaseDate !== -1 && purchaseDate) row[colMap.purchaseDate] = purchaseDate;
    if (colMap.description !== -1) row[colMap.description] = description;
    if (colMap.group !== -1) row[colMap.group] = group;
    if (colMap.paymentType !== -1) row[colMap.paymentType] = paymentType;
    if (colMap.origin !== -1) row[colMap.origin] = origin;
    if (colMap.installment !== -1) row[colMap.installment] = inst.installment;
    if (colMap.value !== -1) row[colMap.value] = inst.value;
    if (colMap.dueDay !== -1) row[colMap.dueDay] = inst.dueDay;
    if (colMap.lastInstallment !== -1) row[colMap.lastInstallment] = inst.isLast ? 'Última Parcela' : '';
    if (colMap.paid !== -1) row[colMap.paid] = '';

    return row;
  });

  await fetchWithAuth(
    `${BASE_URL}/${spreadsheetId}/values/'${encodeURIComponent('Base de Dados')}'!A:Z:append?valueInputOption=USER_ENTERED`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        values: rows,
      }),
    }
  );
}

/**
 * Batch updates the "Pago" status for a list of expense rows in "Base de Dados"
 */
export async function batchUpdatePaidStatus(
  spreadsheetId: string,
  accessToken: string,
  updates: { rowIndex: number; paid: boolean }[],
  paidColLetter?: string
): Promise<void> {
  if (updates.length === 0) return;

  const colLetter = paidColLetter || detectedPaidColLetter || 'J';
  const data = updates.map((u) => ({
    range: `'Base de Dados'!${colLetter}${u.rowIndex}`,
    values: [[u.paid ? 'Sim' : '']],
  }));

  await fetchWithAuth(
    `${BASE_URL}/${spreadsheetId}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data,
      }),
    }
  );
}

/**
 * Adds or updates monthly revenue in "Receitas"
 */
export async function saveRevenue(
  spreadsheetId: string,
  accessToken: string,
  month: string,
  value: number,
  existingRowIndex?: number
): Promise<void> {
  if (existingRowIndex) {
    // Update existing row
    await fetchWithAuth(
      `${BASE_URL}/${spreadsheetId}/values/'${encodeURIComponent('Receitas')}'!A${existingRowIndex}:B${existingRowIndex}?valueInputOption=USER_ENTERED`,
      accessToken,
      {
        method: 'PUT',
        body: JSON.stringify({
          values: [[month, value]],
        }),
      }
    );
  } else {
    // Append new row
    await fetchWithAuth(
      `${BASE_URL}/${spreadsheetId}/values/'${encodeURIComponent('Receitas')}'!A:B:append?valueInputOption=USER_ENTERED`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          values: [[month, value]],
        }),
      }
    );
  }
}
