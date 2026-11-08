import React, { useMemo, useState } from 'react';
import { ExpenseRow, Revenue, OriginDueSummary } from '../types';
import { formatCurrency, calculateDueStatus, parseMonthYear } from '../lib/dateUtils';
import {
  Wallet,
  TrendingDown,
  Calendar,
  CheckSquare,
  Square,
  AlertCircle,
  Plus,
  ChevronDown,
  ChevronUp,
  Tag,
  CreditCard,
  Receipt,
  Eye,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Layers,
} from 'lucide-react';

interface ResumoDashboardProps {
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  availableMonths: string[];
  expenses: ExpenseRow[];
  revenues: Revenue[];
  onOpenAddIncomeModal: (month: string) => void;
  onToggleOriginPaid: (originName: string, targetPaidState: boolean) => Promise<void>;
  isUpdatingPaid: boolean;
  onNavigateToInsights?: () => void;
  onNavigateToParcelas?: () => void;
}

export const ResumoDashboard: React.FC<ResumoDashboardProps> = ({
  selectedMonth,
  onSelectMonth,
  availableMonths,
  expenses,
  revenues,
  onOpenAddIncomeModal,
  onToggleOriginPaid,
  isUpdatingPaid,
  onNavigateToInsights,
  onNavigateToParcelas,
}) => {
  const [expandedOrigin, setExpandedOrigin] = useState<string | null>(null);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string | null>(null);

  // 1. Filter expenses for the selected month
  const monthExpenses = useMemo(() => {
    return expenses.filter((e) => e.month === selectedMonth);
  }, [expenses, selectedMonth]);

  // 2. Find revenue for the selected month
  const monthRevenue = useMemo(() => {
    const rev = revenues.find((r) => r.month === selectedMonth);
    return rev ? rev.value : 0;
  }, [revenues, selectedMonth]);

  const hasRevenue = monthRevenue > 0;

  // 3. Totals and "Conta Terceiros" breakdown
  const { totalSpent, contaTerceirosSpent, gastoSemTerceiros, hasTerceiros } = useMemo(() => {
    let total = 0;
    let terceiros = 0;

    monthExpenses.forEach((exp) => {
      total += exp.value;
      if (exp.group === 'Conta Terceiros') {
        terceiros += exp.value;
      }
    });

    return {
      totalSpent: total,
      contaTerceirosSpent: terceiros,
      gastoSemTerceiros: total - terceiros,
      hasTerceiros: terceiros > 0,
    };
  }, [monthExpenses]);

  // 4. Saldo calculations
  const saldoRestante = monthRevenue - totalSpent;
  const saldoSemTerceiros = monthRevenue - gastoSemTerceiros;
  const percentageSpent = monthRevenue > 0 ? Math.min(100, Math.round((totalSpent / monthRevenue) * 100)) : 0;

  // 5. Group by Category (Grupo)
  const categorySummary = useMemo(() => {
    const map = new Map<string, number>();
    monthExpenses.forEach((e) => {
      const g = e.group || 'Outros';
      map.set(g, (map.get(g) || 0) + e.value);
    });

    const list = Array.from(map.entries()).map(([group, val]) => ({
      group,
      value: val,
      percentage: totalSpent > 0 ? Math.round((val / totalSpent) * 100) : 0,
    }));

    // Sort descending
    return list.sort((a, b) => b.value - a.value);
  }, [monthExpenses, totalSpent]);

  // 6. Group by Origin (Origem / Cartão)
  const originSummary = useMemo(() => {
    const map = new Map<string, number>();
    monthExpenses.forEach((e) => {
      const o = e.origin || 'Outros';
      map.set(o, (map.get(o) || 0) + e.value);
    });

    const list = Array.from(map.entries()).map(([origin, val]) => ({
      origin,
      value: val,
      percentage: totalSpent > 0 ? Math.round((val / totalSpent) * 100) : 0,
    }));

    // Sort descending
    return list.sort((a, b) => b.value - a.value);
  }, [monthExpenses, totalSpent]);

  // 7. Vencimentos Section grouped by Origem/Cartão
  const vencimentosData: OriginDueSummary[] = useMemo(() => {
    const map = new Map<string, ExpenseRow[]>();
    monthExpenses.forEach((e) => {
      const key = e.origin || 'Outros';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });

    const list: OriginDueSummary[] = [];

    map.forEach((rows, origin) => {
      const totalVal = rows.reduce((acc, r) => acc + r.value, 0);
      const allPaid = rows.every((r) => r.paid);
      const somePaid = rows.some((r) => r.paid);
      const dueDay = rows[0]?.dueDay || 1;
      const paymentType = rows[0]?.paymentType || 'Outros';

      const status = calculateDueStatus(dueDay, selectedMonth, allPaid);

      list.push({
        origin,
        paymentType,
        dueDay,
        totalValue: totalVal,
        count: rows.length,
        allPaid,
        somePaid,
        expenseRows: rows,
        dueStatus: status,
      });
    });

    // Sort: unpaid first by due day, then paid
    return list.sort((a, b) => {
      if (a.allPaid !== b.allPaid) return a.allPaid ? 1 : -1;
      return a.dueDay - b.dueDay;
    });
  }, [monthExpenses, selectedMonth]);

  // Live Totals for Vencimentos footer
  const { totalJaPago, totalFaltaPagar } = useMemo(() => {
    let pago = 0;
    let falta = 0;

    vencimentosData.forEach((item) => {
      if (item.allPaid) {
        pago += item.totalValue;
      } else {
        falta += item.totalValue;
      }
    });

    return { totalJaPago: pago, totalFaltaPagar: falta };
  }, [vencimentosData]);

  // Month navigation label
  const readableMonth = useMemo(() => {
    const { year, month } = parseMonthYear(selectedMonth);
    const date = new Date(year, month - 1, 1);
    const monthName = date.toLocaleString('pt-BR', { month: 'long' });
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${year}`;
  }, [selectedMonth]);

  return (
    <div className="space-y-6 pb-8">
      {/* 1. Month Selector Header */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Mês de Referência
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight truncate">
                {selectedMonth}
              </h2>
            </div>
          </div>

          {/* Discreet Month Selector Dropdown */}
          <div className="relative shrink-0">
            <select
              value={selectedMonth}
              onChange={(e) => onSelectMonth(e.target.value)}
              className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-300/80 text-slate-800 text-xs font-bold py-2 pl-3 pr-8 rounded-xl cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-colors"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m} className="text-slate-900 font-medium">
                  {m}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Card 1: Receita do Mês */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Receita do Mês
                </span>
              </div>

              <button
                onClick={() => onOpenAddIncomeModal(selectedMonth)}
                id="btn-edit-revenue"
                className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
              >
                {hasRevenue ? 'Alterar' : '+ Cadastrar'}
              </button>
            </div>

            {hasRevenue ? (
              <div className="mt-2">
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {formatCurrency(monthRevenue)}
                </div>

                {/* Progress bar of spent vs revenue */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                    <span>Comprometido: {percentageSpent}%</span>
                    <span>{formatCurrency(totalSpent)} gastos</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        percentageSpent > 90
                          ? 'bg-rose-500'
                          : percentageSpent > 75
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, percentageSpent)}%` }}
                    />
                  </div>
                </div>

                {/* Saldo Restante details */}
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Saldo restante:</span>
                    <span
                      className={`font-bold text-sm ${
                        saldoRestante >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {formatCurrency(saldoRestante)}
                    </span>
                  </div>

                  {hasTerceiros && (
                    <div className="flex justify-between items-center text-slate-600">
                      <span className="text-slate-500">Saldo sem Conta Terceiros:</span>
                      <span
                        className={`font-bold text-xs ${
                          saldoSemTerceiros >= 0 ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {formatCurrency(saldoSemTerceiros)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-3 p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-900">
                      Nenhuma receita cadastrada para este mês.
                    </p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Cadastre a receita na aba Receitas para ver o saldo restante e progresso.
                    </p>
                    <button
                      onClick={() => onOpenAddIncomeModal(selectedMonth)}
                      className="mt-2.5 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Cadastrar Receita</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Gasto Neste Mês */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-rose-500" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Gasto neste Mês
                </span>
              </div>
              <span className="text-xs font-medium text-slate-400">
                {monthExpenses.length} {monthExpenses.length === 1 ? 'lançamento' : 'lançamentos'}
              </span>
            </div>

            <div className="mt-2">
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {formatCurrency(totalSpent)}
              </div>

              {/* Conta Terceiros Breakdown */}
              {hasTerceiros ? (
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                  <div className="flex justify-between items-center p-2 rounded-xl bg-amber-50/70 border border-amber-100">
                    <span className="text-amber-900 font-medium flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-amber-600" />
                      Conta Terceiros (reembolsável):
                    </span>
                    <span className="font-bold text-amber-900">
                      {formatCurrency(contaTerceirosSpent)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center px-1">
                    <span className="text-slate-500 font-medium">Gasto sem Conta Terceiros:</span>
                    <span className="font-bold text-slate-800">
                      {formatCurrency(gastoSemTerceiros)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400">
                  Nenhum lançamento classificado como Conta Terceiros neste mês.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI Financial Insights Callout Banner */}
      {onNavigateToInsights && (
        <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-3xl p-4 sm:p-5 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-emerald-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  Onde você mais gastou em {selectedMonth}?
                </span>
                <span className="bg-emerald-400/20 text-emerald-300 text-[10px] font-bold px-1.5 py-0.2 rounded uppercase">
                  IA
                </span>
              </div>
              <p className="text-xs text-emerald-100/70 mt-0.5">
                Veja a análise detalhada com o Gemini: maiores despesas, cartões e recomendações de economia.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            {onNavigateToParcelas && (
              <button
                onClick={onNavigateToParcelas}
                id="btn-open-parcelas"
                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl transition-all border border-white/20 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-indigo-300" />
                <span>Ver Parcelas</span>
              </button>
            )}

            <button
              onClick={onNavigateToInsights}
              id="btn-open-ai-insights"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Consultar IA</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Horizontal Bar Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico Por Categoria */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Por Categoria
            </h3>
            <span className="text-xs text-slate-400">{categorySummary.length} categorias</span>
          </div>

          {categorySummary.length > 0 ? (
            <div className="space-y-3.5">
              {categorySummary.map((cat, idx) => {
                const isSelected = selectedGroupFilter === cat.group;
                return (
                  <div
                    key={cat.group}
                    onClick={() =>
                      setSelectedGroupFilter(isSelected ? null : cat.group)
                    }
                    className="cursor-pointer group"
                  >
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="font-semibold text-slate-800 group-hover:text-emerald-700 transition-colors">
                        {cat.group}
                      </span>
                      <span className="font-bold text-slate-700">
                        {formatCurrency(cat.value)}{' '}
                        <span className="text-slate-400 font-normal">({cat.percentage}%)</span>
                      </span>
                    </div>

                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          cat.group === 'Conta Terceiros'
                            ? 'bg-amber-500'
                            : idx === 0
                            ? 'bg-emerald-600'
                            : idx === 1
                            ? 'bg-emerald-500'
                            : 'bg-emerald-400/80'
                        }`}
                        style={{ width: `${Math.max(4, cat.percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              Nenhuma despesa para este mês.
            </div>
          )}
        </div>

        {/* Gráfico Por Origem / Cartão */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Por Origem / Cartão
            </h3>
            <span className="text-xs text-slate-400">{originSummary.length} origens</span>
          </div>

          {originSummary.length > 0 ? (
            <div className="space-y-3.5">
              {originSummary.map((orig, idx) => (
                <div key={orig.origin} className="group">
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="font-semibold text-slate-800 group-hover:text-emerald-700 transition-colors">
                      {orig.origin}
                    </span>
                    <span className="font-bold text-slate-700">
                      {formatCurrency(orig.value)}{' '}
                      <span className="text-slate-400 font-normal">({orig.percentage}%)</span>
                    </span>
                  </div>

                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        idx === 0
                          ? 'bg-slate-800'
                          : idx === 1
                          ? 'bg-slate-700'
                          : 'bg-slate-500'
                      }`}
                      style={{ width: `${Math.max(4, orig.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              Nenhuma despesa para este mês.
            </div>
          )}
        </div>
      </div>

      {/* 4. Seção "Vencimentos" */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Vencimentos do Mês
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Marque para atualizar o status de pagamento de todas as despesas daquela origem.
              </p>
            </div>

            <div className="text-xs text-slate-400">
              {vencimentosData.length} {vencimentosData.length === 1 ? 'origem' : 'origens'}
            </div>
          </div>
        </div>

        {/* List of Origins */}
        {vencimentosData.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {vencimentosData.map((item) => {
              const isExpanded = expandedOrigin === item.origin;

              // Status badge styling
              let badgeColor = 'bg-slate-100 text-slate-600 border-slate-200';
              if (item.allPaid) {
                badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
              } else if (item.dueStatus.variant === 'today') {
                badgeColor = 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
              } else if (item.dueStatus.variant === 'upcoming') {
                badgeColor = 'bg-amber-50 text-amber-700 border-amber-200 font-semibold';
              }

              return (
                <div
                  key={item.origin}
                  className={`p-4 sm:p-5 transition-colors ${
                    item.allPaid ? 'bg-slate-50/40' : 'bg-white hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    {/* Left: Checkbox & Info */}
                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        disabled={isUpdatingPaid}
                        onClick={() => onToggleOriginPaid(item.origin, !item.allPaid)}
                        className="cursor-pointer text-slate-400 hover:text-emerald-600 focus:outline-none shrink-0 mt-0.5 sm:mt-0"
                        title={item.allPaid ? 'Marcar como Não Pago' : 'Marcar como Pago'}
                      >
                        {item.allPaid ? (
                          <CheckSquare className="w-6 h-6 text-emerald-600" />
                        ) : (
                          <Square className="w-6 h-6 text-slate-300 hover:text-slate-400" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                          <h4
                            className={`text-xs sm:text-sm font-bold break-words leading-snug ${
                              item.allPaid ? 'text-slate-500 line-through' : 'text-slate-900'
                            }`}
                          >
                            {item.origin}
                          </h4>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md border shrink-0 ${badgeColor}`}
                          >
                            {item.dueStatus.label}
                          </span>
                        </div>

                        <div className="text-xs text-slate-500 mt-0.5">
                          <span>
                            {item.count} {item.count === 1 ? 'item' : 'itens'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Total & Details Toggle */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span
                          className={`text-sm sm:text-base font-extrabold ${
                            item.allPaid ? 'text-slate-500' : 'text-slate-900'
                          }`}
                        >
                          {formatCurrency(item.totalValue)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedOrigin(isExpanded ? null : item.origin)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Ver detalhes dos lançamentos"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Transaction Items Breakdown */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-100 pl-9 space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Lançamentos nesta origem ({selectedMonth}):
                      </span>
                      {item.expenseRows.map((row) => (
                        <div
                          key={row.rowIndex}
                          className="flex justify-between items-center text-xs py-1.5 px-2.5 rounded-lg bg-slate-50 border border-slate-200/60"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-slate-800">{row.description}</span>
                            {row.purchaseDate && (
                              <span className="text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 font-medium">
                                Compra: {row.purchaseDate}
                              </span>
                            )}
                            <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded">
                              {row.group}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              (Parc. {row.installment})
                            </span>
                          </div>
                          <span className="font-semibold text-slate-900 shrink-0">
                            {formatCurrency(row.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-400">
            Nenhum vencimento registrado para {readableMonth}.
          </div>
        )}

        {/* Footer with Instant Live Totals: "Já pago" and "Falta pagar" */}
        <div className="bg-slate-50 p-4 sm:p-5 border-t border-slate-200/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-slate-600">Já pago neste mês:</span>
              <strong className="text-emerald-700 font-bold text-sm sm:text-base">
                {formatCurrency(totalJaPago)}
              </strong>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
              <span className="text-slate-600">Falta pagar:</span>
              <strong className="text-rose-700 font-bold text-sm sm:text-base">
                {formatCurrency(totalFaltaPagar)}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
