import React, { useState } from 'react';
import { CreditCard } from '../types';
import { CreditCard as CardIcon, Plus, X, AlertCircle, Edit2, Trash2, Check, Info } from 'lucide-react';

interface ManageCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: CreditCard[];
  onAddCard: (card: CreditCard) => Promise<void>;
  onUpdateCard?: (card: CreditCard, rowIndex: number) => Promise<void>;
  onDeleteCard?: (rowIndex: number) => Promise<void>;
  isSaving: boolean;
}

export const ManageCardsModal: React.FC<ManageCardsModalProps> = ({
  isOpen,
  onClose,
  cards,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  isSaving,
}) => {
  // New Card State
  const [name, setName] = useState('');
  const [dueDay, setDueDay] = useState(10);
  const [closingDay, setClosingDay] = useState(3);
  const [showAddForm, setShowAddForm] = useState(false);

  // Edit Card State
  const [editingCardIndex, setEditingCardIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDueDay, setEditDueDay] = useState(10);
  const [editClosingDay, setEditClosingDay] = useState(3);

  if (!isOpen) return null;

  const handleStartEdit = (card: CreditCard, index: number) => {
    setEditingCardIndex(index);
    setEditName(card.name);
    setEditDueDay(card.dueDay);
    setEditClosingDay(card.closingDay);
    setShowAddForm(false);
  };

  const handleCancelEdit = () => {
    setEditingCardIndex(null);
  };

  const handleSaveEdit = async (rowIndex?: number) => {
    if (!editName.trim() || !onUpdateCard || rowIndex === undefined) return;

    await onUpdateCard(
      {
        name: editName.trim(),
        dueDay: Math.max(1, Math.min(31, editDueDay)),
        closingDay: Math.max(1, Math.min(31, editClosingDay)),
        rowIndex,
      },
      rowIndex
    );

    setEditingCardIndex(null);
  };

  const handleDelete = async (rowIndex?: number, cardName?: string) => {
    if (!onDeleteCard || rowIndex === undefined) return;
    if (window.confirm(`Tem certeza que deseja remover o cartão "${cardName}"?`)) {
      await onDeleteCard(rowIndex);
      if (editingCardIndex !== null) setEditingCardIndex(null);
    }
  };

  const handleSubmitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await onAddCard({
      name: name.trim(),
      dueDay: Math.max(1, Math.min(31, dueDay)),
      closingDay: Math.max(1, Math.min(31, closingDay)),
    });

    setName('');
    setShowAddForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-slate-100 shadow-2xl space-y-4 animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <CardIcon className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Gerenciar Cartões</h3>
              <p className="text-xs text-slate-500">Dias de fechamento e vencimento</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informative explanation banner */}
        <div className="p-3 bg-emerald-50/80 rounded-2xl border border-emerald-200/80 text-xs text-emerald-900 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Regra de Fechamento:</strong> Compras feitas no dia do fechamento ou após ele entram automaticamente na fatura do mês seguinte (melhor dia de compra).
          </p>
        </div>

        {/* Existing Cards List */}
        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
          {cards.length > 0 ? (
            cards.map((card, index) => {
              const isEditing = editingCardIndex === index;

              if (isEditing) {
                return (
                  <div
                    key={card.name + index}
                    className="p-3.5 bg-emerald-50/40 rounded-2xl border-2 border-emerald-500/60 space-y-3"
                  >
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Nome do Cartão (Titular)
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Dia Fechamento (F)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={editClosingDay}
                          onChange={(e) => setEditClosingDay(parseInt(e.target.value, 10) || 1)}
                          className="w-full h-8 px-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Dia Vencimento (V)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={editDueDay}
                          onChange={(e) => setEditDueDay(parseInt(e.target.value, 10) || 1)}
                          className="w-full h-8 px-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="flex-1 h-8 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={isSaving || !editName.trim()}
                        onClick={() => handleSaveEdit(card.rowIndex)}
                        className="flex-1 h-8 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Salvar</span>
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={card.name + index}
                  className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 truncate">{card.name}</h4>
                    <div className="flex items-center gap-2 text-[11px] text-slate-600 mt-0.5">
                      <span>
                        Fecha: dia <strong className="text-slate-900">{card.closingDay}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Vence: dia <strong className="text-slate-900">{card.dueDay}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {onUpdateCard && (
                      <button
                        type="button"
                        title="Editar dia de fechamento ou vencimento"
                        onClick={() => handleStartEdit(card, index)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {onDeleteCard && card.rowIndex && (
                      <button
                        type="button"
                        title="Remover cartão"
                        onClick={() => handleDelete(card.rowIndex, card.name)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/70 text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>Nenhum cartão cadastrado na aba "Cartões". Cadastre abaixo:</span>
            </div>
          )}
        </div>

        {/* Add Card Form Toggle / Form */}
        {showAddForm ? (
          <form onSubmit={handleSubmitNew} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold text-slate-800">Novo Cartão</h4>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Cartão - Titular
              </label>
              <input
                type="text"
                placeholder="Ex: Itaú [Henrique], Nubank [Nikole]"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Dia Fechamento (F)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={closingDay}
                  onChange={(e) => setClosingDay(parseInt(e.target.value, 10) || 1)}
                  required
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 text-center font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Dia Vencimento (V)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={dueDay}
                  onChange={(e) => setDueDay(parseInt(e.target.value, 10) || 1)}
                  required
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 text-center font-bold"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 h-9 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving || !name.trim()}
                className="flex-1 h-9 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? 'Salvando...' : 'Adicionar Cartão'}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setShowAddForm(true);
              setEditingCardIndex(null);
            }}
            className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Cadastrar Novo Cartão</span>
          </button>
        )}

        <button
          onClick={onClose}
          className="w-full h-10 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};
