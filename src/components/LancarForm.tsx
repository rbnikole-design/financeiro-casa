import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  ExpenseNature,
  PaymentType,
  GROUPS,
  FIXED_ORIGINS,
  FormInstallmentPreview,
} from '../types';
import {
  generateInstallmentRows,
  formatCurrency,
  toISODateInput,
  parseISODate,
  calculateCreditCardFirstMonth,
  parseMonthYear,
  addMonths,
  formatMonthYear,
  formatToBrazilianDate,
} from '../lib/dateUtils';
import {
  CreditCard as CardIcon,
  Receipt,
  Calendar,
  Layers,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Info,
} from 'lucide-react';

interface LancarFormProps {
  creditCards: CreditCard[];
  onSave: (data: {
    description: string;
    group: string;
    paymentType: PaymentType;
    origin: string;
    purchaseDate?: string;
    installments: FormInstallmentPreview[];
  }) => Promise<void>;
  isSaving: boolean;
  onOpenCardsManager: () => void;
}

export const LancarForm: React.FC<LancarFormProps> = ({
  creditCards,
  onSave,
  isSaving,
  onOpenCardsManager,
}) => {
  // Form State
  const [paymentType, setPaymentType] = useState<PaymentType>('Cartão de Crédito');
  const [purchaseDate, setPurchaseDate] = useState<string>(toISODateInput());
  const [dueDate, setDueDate] = useState<string>(toISODateInput());
  const [description, setDescription] = useState<string>('');
  const [group, setGroup] = useState<string>(GROUPS[0]);
  const [selectedCardName, setSelectedCardName] = useState<string>('');
  const [selectedOrigin, setSelectedOrigin] = useState<string>(FIXED_ORIGINS[0]);
  const [expenseNature, setExpenseNature] = useState<ExpenseNature>('Variável');
  const [rawValueStr, setRawValueStr] = useState<string>('');
  const [numMonths, setNumMonths] = useState<number>(1);
  const [customInvoiceMonth, setCustomInvoiceMonth] = useState<string>('');
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Auto-select first card when creditCards are loaded or change
  React.useEffect(() => {
    if (creditCards.length > 0 && !selectedCardName) {
      setSelectedCardName(creditCards[0].name);
    }
  }, [creditCards, selectedCardName]);

  // Find chosen card
  const selectedCard = useMemo(() => {
    return creditCards.find((c) => c.name === selectedCardName) || creditCards[0];
  }, [creditCards, selectedCardName]);

  // Auto-calculated first invoice month for selected card & purchase date
  const autoFirstInvoiceMonth = useMemo(() => {
    if (paymentType !== 'Cartão de Crédito') return '';
    const cardF = selectedCard?.closingDay || 1;
    const cardV = selectedCard?.dueDay || 10;
    return calculateCreditCardFirstMonth(purchaseDate, cardF, cardV).monthStr;
  }, [paymentType, purchaseDate, selectedCard]);

  const activeFirstInvoiceMonth = customInvoiceMonth || autoFirstInvoiceMonth;

  // Options for month selector around active month (-2 to +5 months)
  const monthOptions = useMemo(() => {
    if (!autoFirstInvoiceMonth) return [];
    const { year, month } = parseMonthYear(autoFirstInvoiceMonth);
    const options: string[] = [];
    for (let offset = -2; offset <= 5; offset++) {
      const m = addMonths(year, month, offset);
      options.push(formatMonthYear(m.year, m.month));
    }
    return options;
  }, [autoFirstInvoiceMonth]);

  // Parse numeric total value
  const parsedTotalValue = useMemo(() => {
    if (!rawValueStr) return 0;
    const clean = rawValueStr.replace(/[^\d,.-]/g, '');
    if (clean.includes(',')) {
      const cleanFormatted = clean.replace(/\./g, '').replace(',', '.');
      const num = parseFloat(cleanFormatted);
      return isNaN(num) ? 0 : num;
    }
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }, [rawValueStr]);

  // Real-time calculated installments
  const calculatedInstallments: FormInstallmentPreview[] = useMemo(() => {
    if (parsedTotalValue <= 0 || numMonths <= 0) return [];

    if (paymentType === 'Cartão de Crédito') {
      const cardF = selectedCard?.closingDay || 1;
      const cardV = selectedCard?.dueDay || 10;
      return generateInstallmentRows({
        paymentType: 'Cartão de Crédito',
        dateISO: purchaseDate,
        expenseNature,
        totalValue: parsedTotalValue,
        numMonths,
        cardClosingDay: cardF,
        cardDueDay: cardV,
        customStartMonth: customInvoiceMonth || undefined,
      });
    } else {
      const { day } = parseISODate(dueDate);
      return generateInstallmentRows({
        paymentType: 'Outros',
        dateISO: dueDate,
        expenseNature,
        totalValue: parsedTotalValue,
        numMonths,
        customDueDay: day,
      });
    }
  }, [
    paymentType,
    purchaseDate,
    dueDate,
    expenseNature,
    parsedTotalValue,
    numMonths,
    selectedCard,
    customInvoiceMonth,
  ]);

  // Form Validation
  const validationError = useMemo(() => {
    if (!description.trim()) return 'Informe a descrição do lançamento.';
    if (parsedTotalValue <= 0) return 'Informe um valor válido maior que zero.';
    if (numMonths < 1) return 'O número de meses deve ser pelo menos 1.';
    if (paymentType === 'Cartão de Crédito' && !selectedCardName && creditCards.length === 0) {
      return 'Nenhum cartão cadastrado. Adicione um cartão na aba Cartões.';
    }
    return null;
  }, [description, parsedTotalValue, numMonths, paymentType, selectedCardName, creditCards]);

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError) return;
    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    const origin = paymentType === 'Cartão de Crédito' ? (selectedCard?.name || selectedCardName) : selectedOrigin;
    const formattedPurchaseDate = formatToBrazilianDate(purchaseDate);

    try {
      await onSave({
        description: description.trim(),
        group,
        paymentType,
        origin,
        purchaseDate: formattedPurchaseDate,
        installments: calculatedInstallments,
      });

      setShowConfirmModal(false);
      setSuccessBanner(
        `Lançamento "${description.trim()}" com ${calculatedInstallments.length} parcela(s) gravado com sucesso!`
      );

      // Reset form fields
      setDescription('');
      setRawValueStr('');
      setNumMonths(1);
      setCustomInvoiceMonth('');
      setTimeout(() => setSuccessBanner(null), 5000);
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Success Notification */}
      {successBanner && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-2xl flex items-center gap-3 animate-fade-in shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* Main Form Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/90 shadow-sm">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Novo Lançamento</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Registre uma despesa e calcule automaticamente as parcelas e competências.
          </p>
        </div>

        <form onSubmit={handlePreSubmit} className="space-y-5">
          {/* 1. Tipo de Pagamento Switch */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Tipo de Pagamento
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl">
              <button
                type="button"
                id="btn-type-card"
                onClick={() => setPaymentType('Cartão de Crédito')}
                className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  paymentType === 'Cartão de Crédito'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CardIcon className={`w-4 h-4 ${paymentType === 'Cartão de Crédito' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>Cartão de Crédito</span>
              </button>

              <button
                type="button"
                id="btn-type-other"
                onClick={() => setPaymentType('Outros')}
                className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  paymentType === 'Outros'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Receipt className={`w-4 h-4 ${paymentType === 'Outros' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>Outros Pagamentos</span>
              </button>
            </div>
          </div>

          {/* 2. Conditional Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {paymentType === 'Cartão de Crédito' ? (
              <>
                {/* Data da Compra */}
                <div>
                  <label htmlFor="input-purchase-date" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Data da Compra
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      id="input-purchase-date"
                      value={purchaseDate}
                      onChange={(e) => {
                        setPurchaseDate(e.target.value);
                        setCustomInvoiceMonth('');
                      }}
                      required
                      className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                    />
                  </div>
                </div>

                {/* Cartão (Titular) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="select-card" className="text-xs font-semibold text-slate-700">
                      Cartão (Titular)
                    </label>
                    <button
                      type="button"
                      onClick={onOpenCardsManager}
                      className="text-[11px] text-emerald-600 hover:underline font-medium"
                    >
                      + Gerenciar
                    </button>
                  </div>
                  {creditCards.length > 0 ? (
                    <select
                      id="select-card"
                      value={selectedCardName}
                      onChange={(e) => {
                        setSelectedCardName(e.target.value);
                        setCustomInvoiceMonth(''); // Reset custom override on card change
                      }}
                      className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                    >
                      {creditCards.map((card) => (
                        <option key={card.name} value={card.name}>
                          {card.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                      <span>Nenhum cartão cadastrado.</span>
                      <button
                        type="button"
                        onClick={onOpenCardsManager}
                        className="underline font-bold text-amber-900 ml-auto"
                      >
                        Cadastrar
                      </button>
                    </div>
                  )}
                </div>

                {/* Credit Card Cycle and Invoice Info Banner */}
                {selectedCard && (
                  <div className="sm:col-span-2 p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-600 truncate">
                          <span>{selectedCard.name}: Fecha dia <strong>{selectedCard.closingDay}</strong></span>
                          <span className="mx-1">•</span>
                          <span>Vence dia <strong>{selectedCard.dueDay}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-semibold text-slate-800">Primeira Fatura:</span>
                          <span className="font-bold text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-emerald-300">
                            {activeFirstInvoiceMonth}
                          </span>
                          {customInvoiceMonth && customInvoiceMonth !== autoFirstInvoiceMonth && (
                            <span className="text-[10px] text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded font-medium">
                              (Ajustado manualmente)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Month selector dropdown to adjust if needed */}
                    <div className="flex items-center gap-1.5 ml-auto">
                      <label htmlFor="select-override-month" className="text-[11px] text-slate-600 font-medium">
                        Fatura:
                      </label>
                      <select
                        id="select-override-month"
                        value={activeFirstInvoiceMonth}
                        onChange={(e) => setCustomInvoiceMonth(e.target.value)}
                        className="h-8 px-2 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                      >
                        {monthOptions.map((m) => (
                          <option key={m} value={m}>
                            {m} {m === autoFirstInvoiceMonth ? '(Auto)' : ''}
                          </option>
                        ))}
                      </select>
                      {customInvoiceMonth && (
                        <button
                          type="button"
                          onClick={() => setCustomInvoiceMonth('')}
                          title="Restaurar cálculo automático"
                          className="text-[11px] text-emerald-700 hover:underline font-semibold"
                        >
                          Auto
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Data da Compra */}
                <div>
                  <label htmlFor="input-purchase-date-other" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Data da Compra
                  </label>
                  <input
                    type="date"
                    id="input-purchase-date-other"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    required
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                  />
                </div>

                {/* Data de Vencimento */}
                <div>
                  <label htmlFor="input-due-date" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Data de Vencimento
                  </label>
                  <input
                    type="date"
                    id="input-due-date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                  />
                </div>

                {/* Origem */}
                <div className="sm:col-span-2">
                  <label htmlFor="select-origin" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Origem
                  </label>
                  <select
                    id="select-origin"
                    value={selectedOrigin}
                    onChange={(e) => setSelectedOrigin(e.target.value)}
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                  >
                    {FIXED_ORIGINS.map((orig) => (
                      <option key={orig} value={orig}>
                        {orig}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          {/* 3. Descrição & Grupo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Descrição */}
            <div>
              <label htmlFor="input-description" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Descrição
              </label>
              <input
                type="text"
                id="input-description"
                placeholder="Ex: Supermercado Mambo, Netflix, Farmácia"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
            </div>

            {/* Grupo */}
            <div>
              <label htmlFor="select-group" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Grupo (Categoria)
              </label>
              <select
                id="select-group"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              >
                {GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. Fixo ou Variável */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <label className="text-xs font-semibold text-slate-700">
                Fixo ou Variável?
              </label>
              <span className="text-slate-400" title="Variável divide o valor. Fixo repete o valor integral todo mês.">
                <Info className="w-3.5 h-3.5" />
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                htmlFor="radio-nature-variable"
                className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  expenseNature === 'Variável'
                    ? 'bg-emerald-50/50 border-emerald-500 text-slate-900 ring-1 ring-emerald-500/20'
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="expenseNature"
                  id="radio-nature-variable"
                  checked={expenseNature === 'Variável'}
                  onChange={() => setExpenseNature('Variável')}
                  className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="font-semibold text-xs text-slate-900 block">Variável (Parcelado)</span>
                  <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                    Divide o Valor Total pelo Nº de meses (ex: Havan em 3x).
                  </span>
                </div>
              </label>

              <label
                htmlFor="radio-nature-fixed"
                className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  expenseNature === 'Fixo'
                    ? 'bg-emerald-50/50 border-emerald-500 text-slate-900 ring-1 ring-emerald-500/20'
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="expenseNature"
                  id="radio-nature-fixed"
                  checked={expenseNature === 'Fixo'}
                  onChange={() => setExpenseNature('Fixo')}
                  className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="font-semibold text-xs text-slate-900 block">Fixo (Recorrente)</span>
                  <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                    Repete o Valor Total integral em cada um dos meses (ex: Netflix, Aluguel).
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* 5. Valor Total e Nº de meses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Valor Total */}
            <div>
              <label htmlFor="input-total-value" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Valor Total (R$)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm font-semibold">
                  R$
                </div>
                <input
                  type="text"
                  id="input-total-value"
                  placeholder="0,00"
                  value={rawValueStr}
                  onChange={(e) => setRawValueStr(e.target.value)}
                  required
                  className="w-full h-11 pl-10 pr-3.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
              </div>
            </div>

            {/* Nº de meses */}
            <div>
              <label htmlFor="input-num-months" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nº de meses
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  id="input-num-months"
                  min="1"
                  max="60"
                  value={numMonths}
                  onChange={(e) => setNumMonths(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  required
                  className="w-24 h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 text-center"
                />
                {/* Quick month pills */}
                <div className="flex flex-wrap gap-1">
                  {[1, 2, 3, 6, 10, 12].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNumMonths(n)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                        numMonths === n
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {n}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 6. Live Installment Calculation Preview Banner */}
          {parsedTotalValue > 0 && calculatedInstallments.length > 0 && (
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                    Cálculo Automático
                  </span>
                </div>
                <span className="text-xs font-medium text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                  1ª parcela: {calculatedInstallments[0].month}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs mb-3">
                <div className="bg-white/80 rounded-xl p-2.5 border border-emerald-100">
                  <span className="text-slate-500 block text-[11px]">Valor por Mês</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {formatCurrency(calculatedInstallments[0].value)}
                  </span>
                </div>

                <div className="bg-white/80 rounded-xl p-2.5 border border-emerald-100">
                  <span className="text-slate-500 block text-[11px]">Vencimento</span>
                  <span className="font-bold text-slate-900 text-sm">
                    Dia {calculatedInstallments[0].dueDay}
                  </span>
                </div>

                <div className="bg-white/80 rounded-xl p-2.5 border border-emerald-100 col-span-2 sm:col-span-1">
                  <span className="text-slate-500 block text-[11px]">Total Lançado</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {formatCurrency(
                      expenseNature === 'Variável'
                        ? parsedTotalValue
                        : parsedTotalValue * numMonths
                    )}
                  </span>
                </div>
              </div>

              {/* Installment preview timeline / pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-thin">
                {calculatedInstallments.map((inst, i) => (
                  <div
                    key={i}
                    className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] border ${
                      inst.isLast
                        ? 'bg-emerald-600 text-white border-emerald-700 font-semibold'
                        : 'bg-white text-slate-700 border-emerald-100'
                    }`}
                  >
                    <span>{inst.month}</span>
                    <span className="opacity-75 ml-1">({inst.installment})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            id="btn-save-expense"
            disabled={isSaving || !!validationError}
            className="w-full h-13 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-sm rounded-2xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Salvar Lançamento</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* User Confirmation Modal (MANDATORY for Workspace Integration) */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-slate-100 shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Confirmar Lançamento</h3>
                <p className="text-xs text-slate-500">
                  Serão adicionadas {calculatedInstallments.length} linha(s) na aba "Base de Dados".
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between py-1 border-b border-slate-200/70">
                <span className="text-slate-500">Data da Compra:</span>
                <span className="font-semibold text-emerald-800">{formatToBrazilianDate(purchaseDate)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/70">
                <span className="text-slate-500">Descrição:</span>
                <span className="font-semibold text-slate-900">{description}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/70">
                <span className="text-slate-500">Grupo:</span>
                <span className="font-semibold text-slate-900">{group}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/70">
                <span className="text-slate-500">Origem / Cartão:</span>
                <span className="font-semibold text-slate-900">
                  {paymentType === 'Cartão de Crédito' ? selectedCard?.name : selectedOrigin}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/70">
                <span className="text-slate-500">Tipo:</span>
                <span className="font-semibold text-slate-900">{expenseNature} ({calculatedInstallments.length}x)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/70">
                <span className="text-slate-500">Valor por parcela:</span>
                <span className="font-bold text-emerald-700">{formatCurrency(calculatedInstallments[0]?.value)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Período:</span>
                <span className="font-semibold text-slate-900">
                  {calculatedInstallments[0]?.month} até {calculatedInstallments[calculatedInstallments.length - 1]?.month}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                id="btn-cancel-modal"
                disabled={isSaving}
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 h-11 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>

              <button
                type="button"
                id="btn-confirm-save-modal"
                disabled={isSaving}
                onClick={handleConfirmSave}
                className="flex-1 h-11 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>Gravar na Planilha</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
