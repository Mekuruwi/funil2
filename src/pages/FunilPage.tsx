import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Filter, Download, Search, Trash2, CheckSquare } from 'lucide-react';
import { exportToExcel as exportDataToExcel } from '../services/excelService';
import { useFunilStore } from '../store/funilStore';
import { FunilCard } from '../components/FunilCard';
import { FunilFormModal } from '../components/FunilFormModal';
import { FASES_FUNIL } from '../types';

export const FunilPage: React.FC = () => {
  const funis = useFunilStore(state => state.funis);
  const regionais = useFunilStore(state => state.regionais);
  const loading = useFunilStore(state => state.loading);
  const fetchFunis = useFunilStore(state => state.fetchFunis);
  const fetchRegionais = useFunilStore(state => state.fetchRegionais);
  const addFunil = useFunilStore(state => state.addFunil);
  const updateFunil = useFunilStore(state => state.updateFunil);
  const updateFunilPhase = useFunilStore(state => state.updateFunilPhase);
  const deleteFunil = useFunilStore(state => state.deleteFunil);
  const deleteFunis = useFunilStore(state => state.deleteFunis);
  const addObservacao = useFunilStore(state => state.addObservacao);
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingFunil, setEditingFunil] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [visibleCount, setVisibleCount] = useState(40);
  
  // Filters
  const [filters, setFilters] = useState({
    negocio: '',
    fase: '',
    responsavel: '',
    regional: '',
    carteira: '',
    search: '',
  });

  useEffect(() => {
    fetchFunis();
    fetchRegionais();
  }, []);

  const toggleCard = (id: number) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleEdit = (funil: any) => {
    setEditingFunil(funil);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja excluir este registro?')) {
      await deleteFunil(id);
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(selectedIds.size === filteredFunis.length
      ? new Set()
      : new Set(filteredFunis.map(funil => funil.id)));
  };

  const deleteSelected = async () => {
    if (!selectedIds.size || !confirm(`Excluir ${selectedIds.size} registro(s) selecionado(s)?`)) return;
    await deleteFunis(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const filteredFunis = useMemo(() => funis.filter(funil => {
    const negocio = String(funil.lumiax_genomica || '').toLowerCase();
    const responsavel = String(funil.responsavel || '').toLowerCase();
    const regional = String(funil.regional_cruzada || funil.regional || '').toLowerCase();
    const carteira = String(funil.carteira_cruzada || funil.carteira || '').toLowerCase();
    if (filters.negocio && !negocio.includes(filters.negocio.toLowerCase())) {
      return false;
    }
    if (filters.fase && Number(funil.fase) !== parseInt(filters.fase)) {
      return false;
    }
    if (filters.responsavel && !responsavel.includes(filters.responsavel.toLowerCase())) {
      return false;
    }
    if (filters.regional && !regional.includes(filters.regional.toLowerCase())) {
      return false;
    }
    if (filters.carteira && !carteira.includes(filters.carteira.toLowerCase())) {
      return false;
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const searchableFields = [
        funil.lumiax_genomica ,
        funil.nome_fantasia,
        funil.razao_social,
        funil.cnpj,
        funil.responsavel,
        funil.ev,
        funil.regional_cruzada || funil.regional,
        funil.carteira_cruzada || funil.carteira,
      ].join(' ').toLowerCase();
      if (!searchableFields.includes(searchLower)) {
        return false;
      }
    }
    return true;
  }), [funis, filters]);

  useEffect(() => {
    setVisibleCount(40);
  }, [filters, funis.length]);

  const visibleFunis = filteredFunis.slice(0, visibleCount);

  const exportToExcel = useCallback(() => {
    const selected = filteredFunis.filter(f => selectedIds.has(f.id));
    if (!selected.length) {
      alert('Selecione pelo menos um card para exportar.');
      return;
    }
    const data = selected.map(f => ({
      ID: f.id_cliente,
      Negócio: f.lumiax_genomica ,
      'Nome Fantasia': f.nome_fantasia,
      'Razão Social': f.razao_social,
      CNPJ: f.cnpj,
      Potencial: f.potencial,
      Fase: FASES_FUNIL.find(fase => fase.id === Number(f.fase))?.nome || `Fase ${f.fase || ''}`,
      Responsável: f.responsavel,
      Carteira: f.carteira_cruzada || f.carteira || '',
      Executivo: f.ev || f.executivo_regional || '',
      Coordenador: f.coordenador || f.coord_regional || '',
      Regional: f.regional_cruzada || f.regional || '',
      Observações: (f.observacoes || []).map(obs => `${String(obs.data).slice(0, 10).split('-').reverse().join('/')} - ${obs.observacao}`).join('\n'),
    }));
    
    exportDataToExcel(data, 'funil-selecionado.xlsx');
  }, [filteredFunis, selectedIds]);

  return (
    <div className="relative p-6 h-full overflow-y-auto">
      {loading && <div className="absolute inset-0 z-20 bg-[var(--bg-primary)] p-6"><div className="animate-pulse space-y-6"><div className="h-8 w-56 rounded bg-[var(--bg-secondary)]" /><div className="h-12 rounded-lg bg-[var(--bg-secondary)]" /><div className="h-24 rounded-lg bg-[var(--bg-secondary)]" /><div className="h-24 rounded-lg bg-[var(--bg-secondary)]" /></div></div>}
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Funil Comercial</h1>
        <button
          onClick={() => {
            setEditingFunil(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-color)] text-white rounded-lg hover:opacity-90"
        >
          <Plus size={20} />
          Novo Registro
        </button>
      </div>

      {/* Filters Toggle */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
            showFilters 
              ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)]'
              : 'border-[var(--border-color)] text-[var(--text-secondary)]'
          }`}
        >
          <Filter size={18} />
          Filtros
        </button>
        <button
          onClick={exportToExcel}
          className="flex items-center gap-2 px-4 py-2 border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-secondary)]"
        >
          <Download size={18} />
          Extrair
        </button>
        <button onClick={toggleAll} className="flex items-center gap-2 px-4 py-2 border border-[var(--border-color)] rounded-lg">
          <CheckSquare size={18} />
          {selectedIds.size === filteredFunis.length && filteredFunis.length > 0 ? 'Tirar seleção' : 'Selecionar todos'}
        </button>
        <button onClick={deleteSelected} disabled={!selectedIds.size} className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg disabled:opacity-50">
          <Trash2 size={18} /> Excluir selecionados
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="p-4 bg-[var(--bg-secondary)] rounded-lg mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Negócio"
            value={filters.negocio}
            onChange={(e) => setFilters(prev => ({ ...prev, negocio: e.target.value }))}
            className="px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
          />
          <select
            value={filters.fase}
            onChange={(e) => setFilters(prev => ({ ...prev, fase: e.target.value }))}
            className="px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
          >
            <option value="">Todas as Fases</option>
            {FASES_FUNIL.map(fase => (
              <option key={fase.id} value={fase.id}>{fase.nome}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Responsável"
            value={filters.responsavel}
            onChange={(e) => setFilters(prev => ({ ...prev, responsavel: e.target.value }))}
            className="px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
          />
          <input
            type="text"
            placeholder="Regional"
            value={filters.regional}
            onChange={(e) => setFilters(prev => ({ ...prev, regional: e.target.value }))}
            className="px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
          />
          <input
            type="text"
            placeholder="Carteira"
            value={filters.carteira}
            onChange={(e) => setFilters(prev => ({ ...prev, carteira: e.target.value }))}
            className="px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
          />
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} />
            <input
              type="text"
              placeholder="Buscar..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-10 pr-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
            />
          </div>
          <div className="flex justify-end mt-4">
            <button type="button" onClick={() => setFilters({ negocio: '', fase: '', responsavel: '', regional: '', carteira: '', search: '' })} className="px-4 py-2 text-sm rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Limpar filtros</button>
          </div>
          </div>
        </div>
      )}

      {/* Cards List */}
      <div className="space-y-4">
        {filteredFunis.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-secondary)]">
            Nenhum registro encontrado
          </div>
        ) : (
          visibleFunis.map(funil => (
            <FunilCard
              key={funil.id}
              funil={funil}
              isExpanded={expandedCards.has(funil.id)}
              onToggle={() => toggleCard(funil.id)}
              onEdit={() => handleEdit(funil)}
              onDelete={() => handleDelete(funil.id)}
              onPhaseChange={(fase) => updateFunilPhase(funil.id, fase)}
              selected={selectedIds.has(funil.id)}
              onSelect={() => toggleSelection(funil.id)}
              onAddObservation={(text, date) => addObservacao(funil.id, text, date)}
            />
          ))
        )}
        {visibleCount < filteredFunis.length && (
          <button
            type="button"
            onClick={() => setVisibleCount(count => Math.min(count + 40, filteredFunis.length))}
            className="w-full py-3 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Carregar mais ({filteredFunis.length - visibleCount} restantes)
          </button>
        )}
      </div>

      {/* Modal Novo/Editar */}
      <FunilFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingFunil(null);
        }}
        onSubmit={async (data) => {
          try {
            if (editingFunil) {
              await updateFunil(editingFunil.id, data);
            } else {
              await addFunil(data);
            }
            setIsModalOpen(false);
            setEditingFunil(null);
          } catch (error) {
            alert((error as Error).message || 'Não foi possível salvar o registro.');
          }
        }}
        regionais={regionais}
        editingFunil={editingFunil}
      />
    </div>
  );
};
