import React, { useState } from 'react';
import { DEFAULT_SPREADSHEET_ID } from '../types';
import { Settings, ExternalLink, RefreshCw, X, CheckCircle, Database } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  spreadsheetId: string;
  onUpdateSpreadsheetId: (id: string) => void;
  onEnsureStructure: () => Promise<void>;
  sheetDetails: { title: string; sheetNames: string[] } | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  spreadsheetId,
  onUpdateSpreadsheetId,
  onEnsureStructure,
  sheetDetails,
}) => {
  const [tempId, setTempId] = useState(spreadsheetId);
  const [isFixing, setIsFixing] = useState(false);
  const [fixSuccess, setFixSuccess] = useState(false);

  if (!isOpen) return null;

  const handleFixStructure = async () => {
    setIsFixing(true);
    setFixSuccess(false);
    try {
      await onEnsureStructure();
      setFixSuccess(true);
      setTimeout(() => setFixSuccess(false), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsFixing(false);
    }
  };

  const handleSaveId = () => {
    if (tempId.trim()) {
      onUpdateSpreadsheetId(tempId.trim());
      onClose();
    }
  };

  const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-slate-100 shadow-2xl space-y-5 animate-scale-up">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Settings className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Configurações da Planilha</h3>
              <p className="text-xs text-slate-500">Integração Google Workspace</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Spreadsheet Link */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Planilha Conectada</span>
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <span>Abrir no Google Sheets</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {sheetDetails && (
            <div className="text-[11px] text-slate-600 space-y-1 pt-1 border-t border-slate-200/60">
              <div>Título: <strong>{sheetDetails.title}</strong></div>
              <div>
                Abas encontradas:{' '}
                <span className="text-slate-700 font-mono">
                  {sheetDetails.sheetNames.join(', ')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Spreadsheet ID Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            ID da Planilha (Google Sheets)
          </label>
          <input
            type="text"
            value={tempId}
            onChange={(e) => setTempId(e.target.value)}
            className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <p className="text-[10px] text-slate-400 mt-1">
            Padrão: <code className="bg-slate-100 px-1 py-0.5 rounded">{DEFAULT_SPREADSHEET_ID}</code>
          </p>
        </div>

        {/* Structure Validation */}
        <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs font-semibold text-emerald-950">
                Verificar Estrutura das Abas
              </span>
            </div>
            <button
              onClick={handleFixStructure}
              disabled={isFixing}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
            >
              {isFixing ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <span>Validar / Criar</span>
              )}
            </button>
          </div>
          {fixSuccess && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Abas "Base de Dados", "Cartões" e "Receitas" conferidas com sucesso!</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={handleSaveId}
            className="flex-1 h-10 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors"
          >
            Salvar ID
          </button>
        </div>
      </div>
    </div>
  );
};
