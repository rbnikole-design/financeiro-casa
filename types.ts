export type PaymentType = 'Cartão de Crédito' | 'Outros';

export type ExpenseNature = 'Fixo' | 'Variável';

export interface CreditCard {
  name: string; // "Cartão - Titular"
  dueDay: number; // "Vencimento"
  closingDay: number; // "Fechamento Fatura"
  rowIndex?: number;
}

export interface Revenue {
  month: string; // "MM/AAAA"
  value: number;
  rowIndex?: number;
}

export interface ExpenseRow {
  rowIndex: number; // Row index in "Base de Dados" sheet (2-indexed, e.g. 2 for A2:J2)
  month: string; // "MM/AAAA"
  purchaseDate?: string; // "DD/MM/AAAA" (Data da Compra)
  description: string;
  group: string;
  paymentType: string;
  origin: string;
  installment: string; // "N/M"
  value: number;
  dueDay: number;
  lastInstallment: string; // "Última Parcela" or ""
  paid: boolean; // true if "Sim", false otherwise
}

export interface FormInstallmentPreview {
  month: string;
  installment: string;
  value: number;
  dueDay: number;
  isLast: boolean;
}

export interface OriginDueSummary {
  origin: string;
  paymentType: string;
  dueDay: number;
  totalValue: number;
  count: number;
  allPaid: boolean;
  somePaid: boolean;
  expenseRows: ExpenseRow[];
  dueStatus: {
    label: string;
    variant: 'today' | 'upcoming' | 'normal' | 'paid';
  };
}

export interface InstallmentPurchase {
  id: string;
  description: string;
  group: string;
  origin: string;
  paymentType: string;
  purchaseDate?: string;
  totalInstallments: number;
  currentInstallment: number;
  installmentValue: number;
  totalPurchaseValue: number;
  paidInstallmentsCount: number;
  remainingInstallmentsCount: number;
  remainingValue: number;
  firstMonth: string;
  lastMonth: string;
  isFinished: boolean;
  dueDay: number;
  rows: ExpenseRow[];
}

export const GROUPS = [
  'Alimentação',
  'Anthony',
  'Assinatura',
  'Carro',
  'Casa',
  'Conta Terceiros',
  'Ifood/Restaurante',
  'Lazer',
  'Pessoal Henrique',
  'Pessoal Nikole',
  'Pet',
  'Presente Terceiros',
  'Saúde',
  'Taxas',
  'Transporte',
  'Viagem',
  'Outros',
] as const;

export const FIXED_ORIGINS = [
  'Aluguel',
  'Condomínio',
  'Energia Elétrica',
  'Escola Anthony',
  'Internet',
  'Havan',
  'Renner',
  'Terceiros [Nicholas]',
  'Terceiros [Eliane]',
  'Empréstimo',
  'Outros',
] as const;

export const DEFAULT_SPREADSHEET_ID = '1Ln8klukENMrV8eVvxRpJYQmeuNjCPWD51M6IU4uKsdU';
