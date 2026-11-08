import React, { useState, useMemo } from 'react';
import {
  Layers,
  Calendar,
  CreditCard as CreditCardIcon,
  Tag,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CalendarDays,
  Percent,
} from 'lucide-react';
import { ExpenseRow, CreditCard, InstallmentPurchase } from '../types';
import { formatCurrency } from '../lib/dateUtils';
import {
  groupInstallmentPurchases,
  calculateMonthlyInstallmentProjection,
} from '../lib/installmentUtils';

interface InstallmentsViewProps {
  expenses: ExpenseRow[];
  creditCards: CreditCard[];
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  availableMonths: string[];
  onNavigateToLancar?: () => void;
}

export const InstallmentsView: React.FC<InstallmentsViewProps> = ({
  expenses,
  selectedMonth,
  onSelectMonth,
  availableMonths,
  onNavigateToLancar,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOriginFilter, setSelectedOriginFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'finished'>('active');
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);
  const [highlightedProjectionMonth, setHighlightedProjectionMonth] = useState<string | null>(null);

  // Group all purchases with installments > 1
  const allInstallmentPurchases = useMemo(() => {
    return groupInstallmentPurchases(expenses, selectedMonth);
  }, [expenses, selectedMonth]);

  // Unique origins for filter dropdown
  const uniqueOrigins = useMemo(() => {
    const set = new Set<string>();
    allInstallmentPurchases.forEach((p) => {
      if (p.origin) set.add(p.origin);
    });
    return Array.from(set).sort();
  }, [allInstallmentPurchases]);

  // 12-month future commitment projection
  const monthlyProjections = useMemo(() => {
    const baseMonth = selectedMonth || availableMonths[0] || '10/2026';
    return calculateMonthlyInstallmentProjection(allInstallmentPurchases, baseMonth, 12);
  }, [allInstallmentPurchases, selectedMonth, availableMonths]);

  // Max value in projection for bar scaling
  const maxProjectionValue = useMemo(() => {
    const max = Math.max(...monthlyProjections.map((p) => p.totalCommitted), 1);
    return max;
  }, [monthlyProjections]);

  // Filtered purchases
  const filteredPurchases = useMemo(() => {
    return allInstallmentPurchases.filter((p) => {
      // Status filter
      if (selectedStatusFilter === 'active' && p.isFinished) return false;
      if (selectedStatusFilter === 'finished' && !p.isFinished) return false;

      // Origin filter
      if (selectedOriginFilter !== 'all' && p.origin !== selectedOriginFilter) return false;

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesDesc = p.description.toLowerCase().includes(query);
        const matchesOrigin = p.origin.toLowerCase().includes(query);
        const matchesGroup = p.group.toLowerCase().includes(query);
        if (!matchesDesc && !matchesOrigin && !matchesGroup) return false;
      }

      // Projection month highlight filter
      if (highlightedProjectionMonth) {
        const hasRowInMonth = p.rows.some((r) => r.month === highlightedProjectionMonth);
        const fallsInExtrapolated =
          p.firstMonth &&
          p.lastMonth &&
          monthlyProjections
            .find((mp) => mp.month === highlightedProjectionMonth)
            ?.purchases.some((item) => item.description === p.description && item.origin === p.origin);

        if (!hasRowInMonth && !fallsInExtrapolated) return false;
      }

      return true;
    });
  }, [
    allInstallmentPurchases,
    selectedStatusFilter,
    selectedOriginFilter,
    searchTerm,
    highlightedProjectionMonth,
    monthlyProjections,
  ]);

  // KPI Metrics Calculations
  const metrics = useMemo(() => {
    // Current month committed
    const currentMonthProjection = monthlyProjections.find((p) => p.month === selectedMonth);
    const monthCommitted = currentMonthProjection ? currentMonthProjection.totalCommitted : 0;
    const monthActiveCount = currentMonthProjection ? currentMonthProjection.activePurchasesCount : 0;

    // Total remaining debt across all active purchases
    const activePurchases = allInstallmentPurchases.filter((p) => !p.isFinished);
    const totalRemainingDebt = activePurchases.reduce((sum, p) => sum + p.remainingValue, 0);

    // Single highest installment value among active
    const sortedByInstValue = [...activePurchases].sort((a, b) => b.installmentValue - a.installmentValue);
    const highestInstallment = sortedByInstValue[0] || null;

    // Next purchase to finish (closest lastMonth)
    const sortedByEnding = [...activePurchases]
      .filter((p) => p.remainingInstallmentsCount > 0)
      .sort((a, b) => a.remainingInstallmentsCount - b.remainingInstallmentsCount);
    const nextToFinish = sortedByEnding[0] || null;

    return {
      monthCommitted,
      monthActiveCount,
      totalRemainingDebt,
      highestInstallment,
      nextToFinish,
      totalActiveCount: activePurchases.length,
      totalFinishedCount: allInstallmentPurchases.filter((p) => p.isFinished).length,
    };
  }, [allInstallmentPurchases, monthlyProjections, selectedMonth]);

  const toggleExpand = (id: string) => {
    setExpandedPurchaseId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0 shadow-inner">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                  Visualização de Parcelamentos
                </h2>
                <span className="bg-indigo-400/20 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-indigo-400/30">
                  Timeline
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Acompanhe o progresso de cada compra, saldo devedor e o alívio mensal das faturas.
              </p>
            </div>
          </div>

          {/* Reference Month Selector */}
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-2xl p-1.5 border border-white/15 self-start sm:self-auto">
            <Calendar className="w-4 h-4 text-indigo-200 ml-2" />
            <select
              value={selectedMonth}
              onChange={(e) => onSelectMonth(e.target.value)}
              className="bg-transparent text-white text-xs font-semibold focus:outline-none pr-3 py-1 cursor-pointer [&>option]:text-slate-900"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  Mês Base: {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Top KPI Cards Grid */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Comprometido no Mês */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 flex flex-col justify-between">
            <div className="flex items-center justify-between text-indigo-200 text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-indigo-300" /> Em {selectedMonth}
              </span>
              <span className="text-[11px] font-bold text-white bg-white/15 px-1.5 py-0.2 rounded-md">
                {metrics.monthActiveCount} {metrics.monthActiveCount === 1 ? 'parcela' : 'parcelas'}
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xl font-extrabold text-white">
                {formatCurrency(metrics.monthCommitted)}
              </div>
              <div className="text-[11px] text-indigo-100/70 font-medium">
                Total parcelado neste mês
              </div>
            </div>
          </div>

          {/* Card 2: Saldo Devedor Futuro */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 flex flex-col justify-between">
            <div className="flex items-center justify-between text-indigo-200 text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-indigo-300" /> Saldo Restante Total
              </span>
              <span className="text-[11px] font-bold text-white bg-white/15 px-1.5 py-0.2 rounded-md">
                {metrics.totalActiveCount} ativas
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xl font-extrabold text-white">
                {formatCurrency(metrics.totalRemainingDebt)}
              </div>
              <div className="text-[11px] text-indigo-100/70 font-medium">
                Soma de todas as parcelas futuras
              </div>
            </div>
          </div>

          {/* Card 3: Maior Parcela Ativa */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 flex flex-col justify-between">
            <div className="flex items-center justify-between text-indigo-200 text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <CreditCardIcon className="w-3.5 h-3.5 text-indigo-300" /> Maior Parcela
              </span>
              {metrics.highestInstallment && (
                <span className="text-[10px] text-indigo-200 font-semibold truncate max-w-[80px]">
                  {metrics.highestInstallment.origin}
                </span>
              )}
            </div>
            <div className="mt-2">
              <div className="text-base font-bold text-white truncate">
                {metrics.highestInstallment
                  ? formatCurrency(metrics.highestInstallment.installmentValue)
                  : 'Nenhuma'}
              </div>
              <div className="text-[11px] text-indigo-100/70 font-medium truncate">
                {metrics.highestInstallment ? metrics.highestInstallment.description : 'Sem dados'}
              </div>
            </div>
          </div>

          {/* Card 4: Próxima Quitação */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 flex flex-col justify-between">
            <div className="flex items-center justify-between text-indigo-200 text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-300" /> Próxima a Terminar
              </span>
              {metrics.nextToFinish && (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.2 rounded">
                  {metrics.nextToFinish.remainingInstallmentsCount}{' '}
                  {metrics.nextToFinish.remainingInstallmentsCount === 1 ? 'restante' : 'restantes'}
                </span>
              )}
            </div>
            <div className="mt-2">
              <div className="text-sm font-bold text-white truncate">
                {metrics.nextToFinish ? metrics.nextToFinish.description : 'Nenhuma'}
              </div>
              <div className="text-[11px] text-indigo-100/70 font-medium truncate">
                {metrics.nextToFinish
                  ? `Termina em ${metrics.nextToFinish.lastMonth}`
                  : 'Sem compras em andamento'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Interactive Future Commitment Projection (12 Months Timeline) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              Projeção de Comprometimento Futuro (Próximos 12 Meses)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Veja como seu orçamento vai se liberando conforme as parcelas vão sendo quitadas mês a mês.
            </p>
          </div>

          {highlightedProjectionMonth && (
            <button
              onClick={() => setHighlightedProjectionMonth(null)}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <span>Exibindo mês: {highlightedProjectionMonth}</span>
              <span className="font-bold">✕ Limpar filtro</span>
            </button>
          )}
        </div>

        {/* Projection Timeline Bar Chart */}
        <div className="pt-2 overflow-x-auto pb-2 no-scrollbar">
          <div className="min-w-[620px] flex items-end gap-2.5 h-44 px-1">
            {monthlyProjections.map((proj) => {
              const heightPercent =
                maxProjectionValue > 0
                  ? Math.max(12, Math.round((proj.totalCommitted / maxProjectionValue) * 100))
                  : 12;
              const isCurrent = proj.month === selectedMonth;
              const isFiltered = highlightedProjectionMonth === proj.month;

              return (
                <div
                  key={proj.month}
                  onClick={() =>
                    setHighlightedProjectionMonth(isFiltered ? null : proj.month)
                  }
                  className={`flex-1 flex flex-col items-center justify-end h-full group cursor-pointer transition-transform hover:-translate-y-1 ${
                    isFiltered ? 'scale-105' : ''
                  }`}
                  title={`${proj.month}: ${formatCurrency(proj.totalCommitted)} (${proj.activePurchasesCount} parcelas)`}
                >
                  {/* Amount label on hover or if current */}
                  <div
                    className={`text-[10px] font-bold mb-1.5 truncate max-w-full transition-opacity ${
                      isCurrent || isFiltered
                        ? 'text-indigo-700 opacity-100'
                        : 'text-slate-500 opacity-80 group-hover:opacity-100'
                    }`}
                  >
                    {proj.totalCommitted > 0 ? formatCurrency(proj.totalCommitted) : 'R$ 0'}
                  </div>

                  {/* Bar */}
                  <div className="w-full flex justify-center">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full max-w-[42px] rounded-xl transition-all duration-300 shadow-xs flex flex-col justify-end p-1 ${
                        isFiltered
                          ? 'bg-gradient-to-t from-indigo-700 to-indigo-500 ring-2 ring-indigo-400'
                          : isCurrent
                          ? 'bg-gradient-to-t from-emerald-600 to-teal-500'
                          : proj.totalCommitted > 0
                          ? 'bg-gradient-to-t from-slate-300 via-indigo-200 to-indigo-300 group-hover:from-indigo-400 group-hover:to-indigo-300'
                          : 'bg-slate-100'
                      }`}
                    >
                      {proj.activePurchasesCount > 0 && (
                        <span className="text-[9px] font-bold text-center text-white/90 truncate block">
                          {proj.activePurchasesCount}p
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Month Label */}
                  <div className="mt-2 text-center">
                    <span
                      className={`block text-[11px] font-semibold truncate ${
                        isCurrent
                          ? 'text-emerald-700 font-bold'
                          : isFiltered
                          ? 'text-indigo-700 font-bold'
                          : 'text-slate-600 group-hover:text-slate-900'
                      }`}
                    >
                      {proj.month}
                    </span>
                    {isCurrent && (
                      <span className="block text-[9px] font-bold text-emerald-600 uppercase tracking-tighter">
                        Atual
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-md bg-emerald-600" /> Mês atual
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-md bg-indigo-300" /> Próximos meses
            </span>
          </div>
          <span>Clique em qualquer mês para filtrar as compras que vencem nele</span>
        </div>
      </div>

      {/* 3. Search and Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar compra parcelada (ex: TV, Tênis, Notebook)..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-xs text-slate-800 rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none transition-all placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Origin Filter */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={selectedOriginFilter}
              onChange={(e) => setSelectedOriginFilter(e.target.value)}
              className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold py-2 pl-3 pr-8 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">Todos os Cartões/Contas</option>
              {uniqueOrigins.map((origin) => (
                <option key={origin} value={origin}>
                  {origin}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Status Tabs Switcher */}
          <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/80">
            <button
              onClick={() => setSelectedStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedStatusFilter === 'active'
                  ? 'bg-white text-indigo-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Em Andamento ({metrics.totalActiveCount})
            </button>
            <button
              onClick={() => setSelectedStatusFilter('finished')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedStatusFilter === 'finished'
                  ? 'bg-white text-indigo-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Quitadas ({metrics.totalFinishedCount})
            </button>
            <button
              onClick={() => setSelectedStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedStatusFilter === 'all'
                  ? 'bg-white text-indigo-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todas ({allInstallmentPurchases.length})
            </button>
          </div>
        </div>
      </div>

      {/* 4. Installment Purchases List */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>
            Exibindo <strong>{filteredPurchases.length}</strong>{' '}
            {filteredPurchases.length === 1 ? 'compra parcelada' : 'compras parceladas'}
          </span>
          {highlightedProjectionMonth && (
            <span className="text-indigo-600 font-semibold">
              Filtrado pelo mês {highlightedProjectionMonth}
            </span>
          )}
        </div>

        {filteredPurchases.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center space-y-3 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <Layers className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">
              Nenhuma compra parcelada encontrada
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchTerm || selectedOriginFilter !== 'all' || highlightedProjectionMonth
                ? 'Tente ajustar os filtros ou o termo de busca para visualizar outros parcelamentos.'
                : 'Quando você cadastrar despesas com número de parcelas maior que 1 na aba Lançar, elas serão organizadas e monitoradas aqui automaticamente.'}
            </p>
            {onNavigateToLancar && (
              <button
                onClick={onNavigateToLancar}
                className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>Lançar Nova Compra Parcelada</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          filteredPurchases.map((purchase) => {
            const isExpanded = expandedPurchaseId === purchase.id;
            const progressPercent = Math.min(
              100,
              Math.round((purchase.paidInstallmentsCount / purchase.totalInstallments) * 100)
            );
            const isLastInstallmentNow =
              purchase.remainingInstallmentsCount === 1 && !purchase.isFinished;

            return (
              <div
                key={purchase.id}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs hover:shadow-sm ${
                  purchase.isFinished
                    ? 'border-slate-200 bg-slate-50/50 opacity-90'
                    : isLastInstallmentNow
                    ? 'border-amber-300 ring-1 ring-amber-200'
                    : 'border-slate-200/90 hover:border-indigo-300'
                }`}
              >
                {/* Main Card Header / Summary Row */}
                <div
                  onClick={() => toggleExpand(purchase.id)}
                  className="p-4 sm:p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 select-none"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                        {purchase.description}
                      </h4>

                      {/* Status Badge */}
                      {purchase.isFinished ? (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Quitado
                        </span>
                      ) : isLastInstallmentNow ? (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                          <Sparkles className="w-3 h-3 text-amber-600" /> Última Parcela!
                        </span>
                      ) : (
                        <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Em andamento
                        </span>
                      )}

                      {/* Group Category Badge */}
                      <span className="bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Tag className="w-2.5 h-2.5 text-slate-400" />
                        {purchase.group}
                      </span>

                      {/* Card / Origin Badge */}
                      <span className="bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CreditCardIcon className="w-2.5 h-2.5 text-slate-400" />
                        {purchase.origin}
                      </span>

                      {/* Purchase Date */}
                      {purchase.purchaseDate && (
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          Compra: {purchase.purchaseDate}
                        </span>
                      )}
                    </div>

                    {/* Installment Progress Bar */}
                    <div className="mt-2.5">
                      <div className="flex justify-between items-center text-xs text-slate-500 mb-1">
                        <span className="font-semibold text-slate-700">
                          Parcela {purchase.paidInstallmentsCount} de {purchase.totalInstallments}{' '}
                          <span className="text-slate-400 font-normal">({progressPercent}%)</span>
                        </span>
                        <span>
                          {purchase.isFinished ? (
                            <span className="text-emerald-600 font-bold">100% pago</span>
                          ) : (
                            <span>
                              Restam <strong>{purchase.remainingInstallmentsCount}</strong>{' '}
                              {purchase.remainingInstallmentsCount === 1 ? 'mês' : 'meses'}
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${progressPercent}%` }}
                          className={`h-full rounded-full transition-all duration-500 ${
                            purchase.isFinished
                              ? 'bg-emerald-500'
                              : isLastInstallmentNow
                              ? 'bg-amber-500'
                              : 'bg-indigo-600'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Financial Values Box */}
                  <div className="flex items-center justify-between md:justify-end gap-6 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 shrink-0">
                    <div className="text-left md:text-right">
                      <div className="text-xs text-slate-400">Valor da Parcela</div>
                      <div className="text-base font-extrabold text-slate-900">
                        {formatCurrency(purchase.installmentValue)}
                        <span className="text-[11px] text-slate-400 font-normal">/mês</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Total: {formatCurrency(purchase.totalPurchaseValue)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-slate-400">Saldo a Pagar</div>
                      <div
                        className={`text-base font-extrabold ${
                          purchase.isFinished
                            ? 'text-emerald-600'
                            : 'text-slate-800'
                        }`}
                      >
                        {formatCurrency(purchase.remainingValue)}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {purchase.firstMonth} → {purchase.lastMonth}
                      </div>
                    </div>

                    <div className="text-slate-400">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Detailed Installments Timeline */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
                      <span>Cronograma Completo de Parcelas</span>
                      <span className="text-slate-400 normal-case font-medium">
                        Dia de Vencimento: {purchase.dueDay}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                      {purchase.rows.map((row) => {
                        const isCurrentRowMonth = row.month === selectedMonth;
                        return (
                          <div
                            key={row.rowIndex}
                            className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-colors ${
                              row.paid
                                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                                : isCurrentRowMonth
                                ? 'bg-white border-indigo-400 ring-2 ring-indigo-200 text-slate-900 font-semibold'
                                : 'bg-white border-slate-200/80 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              {row.paid ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
                              )}
                              <div>
                                <span className="font-bold text-slate-900 block">
                                  Parcela {row.installment}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  Mês: {row.month}
                                </span>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="font-bold text-slate-900 block">
                                {formatCurrency(row.value)}
                              </span>
                              <span
                                className={`text-[10px] font-semibold ${
                                  row.paid ? 'text-emerald-700' : 'text-slate-400'
                                }`}
                              >
                                {row.paid ? 'Pago' : isCurrentRowMonth ? 'Mês Atual' : 'Pendente'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-2 flex flex-wrap items-center justify-between text-[11px] text-slate-400">
                      <span>
                        Cadastrado na aba <em>Base de Dados</em> da sua planilha.
                      </span>
                      <span>
                        Término previsto: <strong>{purchase.lastMonth}</strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
