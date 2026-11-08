import React, { useState } from 'react';
import { Revenue } from '../types';
import { formatCurrency, parseCurrencyInput } from '../lib/dateUtils';
import { Wallet, X, Check } from 'lucide-react';

interface AddIncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  month: string;
  existingRevenue?: Revenue;
  onSave: (month: string, value: number, rowIndex?: number) => Promise<void>;
}

export const AddIncomeModal: React.FC<AddIncomeModalProps> = ({
  isOpen,
  onClose,
  month,
  existingRevenue,
  onSave,
}) => {
  const [valueStr, setValueStr] = useState<string>(
    existingRevenue ? String(existingRevenue.value).replace('.', ',') : ''
  );
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseCurrencyInput(valueStr);
    if (parsed <= 0) return;

    setIsSaving(true);
    try {
      await onSave(month, parsed, existingRevenue?.rowIndex);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 border border-slate-100 shadow-2xl space-y-5 animate-scale-up">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Receita do Mês</h3>
              <p className="text-xs text-slate-500">Mês de referência: {month}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Valor da Receita Líquida (R$)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 text-sm font-semibold">
                R$
              </span>
              <input
                type="text"
                placeholder="0,00"
                value={valueStr}
                onChange={(e) => setValueStr(e.target.value)}
                autoFocus
                required
                className="w-full h-11 pl-10 pr-3.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Os dados serão gravados na aba "Receitas" da planilha.
            </p>
          </div>

          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 h-11 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || parseCurrencyInput(valueStr) <= 0}
              className="flex-1 h-11 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Salvar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
