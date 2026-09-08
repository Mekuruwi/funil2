import React, { useState, useEffect } from 'react';
import { Plus, Filter, Download, Search } from 'lucide-react';
import { useFunilStore } from '../store/funilStore';
import { FunilCard } from '../components/FunilCard';
import { FunilFormModal } from '../components/FunilFormModal';
import { FASES_FUNIL } from '../types';

export const FunilPage: React.FC = () => {
  const { funis, regionais, fetchFunis, fetchRegionais, addFunil, updateFunil, deleteFunil } = useFunilStore();
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingFunil, setEditingFunil] = useState<any>(null);
  
  // Filters
  const [filters, setFilters] = useState({
    negocio: '',
    fase: '',
    responsavel: '',
    regional: '',
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

  const filteredFunis = funis.filter(funil => {
    if (filters.negocio && !funil.negocio.toLowerCase().includes(filters.negocio.toLowerCase())) {
      return false;
    }
    if (filters.fase && funil.fase !== parseInt(filters.fase)) {
      return false;
    }
    if (filters.responsavel && !funil.responsavel.toLowerCase().includes(filters.responsavel.toLowerCase())) {
      return false;
    }
    if (filters.regional && !funil.regional?.toLowerCase().includes(filters.regional.toLowerCase())) {
      return false;
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const searchableFields = [
        funil.negocio,
        funil.nome_fantasia,
        funil.razao_social,
        funil.cnpj,
        funil.responsavel,
      ].join(' ').toLowerCase();
      if (!searchableFields.includes(searchLower)) {
        return false;
      }
    }
    return true;
  });

  const exportToExcel = () => {
    // Implementação básica - em produção usaria xlsx
    const data = filteredFunis.map(f => ({
      ID: f.id_cliente,
      Negócio: f.negocio,
      'Nome Fantasia': f.nome_fantasia,
      'Razão Social': f.razao_social,
      CNPJ: f.cnpj,
      Potencial: f.potencial,
      Fase: FASES_FUNIL.find(fase => fase.id === f.fase)?.nome,
      Responsável: f.responsavel,
      Regional: f.regional,
    }));
    
    console.log('Exportando para Excel:', data);
    alert('Funcionalidade de exportação pronta para implementação com xlsx');
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
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
      <div className="flex gap-2 mb-4">
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
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 p-4 bg-[var(--bg-secondary)] rounded-lg mb-6">
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
        </div>
      )}

      {/* Cards List */}
      <div className="space-y-4">
        {filteredFunis.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-secondary)]">
            Nenhum registro encontrado
          </div>
        ) : (
          filteredFunis.map(funil => (
            <FunilCard
              key={funil.id}
              funil={funil}
              isExpanded={expandedCards.has(funil.id)}
              onToggle={() => toggleCard(funil.id)}
              onEdit={() => handleEdit(funil)}
              onDelete={() => handleDelete(funil.id)}
            />
          ))
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
          if (editingFunil) {
            await updateFunil(editingFunil.id, data);
          } else {
            await addFunil(data);
          }
          setIsModalOpen(false);
          setEditingFunil(null);
        }}
        regionais={regionais}
        editingFunil={editingFunil}
      />
    </div>
  );
};
