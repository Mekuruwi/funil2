import React, { useEffect, useMemo, useState } from 'react';
import { Check, Filter, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { FilterKey, useFilterStore } from '../store/filterStore';
import { useFunilStore } from '../store/funilStore';
import { FASES_FUNIL } from '../types';

export const FiltersPage: React.FC = () => {
  const filters = useFilterStore(state => state.filters);
  const toggleFilter = useFilterStore(state => state.toggleFilter);
  const renameFilter = useFilterStore(state => state.renameFilter);
  const resetFilters = useFilterStore(state => state.resetFilters);
  const elementValues = useFilterStore(state => state.elementValues);
  const setElementValues = useFilterStore(state => state.setElementValues);
  const addElement = useFilterStore(state => state.addElement);
  const updateElement = useFilterStore(state => state.updateElement);
  const deleteElement = useFilterStore(state => state.deleteElement);
  const funis = useFunilStore(state => state.funis);
  const fetchFunis = useFunilStore(state => state.fetchFunis);
  const [selectedKey, setSelectedKey] = useState<FilterKey>('negocio');
  const [newValue, setNewValue] = useState('');
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  useEffect(() => { void fetchFunis(); }, [fetchFunis]);

  const sourceValues = useMemo(() => {
    const values: Record<FilterKey, string[]> = {
      negocio: funis.map(item => String(item.lumiax_genomica || '')),
      fase: FASES_FUNIL.map(item => item.nome),
      responsavel: funis.map(item => String(item.responsavel || '')),
      regional: funis.map(item => String(item.regional_cruzada || item.regional || '')),
      carteira: funis.map(item => String(item.carteira_cruzada || item.carteira || '')),
      executivo: funis.map(item => String(item.ev || item.executivo_regional || '')),
      search: [],
    };
    return Array.from(new Set(values[selectedKey].map(value => String(value || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [funis, selectedKey]);

  useEffect(() => {
    if (selectedKey !== 'search' && !elementValues[selectedKey]) setElementValues(selectedKey, sourceValues);
  }, [elementValues, selectedKey, setElementValues, sourceValues]);

  const values = elementValues[selectedKey] || sourceValues;
  const selectedFilter = filters.find(filter => filter.key === selectedKey);

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Configuração de filtros</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Ative filtros e gerencie os valores disponíveis em cada lista.
          </p>
        </div>
        <button
          type="button"
          onClick={resetFilters}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
        >
          <RotateCcw size={16} />
          Restaurar padrão
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(280px,0.8fr)_minmax(420px,1.4fr)]">
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <div className="border-b border-[var(--border-color)] p-4">
            <h2 className="font-semibold text-[var(--text-primary)]">Filtros disponíveis</h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">Selecione um filtro para gerenciar seus valores.</p>
          </div>
          {filters.map(filter => (
            <div key={filter.key} className={`flex items-center gap-3 border-b last:border-b-0 border-[var(--border-color)] p-3 ${selectedKey === filter.key ? 'bg-[var(--accent-color)]/10' : ''}`}>
              <button
                type="button"
                onClick={() => toggleFilter(filter.key)}
                aria-pressed={filter.enabled}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border ${
                  filter.enabled ? 'border-[var(--accent-color)] bg-[var(--accent-color)] text-white' : 'border-[var(--border-color)] text-transparent'
                }`}
              >
                <Check size={15} />
              </button>
              <button type="button" onClick={() => setSelectedKey(filter.key)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <Filter size={17} className="shrink-0 text-[var(--text-secondary)]" />
                <input
                  value={filter.label}
                  onClick={event => event.stopPropagation()}
                  onChange={event => renameFilter(filter.key, event.target.value)}
                  aria-label={`Nome do filtro ${filter.label}`}
                  className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none"
                />
              </button>
              <span className="text-[11px] text-[var(--text-secondary)]">{filter.enabled ? 'Ativo' : 'Inativo'}</span>
            </div>
          ))}
        </div>

        {selectedFilter && selectedKey !== 'search' ? (
          <section className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] p-4">
              <div>
                <h2 className="font-semibold text-[var(--text-primary)]">Valores de {selectedFilter.label}</h2>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">{values.length} valor(es) disponível(is)</p>
              </div>
              <Filter size={20} className="text-[var(--accent-color)]" />
            </div>
            <div className="p-4">
              <div className="flex gap-2">
                <input value={newValue} onChange={event => setNewValue(event.target.value)} placeholder={`Adicionar ${selectedFilter.label.toLowerCase()}`} className="min-w-0 flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)]" />
                <button type="button" onClick={() => { addElement(selectedKey, newValue); setNewValue(''); }} className="flex shrink-0 items-center gap-2 rounded-lg bg-[var(--accent-color)] px-4 py-2 text-white"><Plus size={16} /> Adicionar</button>
              </div>
              <div className="mt-4 max-h-[430px] overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
                {values.length === 0 && <p className="p-4 text-sm text-[var(--text-secondary)]">Nenhum valor cadastrado.</p>}
                {values.map(value => (
                  <div key={value} className="flex items-center gap-2 border-b last:border-b-0 border-[var(--border-color)] p-3">
                    {editingValue === value ? (
                      <input autoFocus value={editingText} onChange={event => setEditingText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { updateElement(selectedKey, value, editingText); setEditingValue(null); } }} className="min-w-0 flex-1 rounded border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2 py-1 text-[var(--text-primary)]" />
                    ) : <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-primary)]">{value}</span>}
                    <button type="button" aria-label={`Editar ${value}`} onClick={() => { setEditingValue(value); setEditingText(value); }} className="rounded p-2 text-[var(--text-secondary)] hover:text-[var(--accent-color)]"><Pencil size={16} /></button>
                    <button type="button" aria-label={`Excluir ${value}`} onClick={() => deleteElement(selectedKey, value)} className="rounded p-2 text-red-500 hover:bg-red-500/10"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-secondary)] p-6 text-center">
            <div>
              <Filter size={28} className="mx-auto text-[var(--accent-color)]" />
              <p className="mt-3 text-sm text-[var(--text-secondary)]">A busca livre não possui valores predefinidos.</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
