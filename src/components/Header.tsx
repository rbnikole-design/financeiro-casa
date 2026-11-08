import React from 'react';
import { User } from 'firebase/auth';
import {
  PlusCircle,
  LayoutDashboard,
  RefreshCw,
  LogOut,
  Settings,
  CreditCard as CreditCardIcon,
  FileSpreadsheet,
  Sparkles,
  Layers,
  LogIn,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  activeTab: 'lancar' | 'resumo' | 'parcelas' | 'insights';
  onTabChange: (tab: 'lancar' | 'resumo' | 'parcelas' | 'insights') => void;
  user: User | null;
  onLogout: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenSettings: () => void;
  onOpenCardsManager: () => void;
  cardsCount: number;
  isSessionExpired?: boolean;
  onReconnect?: () => void;
  isLoggingIn?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  user,
  onLogout,
  onRefresh,
  isRefreshing,
  onOpenSettings,
  onOpenCardsManager,
  cardsCount,
  isSessionExpired = false,
  onReconnect,
  isLoggingIn = false,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-4xl mx-auto px-4 py-3 sm:px-6">
        {/* Top row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                Financeiro Casa
              </h1>
              <p className="text-xs text-slate-500 hidden sm:block">
                Controle de despesas & faturas
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            <PWAInstallButton />

            <button
              onClick={onOpenCardsManager}
              id="btn-manage-cards"
              title="Gerenciar Cartões"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-slate-200/80"
            >
              <CreditCardIcon className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Cartões</span>
              {cardsCount > 0 && (
                <span className="bg-slate-200 text-slate-700 text-[10px] font-semibold px-1.5 py-0.2 rounded-full">
                  {cardsCount}
                </span>
              )}
            </button>

            <button
              onClick={onRefresh}
              id="btn-refresh-data"
              disabled={isRefreshing}
              title="Recarregar dados da planilha"
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
            </button>

            <button
              onClick={onOpenSettings}
              id="btn-open-settings"
              title="Configurações da Planilha"
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>

            {isSessionExpired && onReconnect && (
              <button
                onClick={onReconnect}
                disabled={isLoggingIn}
                id="btn-reconnect-google"
                title="Sessão de 1h expirou por segurança. Toque para reconectar ao Google Sheets."
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{isLoggingIn ? 'Conectando...' : 'Reconectar'}</span>
              </button>
            )}

            <div className="h-5 w-px bg-slate-200 mx-1" />

            {user && (
              <div className="flex items-center gap-2">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Usuário'}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <button
                  onClick={onLogout}
                  id="btn-logout"
                  title="Sair"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab switchers */}
        <div className="mt-3 flex rounded-xl bg-slate-100 p-1 gap-1">
          <button
            onClick={() => onTabChange('lancar')}
            id="tab-lancar"
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'lancar'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PlusCircle className={`w-4 h-4 shrink-0 ${activeTab === 'lancar' ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span>Lançar</span>
          </button>

          <button
            onClick={() => onTabChange('resumo')}
            id="tab-resumo"
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'resumo'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className={`w-4 h-4 shrink-0 ${activeTab === 'resumo' ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span>Resumo</span>
          </button>

          <button
            onClick={() => onTabChange('parcelas')}
            id="tab-parcelas"
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'parcelas'
                ? 'bg-white text-indigo-950 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className={`w-4 h-4 shrink-0 ${activeTab === 'parcelas' ? 'text-indigo-600' : 'text-slate-400'}`} />
            <span>Parcelas</span>
          </button>

          <button
            onClick={() => onTabChange('insights')}
            id="tab-insights"
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs sm:text-sm font-semibold rounded-lg transition-all relative ${
              activeTab === 'insights'
                ? 'bg-white text-emerald-950 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className={`w-4 h-4 shrink-0 ${activeTab === 'insights' ? 'text-emerald-600 animate-pulse' : 'text-emerald-500'}`} />
            <span>Insights</span>
          </button>
        </div>
      </div>
    </header>
  );
};
