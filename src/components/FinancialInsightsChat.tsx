import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Sparkles,
  Send,
  RotateCcw,
  TrendingUp,
  CreditCard as CreditCardIcon,
  Tag,
  AlertCircle,
  Calendar,
  Wallet,
  ArrowUpRight,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';
import { ExpenseRow, Revenue, CreditCard } from '../types';
import { formatCurrency } from '../lib/dateUtils';
import { groupInstallmentPurchases } from '../lib/installmentUtils';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

interface FinancialInsightsChatProps {
  expenses: ExpenseRow[];
  revenues: Revenue[];
  creditCards: CreditCard[];
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  availableMonths: string[];
}

export const FinancialInsightsChat: React.FC<FinancialInsightsChatProps> = ({
  expenses,
  revenues,
  selectedMonth,
  onSelectMonth,
  availableMonths,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      content:
        'Olá! Eu sou seu **Consultor Financeiro Pessoal**. 💡\n\nAnalisei seus lançamentos e posso te dizer exatamente **onde você gastou mais**, quais categorias pesaram mais no orçamento, detalhes de faturas e dicas personalizadas para economizar.\n\nClique em uma das perguntas rápidas abaixo ou me pergunte o que quiser!',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter expenses for selected month
  const monthExpenses = useMemo(() => {
    if (!selectedMonth || selectedMonth === 'all') return expenses;
    return expenses.filter((e) => e.month === selectedMonth);
  }, [expenses, selectedMonth]);

  // Financial summary metrics
  const summaryMetrics = useMemo(() => {
    const totalExp = monthExpenses.reduce((sum, e) => sum + (e.value || 0), 0);
    const revObj = revenues.find((r) => r.month === selectedMonth);
    const totalIncome = revObj?.value || 0;
    const balance = totalIncome - totalExp;

    // Group totals (where spent more by category)
    const groupTotals: Record<string, number> = {};
    const originTotals: Record<string, number> = {};

    monthExpenses.forEach((e) => {
      const g = e.group || 'Outros';
      groupTotals[g] = (groupTotals[g] || 0) + (e.value || 0);

      const o = e.origin || 'Outros';
      originTotals[o] = (originTotals[o] || 0) + (e.value || 0);
    });

    const sortedGroups = Object.entries(groupTotals)
      .map(([group, total]) => ({
        group,
        total,
        percentage: totalExp > 0 ? (total / totalExp) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const sortedOrigins = Object.entries(originTotals)
      .map(([origin, total]) => ({
        origin,
        total,
        percentage: totalExp > 0 ? (total / totalExp) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const sortedIndividualExpenses = [...monthExpenses]
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .slice(0, 10)
      .map((e) => ({
        description: e.description,
        value: e.value,
        group: e.group,
        origin: e.origin,
        purchaseDate: e.purchaseDate,
        month: e.month,
        paid: e.paid,
      }));

    const recentPurchases = [...monthExpenses]
      .filter((e) => Boolean(e.purchaseDate))
      .slice(0, 8)
      .map((e) => ({
        description: e.description,
        value: e.value,
        purchaseDate: e.purchaseDate!,
        origin: e.origin,
        group: e.group,
      }));

    return {
      totalExp,
      totalIncome,
      balance,
      sortedGroups,
      sortedOrigins,
      sortedIndividualExpenses,
      recentPurchases,
      topGroup: sortedGroups[0] || null,
      topOrigin: sortedOrigins[0] || null,
      topSingleExpense: sortedIndividualExpenses[0] || null,
    };
  }, [monthExpenses, revenues, selectedMonth]);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  // Send message to Gemini through backend SSE
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isStreaming) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setIsStreaming(true);

    const modelMessageId = `model-${Date.now()}`;
    const modelMessage: Message = {
      id: modelMessageId,
      role: 'model',
      content: '',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, modelMessage]);

    try {
      // Build context for the AI
      const installmentPurchases = groupInstallmentPurchases(expenses, selectedMonth);
      const activeInstallmentsSummary = installmentPurchases
        .filter((p) => !p.isFinished)
        .slice(0, 8)
        .map((p) => ({
          description: p.description,
          origin: p.origin,
          group: p.group,
          installmentValue: p.installmentValue,
          progress: `${p.paidInstallmentsCount}/${p.totalInstallments}`,
          remainingInstallments: p.remainingInstallmentsCount,
          remainingValue: p.remainingValue,
          endsAtMonth: p.lastMonth,
        }));

      const contextData = {
        selectedMonth: selectedMonth || 'Todos os meses',
        totalExpenses: summaryMetrics.totalExp,
        totalIncome: summaryMetrics.totalIncome,
        balance: summaryMetrics.balance,
        topCategories: summaryMetrics.sortedGroups.slice(0, 5),
        topOrigins: summaryMetrics.sortedOrigins.slice(0, 5),
        topExpenses: summaryMetrics.sortedIndividualExpenses.slice(0, 6),
        recentPurchasesWithDate: summaryMetrics.recentPurchases,
        activeInstallments: activeInstallmentsSummary,
        rawExpensesCount: monthExpenses.length,
      };

      const payloadMessages = newMessages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: payloadMessages,
          context: contextData,
        }),
      });

      if (!res.ok) {
        throw new Error(`Falha na resposta do servidor: status ${res.status}`);
      }

      if (!res.body) {
        throw new Error('Streaming não disponível.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;

            try {
              const data = JSON.parse(jsonStr);
              if (data.error) {
                accumulatedContent += `\n\n*(Erro: ${data.error})*`;
              } else if (data.text) {
                accumulatedContent += data.text;
              }
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === modelMessageId ? { ...msg, content: accumulatedContent } : msg
                )
              );
            } catch {
              // Ignore parse error on partial chunks
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Error generating AI response:', err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === modelMessageId
            ? {
                ...msg,
                content:
                  'Desculpe, ocorreu um imprevisto ao processar sua pergunta. Verifique se o servidor está ativo e tente novamente em instantes.',
              }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'model',
        content:
          'Histórico reiniciado! Sobre o que gostaria de conversar agora? Posso te detalhar onde gastou mais ou comparar suas faturas.',
        timestamp: new Date(),
      },
    ]);
  };

  const handleCopyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Quick suggestion prompts
  const quickPrompts = [
    {
      title: 'Onde gastei mais?',
      prompt: `Onde eu mais gastei no mês de ${selectedMonth}? Destaque a categoria com maior gasto, o cartão mais usado e as maiores despesas individuais.`,
    },
    {
      title: 'Top Categorias',
      prompt: `Faça um ranking das 3 maiores categorias de despesa em ${selectedMonth} com seus valores e porcentagens do total gasto.`,
    },
    {
      title: 'Compras no Cartão',
      prompt: `Analise meus gastos com Cartão de Crédito em ${selectedMonth}. Quais foram as compras e qual o impacto no mês? Mostre as datas de compra quando houver.`,
    },
    {
      title: 'Parcelamentos',
      prompt: `Quais compras parceladas estão ativas em ${selectedMonth}, quantas parcelas faltam e quando elas terminam?`,
    },
    {
      title: 'Dicas de Economia',
      prompt: `Com base nas minhas maiores despesas de ${selectedMonth}, onde posso cortar ou economizar no próximo mês sem comprometer o básico?`,
    },
  ];

  // Helper to render markdown-like formatting cleanly
  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');
    return (
      <div className="space-y-1.5 leading-relaxed text-sm">
        {lines.map((line, idx) => {
          if (!line.trim()) {
            return <div key={idx} className="h-1.5" />;
          }

          // Bullet points
          const isBullet = line.trim().startsWith('* ') || line.trim().startsWith('- ');
          const cleanLine = isBullet ? line.trim().slice(2) : line;

          // Parse bold **text**
          const parts = cleanLine.split(/(\*\*.*?\*\*)/g);

          const formattedContent = parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={pIdx} className="font-semibold text-slate-900">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return part;
          });

          if (isBullet) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-1">
                <span className="text-emerald-500 font-bold shrink-0 mt-0.5">•</span>
                <span className="flex-1">{formattedContent}</span>
              </div>
            );
          }

          return <p key={idx}>{formattedContent}</p>;
        })}
      </div>
    );
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header Banner & Month Filter */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-60 h-60 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
              <Sparkles className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                  Insights & Análise Financeira
                </h2>
                <span className="bg-emerald-400/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-400/30">
                  Gemini IA
                </span>
              </div>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                Descubra onde foi seu dinheiro, quais compras pesaram mais e como otimizar o mês.
              </p>
            </div>
          </div>

          {/* Month Selector */}
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-2xl p-1.5 border border-white/15 self-start sm:self-auto">
            <Calendar className="w-4 h-4 text-emerald-200 ml-2" />
            <select
              value={selectedMonth}
              onChange={(e) => onSelectMonth(e.target.value)}
              className="bg-transparent text-white text-xs font-semibold focus:outline-none pr-3 py-1 cursor-pointer [&>option]:text-slate-900"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  Mês {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick KPI Overview Cards */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Top Category Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-200 text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-300" /> Onde Gastou Mais
              </span>
              {summaryMetrics.topGroup && (
                <span className="text-[11px] font-bold text-white bg-white/15 px-1.5 py-0.2 rounded-md">
                  {summaryMetrics.topGroup.percentage.toFixed(0)}%
                </span>
              )}
            </div>
            <div className="mt-2">
              <div className="text-base font-bold text-white truncate">
                {summaryMetrics.topGroup ? summaryMetrics.topGroup.group : 'Sem dados'}
              </div>
              <div className="text-xs text-emerald-100/70 font-medium">
                {summaryMetrics.topGroup
                  ? formatCurrency(summaryMetrics.topGroup.total)
                  : 'Nenhum lançamento'}
              </div>
            </div>
          </div>

          {/* Top Origin / Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-200 text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <CreditCardIcon className="w-3.5 h-3.5 text-emerald-300" /> Cartão / Origem Principal
              </span>
              {summaryMetrics.topOrigin && (
                <span className="text-[11px] font-bold text-white bg-white/15 px-1.5 py-0.2 rounded-md">
                  {summaryMetrics.topOrigin.percentage.toFixed(0)}%
                </span>
              )}
            </div>
            <div className="mt-2">
              <div className="text-base font-bold text-white truncate">
                {summaryMetrics.topOrigin ? summaryMetrics.topOrigin.origin : 'Sem dados'}
              </div>
              <div className="text-xs text-emerald-100/70 font-medium">
                {summaryMetrics.topOrigin
                  ? formatCurrency(summaryMetrics.topOrigin.total)
                  : 'Nenhum lançamento'}
              </div>
            </div>
          </div>

          {/* Single Largest Expense */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-200 text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-300" /> Maior Compra Individual
              </span>
              {summaryMetrics.topSingleExpense?.purchaseDate && (
                <span className="text-[10px] text-emerald-200 font-semibold">
                  {summaryMetrics.topSingleExpense.purchaseDate}
                </span>
              )}
            </div>
            <div className="mt-2">
              <div className="text-base font-bold text-white truncate">
                {summaryMetrics.topSingleExpense
                  ? summaryMetrics.topSingleExpense.description
                  : 'Sem dados'}
              </div>
              <div className="text-xs text-emerald-100/70 font-medium">
                {summaryMetrics.topSingleExpense
                  ? formatCurrency(summaryMetrics.topSingleExpense.value)
                  : 'Nenhum lançamento'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Box Container */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm flex flex-col h-[560px] overflow-hidden">
        {/* Chat Header Bar */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
              <Sparkles className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                Consultor Financeiro Gemini
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </h3>
              <p className="text-[11px] text-slate-400">
                Sincronizado com os dados do mês {selectedMonth}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleClearHistory}
              title="Limpar conversa"
              className="px-2.5 py-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Recomeçar</span>
            </button>
          </div>
        </div>

        {/* Scrollable Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/30">
          {messages.map((message) => {
            const isUser = message.role === 'user';
            return (
              <div
                key={message.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`group relative max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-slate-800 shadow-xs ${
                    isUser
                      ? 'bg-emerald-600 text-white rounded-br-xs'
                      : 'bg-white border border-slate-200/80 rounded-bl-xs'
                  }`}
                >
                  {isUser ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                  ) : (
                    <div>
                      {message.content ? (
                        renderFormattedText(message.content)
                      ) : (
                        <div className="flex items-center gap-2 py-1 text-slate-400 text-xs">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                          <span>Analisando suas finanças...</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Copy message button */}
                  {!isUser && message.content && (
                    <button
                      onClick={() => handleCopyMessage(message.id, message.content)}
                      title="Copiar resposta"
                      className="absolute right-2 top-2 p-1 text-slate-300 hover:text-slate-600 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                    >
                      {copiedId === message.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        <div className="px-4 py-2 border-t border-slate-100 bg-white flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0 flex items-center gap-1">
            <HelpCircle className="w-3 h-3" /> Sugestões:
          </span>
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(qp.prompt)}
              disabled={isStreaming}
              className="text-xs bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 text-slate-700 px-3 py-1.5 rounded-full border border-slate-200/70 whitespace-nowrap transition-all shrink-0 flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <span>{qp.title}</span>
              <ArrowUpRight className="w-3 h-3 text-slate-400" />
            </button>
          ))}
        </div>

        {/* Chat Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 bg-white border-t border-slate-200/80 flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Pergunte sobre onde gastou mais, faturas, comparativos..."
            disabled={isStreaming}
            className="flex-1 bg-slate-100 hover:bg-slate-100/80 focus:bg-white text-slate-800 text-xs sm:text-sm px-4 py-2.5 rounded-xl border border-transparent focus:border-emerald-500 focus:outline-none transition-all placeholder:text-slate-400"
          />

          <button
            type="submit"
            disabled={!inputValue.trim() || isStreaming}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-xl font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-xs disabled:cursor-not-allowed"
          >
            {isStreaming ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Enviar</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Extra Financial Tip Card */}
      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
          <Wallet className="w-4 h-4" />
        </div>
        <div className="text-xs text-slate-700 leading-relaxed">
          <strong className="block font-bold text-emerald-950 mb-0.5">
            Dica do Controle Financeiro:
          </strong>
          Os dados do chat são gerados em tempo real a partir da aba <em>Base de Dados</em> da sua
          planilha do Google Sheets, levando em conta categorias, valores, vencimentos e datas de compra.
        </div>
      </div>
    </div>
  );
};
