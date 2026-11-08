import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, logout, getAccessToken, clearStoredToken } from './lib/firebase';
import {
  CreditCard,
  Revenue,
  ExpenseRow,
  DEFAULT_SPREADSHEET_ID,
  FormInstallmentPreview,
  PaymentType,
} from './types';
import {
  loadCreditCards,
  loadRevenues,
  loadExpenses,
  appendExpenseInstallments,
  batchUpdatePaidStatus,
  saveRevenue,
  getSpreadsheetDetails,
  ensureSheetStructure,
  addCreditCard,
  updateCreditCard,
  deleteCreditCard,
} from './lib/sheetsService';
import { formatMonthYear, getMonthSortValue } from './lib/dateUtils';
import { Header } from './components/Header';
import { AuthScreen } from './components/AuthScreen';
import { LancarForm } from './components/LancarForm';
import { ResumoDashboard } from './components/ResumoDashboard';
import { FinancialInsightsChat } from './components/FinancialInsightsChat';
import { InstallmentsView } from './components/InstallmentsView';
import { AddIncomeModal } from './components/AddIncomeModal';
import { ManageCardsModal } from './components/ManageCardsModal';
import { SettingsModal } from './components/SettingsModal';
import { AlertCircle, CheckCircle2, RefreshCw, LogIn, UserCheck, ShieldAlert } from 'lucide-react';

export default function App() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // App navigation
  const [activeTab, setActiveTab] = useState<'lancar' | 'resumo' | 'parcelas' | 'insights'>('lancar');

  // Spreadsheet state with offline caching
  const [spreadsheetId, setSpreadsheetId] = useState<string>(() => {
    return localStorage.getItem('fin_spreadsheet_id') || DEFAULT_SPREADSHEET_ID;
  });

  const [sheetDetails, setSheetDetails] = useState<{ title: string; sheetNames: string[] } | null>(null);
  const [creditCards, setCreditCards] = useState<CreditCard[]>(() => {
    try {
      const saved = localStorage.getItem('fin_cache_cards');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [revenues, setRevenues] = useState<Revenue[]>(() => {
    try {
      const saved = localStorage.getItem('fin_cache_revenues');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [expenses, setExpenses] = useState<ExpenseRow[]>(() => {
    try {
      const saved = localStorage.getItem('fin_cache_expenses');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return formatMonthYear(now.getFullYear(), now.getMonth() + 1);
  });

  // Loading and error states
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSavingExpense, setIsSavingExpense] = useState<boolean>(false);
  const [isUpdatingPaid, setIsUpdatingPaid] = useState<boolean>(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState<boolean>(false);
  const [incomeModalMonth, setIncomeModalMonth] = useState<string>(selectedMonth);
  const [isCardsModalOpen, setIsCardsModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isSavingCard, setIsSavingCard] = useState<boolean>(false);

  // Show temporary toast helper
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  // 1. Initialize Auth on Mount
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setIsAuthChecking(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setIsAuthChecking(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // 2. Fetch all spreadsheet data
  const fetchData = useCallback(
    async (showLoadingSpinner = true) => {
      const currentToken = await getAccessToken();
      if (!currentToken) return;

      if (showLoadingSpinner && expenses.length === 0) setIsLoadingData(true);
      else setIsRefreshing(true);
      setAppError(null);

      try {
        // First check spreadsheet details and ensure headers/tabs exist
        const details = await getSpreadsheetDetails(spreadsheetId, currentToken);
        setSheetDetails(details);

        // Load tabs in parallel
        const [cardsData, revenuesData, expensesData] = await Promise.all([
          loadCreditCards(spreadsheetId, currentToken),
          loadRevenues(spreadsheetId, currentToken),
          loadExpenses(spreadsheetId, currentToken),
        ]);

        setCreditCards(cardsData);
        setRevenues(revenuesData);
        setExpenses(expensesData);

        // Cache in localStorage for offline / instant load
        try {
          localStorage.setItem('fin_cache_cards', JSON.stringify(cardsData));
          localStorage.setItem('fin_cache_revenues', JSON.stringify(revenuesData));
          localStorage.setItem('fin_cache_expenses', JSON.stringify(expensesData));
          localStorage.setItem('fin_cache_time', String(Date.now()));
        } catch {}
      } catch (err: any) {
        console.error('Error fetching sheet data:', err);
        const rawMsg = err?.message || '';
        const lower = rawMsg.toLowerCase();

        if (
          rawMsg.includes('401') ||
          lower.includes('unauthenticated') ||
          lower.includes('invalid authentication credentials') ||
          lower.includes('invalid_grant') ||
          lower.includes('token expired')
        ) {
          clearStoredToken();
          setToken(null);
          setAppError(
            'Sua sessão de segurança de 1 hora com o Google Sheets expirou. Clique em "Reconectar Conta Google" para sincronizar com a planilha.'
          );
        } else if (
          rawMsg.includes('403') ||
          lower.includes('permission') ||
          lower.includes('caller does not have permission')
        ) {
          setAppError(
            `A conta Google conectada (${user?.email || 'atual'}) não tem permissão de Editor nesta planilha. Certifique-se de compartilhar a planilha com esse e-mail no Google Sheets com nível de "Editor".`
          );
        } else {
          setAppError(
            rawMsg || 'Falha ao carregar dados da planilha. Verifique as permissões de acesso e sua conexão.'
          );
        }
      } finally {
        setIsLoadingData(false);
        setIsRefreshing(false);
      }
    },
    [spreadsheetId, expenses.length, user?.email]
  );

  // Trigger data load when token becomes available
  useEffect(() => {
    if (token) {
      fetchData(true);
    }
  }, [token, fetchData]);

  // Available months list for selector: All distinct months from Base de Dados + current month
  const availableMonths = useMemo(() => {
    const set = new Set<string>();

    // Current month always included
    const now = new Date();
    set.add(formatMonthYear(now.getFullYear(), now.getMonth() + 1));

    expenses.forEach((e) => {
      if (e.month) set.add(e.month);
    });

    revenues.forEach((r) => {
      if (r.month) set.add(r.month);
    });

    return Array.from(set).sort((a, b) => getMonthSortValue(a) - getMonthSortValue(b));
  }, [expenses, revenues]);

  // Ensure selected month is in available months or reset to latest
  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[availableMonths.length - 1]);
    }
  }, [availableMonths, selectedMonth]);

  // Login handler
  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(
        err.message || 'Não foi possível completar o login com o Google. Tente novamente.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setCreditCards([]);
    setRevenues([]);
    setExpenses([]);
    try {
      localStorage.removeItem('fin_cache_cards');
      localStorage.removeItem('fin_cache_revenues');
      localStorage.removeItem('fin_cache_expenses');
    } catch {}
  };

  // Save new expense handler
  const handleSaveExpense = async (data: {
    description: string;
    group: string;
    paymentType: PaymentType;
    origin: string;
    purchaseDate?: string;
    installments: FormInstallmentPreview[];
  }) => {
    const currentToken = await getAccessToken();
    if (!currentToken) {
      showToast('Sessão expirada. Faça login novamente.');
      return;
    }

    setIsSavingExpense(true);
    setAppError(null);

    try {
      await appendExpenseInstallments(spreadsheetId, currentToken, data);
      showToast('Lançamento registrado com sucesso na planilha!');
      // Switch to Resumo or refresh
      await fetchData(false);
      if (data.installments.length > 0) {
        setSelectedMonth(data.installments[0].month);
      }
      setActiveTab('resumo');
    } catch (err: any) {
      console.error('Error saving expense:', err);
      setAppError(err.message || 'Erro ao gravar despesas na planilha.');
      throw err;
    } finally {
      setIsSavingExpense(false);
    }
  };

  // Toggle "Pago" status for all entries of an origin in the selected month
  const handleToggleOriginPaid = async (originName: string, targetPaidState: boolean) => {
    const currentToken = await getAccessToken();
    if (!currentToken) return;

    // 1. Find matching rows in selected month
    const matchingRows = expenses.filter(
      (e) => e.month === selectedMonth && e.origin === originName
    );

    if (matchingRows.length === 0) return;

    // 2. Optimistic UI update
    setExpenses((prev) =>
      prev.map((e) => {
        if (e.month === selectedMonth && e.origin === originName) {
          return { ...e, paid: targetPaidState };
        }
        return e;
      })
    );

    setIsUpdatingPaid(true);

    try {
      const updates = matchingRows.map((r) => ({
        rowIndex: r.rowIndex,
        paid: targetPaidState,
      }));

      await batchUpdatePaidStatus(spreadsheetId, currentToken, updates);
      showToast(
        targetPaidState
          ? `Pagamento de "${originName}" marcado como Pago!`
          : `Pagamento de "${originName}" desmarcado.`
      );
    } catch (err: any) {
      console.error('Error updating paid status:', err);
      showToast('Erro ao atualizar status na planilha. Revertendo...');
      // Revert on error
      await fetchData(false);
    } finally {
      setIsUpdatingPaid(false);
    }
  };

  // Save / Update Revenue
  const handleSaveRevenue = async (month: string, value: number, existingRowIndex?: number) => {
    const currentToken = await getAccessToken();
    if (!currentToken) return;

    try {
      await saveRevenue(spreadsheetId, currentToken, month, value, existingRowIndex);
      showToast(`Receita do mês ${month} gravada com sucesso!`);
      await fetchData(false);
    } catch (err: any) {
      console.error('Error saving revenue:', err);
      showToast('Erro ao salvar receita na planilha.');
      throw err;
    }
  };

  // Add Card handler
  const handleAddCard = async (card: CreditCard) => {
    const currentToken = await getAccessToken();
    if (!currentToken) return;

    setIsSavingCard(true);
    try {
      await addCreditCard(spreadsheetId, currentToken, card);
      showToast(`Cartão "${card.name}" cadastrado com sucesso!`);
      await fetchData(false);
    } catch (err: any) {
      console.error('Error adding card:', err);
      showToast(err.message || 'Erro ao adicionar cartão.');
    } finally {
      setIsSavingCard(false);
    }
  };

  // Update Card handler
  const handleUpdateCard = async (card: CreditCard, rowIndex: number) => {
    const currentToken = await getAccessToken();
    if (!currentToken) return;

    setIsSavingCard(true);
    try {
      await updateCreditCard(spreadsheetId, currentToken, rowIndex, card);
      showToast(`Cartão "${card.name}" atualizado com sucesso!`);
      await fetchData(false);
    } catch (err: any) {
      console.error('Error updating card:', err);
      showToast(err.message || 'Erro ao atualizar cartão.');
    } finally {
      setIsSavingCard(false);
    }
  };

  // Delete Card handler
  const handleDeleteCard = async (rowIndex: number) => {
    const currentToken = await getAccessToken();
    if (!currentToken) return;

    setIsSavingCard(true);
    try {
      await deleteCreditCard(spreadsheetId, currentToken, rowIndex);
      showToast('Cartão removido com sucesso!');
      await fetchData(false);
    } catch (err: any) {
      console.error('Error deleting card:', err);
      showToast(err.message || 'Erro ao remover cartão.');
    } finally {
      setIsSavingCard(false);
    }
  };

  // Change Spreadsheet ID
  const handleUpdateSpreadsheetId = (newId: string) => {
    setSpreadsheetId(newId);
    localStorage.setItem('fin_spreadsheet_id', newId);
    showToast('ID da planilha atualizado.');
    fetchData(true);
  };

  // Fix / Ensure Sheet Structure
  const handleEnsureStructure = async () => {
    const currentToken = await getAccessToken();
    if (!currentToken) return;
    await ensureSheetStructure(spreadsheetId, currentToken);
    await fetchData(false);
  };

  // Open Revenue Modal
  const handleOpenAddIncomeModal = (month: string) => {
    setIncomeModalMonth(month);
    setIsIncomeModalOpen(true);
  };

  // If not logged in and no user, show AuthScreen
  if (!token && !user && !isAuthChecking) {
    return <AuthScreen onLogin={handleLogin} isLoading={isLoggingIn} error={authError} />;
  }

  // Initial Auth checking spinner
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Verificando sessão...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 animate-slide-up border border-slate-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Global Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        user={user}
        onLogout={handleLogout}
        onRefresh={() => fetchData(false)}
        isRefreshing={isRefreshing}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenCardsManager={() => setIsCardsModalOpen(true)}
        cardsCount={creditCards.length}
        isSessionExpired={!token && !!user}
        onReconnect={handleLogin}
        isLoggingIn={isLoggingIn}
      />

      {/* 1-Hour Session Expiry Banner */}
      {!token && user && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 sm:px-6">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 text-xs text-amber-900">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <span className="truncate">
                Sua sessão do Google Sheets expirou após 1h. Toque para reconectar e salvar novos lançamentos.
              </span>
            </div>
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold rounded-lg shrink-0 cursor-pointer transition-colors shadow-xs"
            >
              {isLoggingIn ? 'Conectando...' : 'Reconectar'}
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:px-6">
        {/* Global Error Banner */}
        {appError && (
          <div className="mb-6 p-4.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl flex items-start gap-3.5 shadow-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <strong className="block font-bold text-rose-900 text-sm mb-0.5">
                {appError.includes('expirou')
                  ? 'Sessão com o Google Sheets expirou'
                  : appError.includes('permissão de Editor')
                  ? 'Permissão de acesso necessária'
                  : 'Atenção ao acessar a planilha'}
              </strong>
              <p className="leading-relaxed text-rose-700">{appError}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {appError.includes('expirou') ? (
                  <button
                    onClick={handleLogin}
                    disabled={isLoggingIn}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>{isLoggingIn ? 'Conectando...' : 'Reconectar Conta Google'}</span>
                  </button>
                ) : appError.includes('permissão de Editor') ? (
                  <>
                    <button
                      onClick={async () => {
                        await handleLogout();
                        await handleLogin();
                      }}
                      className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Trocar de Conta Google</span>
                    </button>
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-xl font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>Abrir Planilha no Google Drive</span>
                    </a>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => fetchData(true)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Tentar novamente</span>
                    </button>
                    <button
                      onClick={handleLogin}
                      className="px-3 py-1.5 bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-xl font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <LogIn className="w-3 h-3" />
                      <span>Reconectar Google</span>
                    </button>
                    <button
                      onClick={() => setIsSettingsModalOpen(true)}
                      className="px-3 py-1.5 bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-xl font-semibold transition-colors"
                    >
                      Conferir Planilha
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Loading Spinner for full data fetch */}
        {isLoadingData ? (
          <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center flex flex-col items-center justify-center gap-3 shadow-sm">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-slate-800">Carregando dados da planilha...</p>
            <p className="text-xs text-slate-400">Buscando lançamentos, cartões e receitas</p>
          </div>
        ) : (
          <>
            {activeTab === 'lancar' && (
              <LancarForm
                creditCards={creditCards}
                onSave={handleSaveExpense}
                isSaving={isSavingExpense}
                onOpenCardsManager={() => setIsCardsModalOpen(true)}
              />
            )}

            {activeTab === 'resumo' && (
              <ResumoDashboard
                selectedMonth={selectedMonth}
                onSelectMonth={setSelectedMonth}
                availableMonths={availableMonths}
                expenses={expenses}
                revenues={revenues}
                onOpenAddIncomeModal={handleOpenAddIncomeModal}
                onToggleOriginPaid={handleToggleOriginPaid}
                isUpdatingPaid={isUpdatingPaid}
                onNavigateToInsights={() => setActiveTab('insights')}
                onNavigateToParcelas={() => setActiveTab('parcelas')}
              />
            )}

            {activeTab === 'parcelas' && (
              <InstallmentsView
                expenses={expenses}
                creditCards={creditCards}
                selectedMonth={selectedMonth}
                onSelectMonth={setSelectedMonth}
                availableMonths={availableMonths}
                onNavigateToLancar={() => setActiveTab('lancar')}
              />
            )}

            {activeTab === 'insights' && (
              <FinancialInsightsChat
                expenses={expenses}
                revenues={revenues}
                creditCards={creditCards}
                selectedMonth={selectedMonth}
                onSelectMonth={setSelectedMonth}
                availableMonths={availableMonths}
              />
            )}
          </>
        )}
      </main>

      {/* Income Modal */}
      <AddIncomeModal
        isOpen={isIncomeModalOpen}
        onClose={() => setIsIncomeModalOpen(false)}
        month={incomeModalMonth}
        existingRevenue={revenues.find((r) => r.month === incomeModalMonth)}
        onSave={handleSaveRevenue}
      />

      {/* Cards Manager Modal */}
      <ManageCardsModal
        isOpen={isCardsModalOpen}
        onClose={() => setIsCardsModalOpen(false)}
        cards={creditCards}
        onAddCard={handleAddCard}
        onUpdateCard={handleUpdateCard}
        onDeleteCard={handleDeleteCard}
        isSaving={isSavingCard}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        spreadsheetId={spreadsheetId}
        onUpdateSpreadsheetId={handleUpdateSpreadsheetId}
        onEnsureStructure={handleEnsureStructure}
        sheetDetails={sheetDetails}
      />
    </div>
  );
}
