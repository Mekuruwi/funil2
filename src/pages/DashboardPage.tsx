import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useFunilStore } from '../store/funilStore';
import { FASES_FUNIL, FunilWithDetails } from '../types';
import { formatCurrencyBRL, calculateSLA, formatDate } from '../utils/formatters';
import { ArrowDown, ArrowUp, ArrowUpDown, TrendingUp, Users, FilePlus, X } from 'lucide-react';
import { useFilterStore } from '../store/filterStore';
import { FadeIn } from '../components/FadeIn';

const SLA_FIELDS = [
  'sla_mapeamento',
  'sla_proposta',
  'sla_negociacao',
  'sla_contrato',
  'sla_implantacao',
  'sla_acompanhamento',
  'sla_declinou',
  'sla_concluido',
] as const;

type SortKey = 'negocio' | 'responsavel' | 'nomeFantasia' | 'regional' | 'potencial' | 'sla';
type SortDirection = 'asc' | 'desc';
type HeaderAlignment = 'left' | 'center' | 'right';

const getSortValue = (funil: FunilWithDetails, key: SortKey): string | number => {
  switch (key) {
    case 'negocio':
      return String(funil.lumiax_genomica || '');
    case 'responsavel':
      return String(funil.responsavel || '');
    case 'nomeFantasia':
      return String(funil.nome_fantasia || funil.razao_social || '');
    case 'regional':
      return String(funil.regional_cruzada || funil.regional || '');
    case 'potencial':
      return Number(funil.potencial || 0);
    case 'sla': {
      const sla = Number(funil[SLA_FIELDS[Number(funil.fase) - 1]]);
      return sla > 0 ? sla : calculateSLA(funil.data_criacao, funil.fase);
    }
  }
};

const formatTimelineDate = (value: string) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : formatDate(value).split(',')[0];
};

const LoadingSkeleton: React.FC = () => (
  <div className="absolute inset-0 z-20 bg-[var(--bg-primary)] p-6">
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-56 rounded bg-[var(--bg-secondary)]" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-10 rounded-lg bg-[var(--bg-secondary)]" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-28 rounded-lg bg-[var(--bg-secondary)]" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }, (_, index) => <div key={index} className="h-56 rounded-lg bg-[var(--bg-secondary)]" />)}
      </div>
    </div>
  </div>
);

export const DashboardPage: React.FC = () => {
  const fetchFunis = useFunilStore(state => state.fetchFunis);
  const funis = useFunilStore(state => state.funis);
  const loading = useFunilStore(state => state.loading);
  const filterDefinitions = useFilterStore(state => state.filters);
  const elementValues = useFilterStore(state => state.elementValues);
  const isFilterEnabled = (key: string) => filterDefinitions.some(filter => filter.key === key && filter.enabled);
  const filterLabel = (key: string) => filterDefinitions.find(filter => filter.key === key)?.label || key;
  const [filters, setFilters] = useState({
    negocio: '',
    regional: '',
    fase: '',
    responsavel: '',
    executivo: '',
    carteira: '',
  });
  const [selectedHistorico, setSelectedHistorico] = useState<FunilWithDetails | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'potencial',
    direction: 'desc',
  });
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Element;
      if (selectedHistorico && dashboardRef.current && (!dashboardRef.current.contains(target) || !target.closest('[data-history-card]'))) {
        setSelectedHistorico(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [selectedHistorico]);

  useEffect(() => {
    fetchFunis();
  }, []);

  const filterOptions = useMemo(() => {
    const distinct = (values: unknown[]) => Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return {
      negocios: elementValues.negocio || distinct(funis.map(funil => funil.lumiax_genomica)),
      executivos: elementValues.executivo || distinct(funis.map(funil => funil.ev || funil.executivo_regional)),
      carteiras: elementValues.carteira || distinct(funis.map(funil => funil.carteira_cruzada || funil.carteira)),
      regionais: elementValues.regional || distinct(funis.map(funil => funil.regional_cruzada || funil.regional)),
      responsaveis: elementValues.responsavel || distinct(funis.map(funil => funil.responsavel)),
    };
  }, [funis, elementValues]);

  const filteredFunis = useMemo(() => funis.filter(funil => {
    const matches = (value: unknown, filter: string) => !filter || String(value || '').toLowerCase().includes(filter.toLowerCase());
    return (!isFilterEnabled('negocio') || matches(funil.lumiax_genomica, filters.negocio))
      && (!isFilterEnabled('regional') || matches(funil.regional_cruzada || funil.regional, filters.regional))
      && (!isFilterEnabled('responsavel') || matches(funil.responsavel, filters.responsavel))
      && (!isFilterEnabled('executivo') || matches(funil.ev || funil.executivo_regional, filters.executivo))
      && (!isFilterEnabled('carteira') || matches(funil.carteira_cruzada || funil.carteira, filters.carteira))
      && (!isFilterEnabled('fase') || !filters.fase || Number(funil.fase) === Number(filters.fase));
  }), [funis, filters, filterDefinitions]);
  const filterSignature = JSON.stringify(filters);

  const stats = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const potencialPorResponsavel = Array.from(new Set(filteredFunis.map(funil => funil.responsavel || 'Não informado')))
      .map(responsavel => {
        const items = filteredFunis.filter(funil => (funil.responsavel || 'Não informado') === responsavel);
        return { responsavel, total: items.reduce((sum, item) => sum + Number(item.potencial || 0), 0), count: items.length };
      }).sort((a, b) => b.total - a.total);
    const potencialPorFase = FASES_FUNIL.map(fase => {
      const items = filteredFunis.filter(funil => Number(funil.fase) === fase.id);
      return { fase: fase.id, total: items.reduce((sum, item) => sum + Number(item.potencial || 0), 0), count: items.length };
    }).filter(item => item.count > 0);
    return {
      totalPotencial: filteredFunis.reduce((sum, item) => sum + Number(item.potencial || 0), 0),
      totalCount: filteredFunis.length,
      newItemsThisMonth: filteredFunis.filter(item => String(item.data_criacao || '').slice(0, 7) === currentMonth).length,
      potencialPorResponsavel,
      potencialPorFase,
    };
  }, [filteredFunis]);

  // Agrupar funis por fase
  const funisPorFase = FASES_FUNIL.map(fase => {
    const funisDaFase = filteredFunis.filter(f => Number(f.fase) === fase.id);
    const totalPotencial = funisDaFase.reduce((sum, f) => sum + f.potencial, 0);
    const slaValues = funisDaFase.map(funil => Number((funil as any)[SLA_FIELDS[fase.id - 1]])).filter(value => Number.isFinite(value) && value > 0);
    const slaMedio = slaValues.length > 0
      ? Math.round(slaValues.reduce((sum, value) => sum + value, 0) / slaValues.length)
      : 0;

    const sortedFunis = [...funisDaFase].sort((a, b) => {
      const valueA = getSortValue(a, sort.key);
      const valueB = getSortValue(b, sort.key);
      const comparison = typeof valueA === 'number' && typeof valueB === 'number'
        ? valueA - valueB
        : String(valueA).localeCompare(String(valueB), 'pt-BR', { sensitivity: 'base' });

      return (sort.direction === 'asc' ? comparison : -comparison) || a.id - b.id;
    });

    return {
      ...fase,
      count: funisDaFase.length,
      totalPotencial,
      slaMedio,
      funis: sortedFunis,
    };
  }).filter(f => f.count > 0);

  const handleSort = (key: SortKey) => {
    setSort(current => ({
      key,
      direction: current.key === key
        ? current.direction === 'asc' ? 'desc' : 'asc'
        : key === 'potencial' ? 'desc' : 'asc',
    }));
  };

  const sortIndicator = (key: SortKey) => {
    if (sort.key !== key) return <ArrowUpDown size={14} aria-hidden="true" />;
    return sort.direction === 'asc'
      ? <ArrowUp size={14} aria-hidden="true" />
      : <ArrowDown size={14} aria-hidden="true" />;
  };

  const sortableHeader = (label: string, key: SortKey, alignment: HeaderAlignment) => (
    <th
      scope="col"
      aria-sort={sort.key === key ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}
      className={`px-4 py-3 ${alignment === 'right' ? 'text-right' : alignment === 'center' ? 'text-center' : 'text-left'} text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider`}
    >
      <button
        type="button"
        onClick={() => handleSort(key)}
        className={`inline-flex items-center gap-1 ${alignment === 'right' ? 'ml-auto' : alignment === 'center' ? 'mx-auto' : ''} hover:text-[var(--text-primary)]`}
        aria-label={`Ordenar por ${label}`}
      >
        {label}
        {sortIndicator(key)}
      </button>
    </th>
  );

  return (
    <div ref={dashboardRef} className="relative p-6 h-full overflow-y-auto">
      {loading && <LoadingSkeleton />}
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Dashboard</h1>

      {/* Filtros Globais */}
      <div className="p-4 bg-[var(--bg-secondary)] rounded-lg mb-6 transition-colors duration-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isFilterEnabled('negocio') && <select
          value={filters.negocio}
          onChange={(e) => setFilters(prev => ({ ...prev, negocio: e.target.value }))}
          className="px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] transition-all duration-200 ease-in-out focus:border-[var(--accent-color)] focus:ring-2 focus:ring-[var(--accent-color)]/20"
        >
          <option value="">Todos os {filterLabel('negocio').toLowerCase()}s</option>
          {filterOptions.negocios.map(value => <option key={value} value={value}>{value}</option>)}
        </select>}
        {isFilterEnabled('executivo') && <select
          value={filters.executivo}
          onChange={(e) => setFilters(prev => ({ ...prev, executivo: e.target.value }))}
          className="px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
        >
          <option value="">Todos os {filterLabel('executivo').toLowerCase()}s</option>
          {filterOptions.executivos.map(value => <option key={value} value={value}>{value}</option>)}
        </select>}
        {isFilterEnabled('carteira') && <select
          value={filters.carteira}
          onChange={(e) => setFilters(prev => ({ ...prev, carteira: e.target.value }))}
          className="px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
        >
          <option value="">Todas as {filterLabel('carteira').toLowerCase()}s</option>
          {filterOptions.carteiras.map(value => <option key={value} value={value}>{value}</option>)}
        </select>}
        {isFilterEnabled('regional') && <select
          value={filters.regional}
          onChange={(e) => setFilters(prev => ({ ...prev, regional: e.target.value }))}
          className="px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
        >
          <option value="">Todas as {filterLabel('regional').toLowerCase()}s</option>
          {filterOptions.regionais.map(value => <option key={value} value={value}>{value}</option>)}
        </select>}
        {isFilterEnabled('fase') && <select
          value={filters.fase}
          onChange={(e) => setFilters(prev => ({ ...prev, fase: e.target.value }))}
          className="px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
        >
          <option value="">Todas as {filterLabel('fase').toLowerCase()}s</option>
          {FASES_FUNIL.map(fase => (
            <option key={fase.id} value={fase.id}>{fase.nome}</option>
          ))}
        </select>}
        {isFilterEnabled('responsavel') && <select
          value={filters.responsavel}
          onChange={(e) => setFilters(prev => ({ ...prev, responsavel: e.target.value }))}
          className="px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
        >
          <option value="">Todos os {filterLabel('responsavel').toLowerCase()}s</option>
          {filterOptions.responsaveis.map(value => <option key={value} value={value}>{value}</option>)}
        </select>}
        <button
          type="button"
          onClick={() => setFilters({ negocio: '', regional: '', fase: '', responsavel: '', executivo: '', carteira: '' })}
          className="px-3 py-2 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] active:translate-y-0"
        >
          Limpar filtros
        </button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <FadeIn key={`summary-${filterSignature}`} className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <SummaryCard
          icon={<TrendingUp size={24} />}
          title="Valor Total do Potencial"
          value={formatCurrencyBRL(stats?.totalPotencial || 0)}
          color="green"
        />
        <SummaryCard
          icon={<FilePlus size={24} />}
          title="Quantidade Total de Itens"
          value={stats?.totalCount || 0}
          color="blue"
        />
        <SummaryCard
          icon={<Users size={24} />}
          title="Novos Itens no Mês"
          value={stats?.newItemsThisMonth || 0}
          color="purple"
        />
      </FadeIn>

      <details className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-5 mb-8">
        <summary className="cursor-pointer text-lg font-semibold text-[var(--text-primary)]">SLA médio por fase</summary>
        <div className="divide-y divide-[var(--border-color)] mt-3">
        {FASES_FUNIL.map(fase => {
          const items = filteredFunis.filter(funil => Number(funil.fase) === fase.id);
          const values = items.map(funil => Number((funil as any)[SLA_FIELDS[fase.id - 1]])).filter(value => Number.isFinite(value) && value > 0);
          const average = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
          return <div key={fase.id} className="flex items-center justify-between py-2.5"><span className="text-sm text-[var(--text-secondary)]">{fase.nome}</span><span className="font-semibold text-[var(--accent-color)]">{average > 0 ? `${average} dias` : 'Sem dados'}</span></div>;
        })}
        </div>
        </details>

      {/* Gráficos/Métricas */}
      <FadeIn key={`charts-${filterSignature}`} className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Potencial por Responsável */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Potencial por Responsável</h3>
          <div className="space-y-3">
            {stats?.potencialPorResponsavel?.slice(0, 5).map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">{item.responsavel}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-[var(--bg-secondary)] rounded-full h-2">
                    <div 
                      className="bg-[var(--accent-color)] h-2 rounded-full"
                      style={{ 
                        width: `${stats.potencialPorResponsavel[0]?.total ? (item.total / stats.potencialPorResponsavel[0].total) * 100 : 0}%` 
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium text-[var(--text-primary)] w-24 text-right">
                    {formatCurrencyBRL(item.total)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Potencial por Fase */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Potencial por Fase</h3>
          <div className="space-y-3">
            {stats?.potencialPorFase?.map((item: any, idx: number) => {
              const faseId = Number(item.fase);
              const faseNome = FASES_FUNIL.find(f => f.id === faseId)?.nome || `Fase ${item.fase}`;
              return (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">{faseNome}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-[var(--bg-secondary)] rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          faseId <= 3 ? 'bg-yellow-500' :
                          faseId <= 5 ? 'bg-blue-500' :
                          faseId === 8 ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        style={{ 
                          width: `${stats.potencialPorFase.reduce((max: any, i: any) => Math.max(max, i.total), 0) ? (item.total / stats.potencialPorFase.reduce((max: any, i: any) => Math.max(max, i.total), 0)) * 100 : 0}%` 
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-[var(--text-primary)] w-24 text-right">
                      {formatCurrencyBRL(item.total)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </FadeIn>

      {/* Tabela Agrupada por Fase */}
      <FadeIn key={`table-${filterSignature}`} className="space-y-6">
        {funisPorFase.map(fase => (
          <div key={fase.id} className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg overflow-hidden transition-shadow duration-200 hover:shadow-sm">
            {/* Resumo do Grupo */}
            <div className="p-4 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    fase.id <= 3 ? 'bg-yellow-100 text-yellow-800' :
                    fase.id <= 5 ? 'bg-blue-100 text-blue-800' :
                    fase.id === 8 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {fase.nome}
                  </span>
                  <span className="text-sm text-[var(--text-secondary)]">
                    {fase.count} {fase.count === 1 ? 'item' : 'itens'}
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <span className="font-semibold text-[var(--text-primary)]">
                    Total: {formatCurrencyBRL(fase.totalPotencial)}
                  </span>
                  <span className="text-sm text-[var(--text-secondary)]">
                    SLA Médio: {fase.slaMedio} dias
                  </span>
                </div>
              </div>
            </div>

            {/* Tabela */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--bg-secondary)]">
                  <tr>
                    {sortableHeader('Negócio', 'negocio', 'left')}
                    {sortableHeader('Responsável', 'responsavel', 'left')}
                    {sortableHeader('Nome Fantasia', 'nomeFantasia', 'left')}
                    {sortableHeader('Regional', 'regional', 'left')}
                    {sortableHeader('Potencial', 'potencial', 'right')}
                    {sortableHeader('SLA', 'sla', 'center')}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {fase.funis.map(funil => (
                    <React.Fragment key={funil.id}>
                    <tr
                      data-history-card
                      onClick={() => setSelectedHistorico(selectedHistorico?.id === funil.id ? null : funil)}
                      className={`cursor-pointer transition-colors duration-200 hover:bg-[var(--bg-secondary)] ${selectedHistorico?.id === funil.id ? 'bg-[var(--bg-secondary)]' : ''}`}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">{funil.lumiax_genomica }</td>
                      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{funil.responsavel}</td>
                      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{funil.nome_fantasia || funil.razao_social || '-'}</td>
                      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{funil.regional || '-'}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-[var(--text-primary)]">
                        {formatCurrencyBRL(funil.potencial)}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-[var(--text-secondary)]">
                        {Number((funil as any)[SLA_FIELDS[Number(funil.fase) - 1]]) > 0
                          ? `${Number((funil as any)[SLA_FIELDS[Number(funil.fase) - 1]])} dias`
                          : `${calculateSLA(funil.data_criacao, funil.fase)} dias`}
                      </td>
                    </tr>
                    {selectedHistorico?.id === funil.id && (
                      <tr>
                        <td data-history-card colSpan={6} className="px-6 py-4 bg-[var(--bg-secondary)] border-t border-[var(--border-color)]">
                          <FadeIn>
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="font-semibold text-[var(--text-primary)]">Linha do tempo</h4>
                              <button type="button" onClick={() => setSelectedHistorico(null)} className="p-1 rounded transition-colors duration-200 hover:bg-[var(--border-color)]" title="Fechar histórico">
                                <X size={16} className="text-[var(--text-secondary)]" />
                              </button>
                            </div>
                            {funil.observacoes && funil.observacoes.length > 0 ? (
                              <div className="relative ml-2 border-l-2 border-[var(--accent-color)] space-y-4">
                                {funil.observacoes.map(obs => (
                                  <div key={obs.id} className="relative pl-6">
                                    <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-[var(--accent-color)] ring-4 ring-[var(--bg-secondary)]" />
                                    <p className="text-xs font-medium text-[var(--accent-color)]">{formatTimelineDate(obs.data)}</p>
                                    <p className="text-sm text-[var(--text-primary)]">{obs.observacao}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-[var(--text-secondary)]">Nenhum histórico registrado.</p>
                            )}
                          </FadeIn>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </FadeIn>

    </div>
  );
};

interface SummaryCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  color: 'green' | 'blue' | 'purple';
}

const SummaryCard: React.FC<SummaryCardProps> = ({ icon, title, value, color }) => {
  const colorClasses = {
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30',
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30',
  };

  return (
    <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-6 flex items-center gap-4">
      <div className={`p-4 rounded-lg ${colorClasses[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-[var(--text-secondary)]">{title}</p>
        <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
      </div>
    </div>
  );
};
