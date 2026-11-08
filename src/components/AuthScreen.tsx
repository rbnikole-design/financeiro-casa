import React from 'react';
import { ShieldCheck, TableProperties, ArrowRight, Lock } from 'lucide-react';

interface AuthScreenProps {
  onLogin: () => void;
  isLoading: boolean;
  error?: string | null;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin, isLoading, error }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 text-slate-800">
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-sm border border-emerald-100">
            <TableProperties className="w-8 h-8" />
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Financeiro Casa</h1>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            Controle financeiro doméstico sincronizado diretamente com sua planilha do Google Sheets.
          </p>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-200/70 space-y-3">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600">
              <strong className="text-slate-800 font-semibold block">Conexão Segura com Google Sheets</strong>
              Acesso seguro para ler e gravar despesas, cartões de crédito e receitas domésticas.
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600">
              Seus dados pertencem a você e ficam armazenados na sua própria planilha Google.
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl leading-relaxed">
            {error}
          </div>
        )}

        <button
          onClick={onLogin}
          disabled={isLoading}
          id="btn-google-signin"
          className="w-full h-13 flex items-center justify-center gap-3 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-medium text-sm rounded-2xl border border-slate-300 shadow-sm transition-all duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-slate-300 border-t-emerald-600 rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Entrar com Conta Google</span>
            </>
          )}
        </button>

        <div className="mt-8 text-center">
          <p className="text-[11px] text-slate-400">
            Aba autorizada: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono">spreadsheets</code>
          </p>
        </div>
      </div>
    </div>
  );
};
