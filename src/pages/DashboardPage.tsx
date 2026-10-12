import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useFunilStore } from '../store/funilStore';
import { FASES_FUNIL, FunilWithDetails } from '../types';
import { formatCurrencyBRL, calculateSLA, formatDate } from '../utils/formatters';
import { ArrowDown, ArrowUp, ArrowUpDown, TrendingUp, Users, FilePlus, X, Filter, Search } from 'lucide-react';
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
    search: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedHistorico, setSelectedHistorico] = useState<FunilWithDetails | null>(null);
  const [selectedDetailPhase, setSelectedDetailPhase] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
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
    fetchFunis().then(() => setLastUpdated(new Date()));
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
      && (!isFilterEnabled('fase') || !filters.fase || Number(funil.fase) === Number(filters.fase))
      && (!isFilterEnabled('search') || matches([
        funil.lumiax_genomica,
        funil.nome_fantasia,
        funil.razao_social,
        funil.cnpj,
        funil.responsavel,
        funil.ev || funil.executivo_regional,
        funil.regional_cruzada || funil.regional,
        funil.carteira_cruzada || funil.carteira,
      ].join(' '), filters.search));
  }), [funis, filters, filterDefinitions]);
  const filterSignature = JSON.stringify(filters);

  const stats = useMemo(() => {
    const open = filteredFunis.filter(item => ![7, 8].includes(Number(item.fase)));
    const completed = filteredFunis.filter(item => Number(item.fase) === 8);
    const declined = filteredFunis.filter(item => Number(item.fase) === 7);
    const potencialPorResponsavel = Array.from(new Set(open.map(funil => funil.responsavel || 'Não informado')))
      .map(responsavel => {
        const items = open.filter(funil => (funil.responsavel || 'Não informado') === responsavel);
        return { responsavel, total: items.reduce((sum, item) => sum + Number(item.potencial || 0), 0), count: items.length };
      }).sort((a, b) => b.total - a.total);
    const potencialPorFase = FASES_FUNIL.map(fase => {
      const items = filteredFunis.filter(funil => Number(funil.fase) === fase.id);
      return { fase: fase.id, total: items.reduce((sum, item) => sum + Number(item.potencial || 0), 0), count: items.length };
    }).filter(item => item.count > 0);
    return {
      totalPotencial: filteredFunis.reduce((sum, item) => sum + Number(item.potencial || 0), 0),
      totalCount: filteredFunis.length,
      openPotential: open.reduce((sum, item) => sum + Number(item.potencial || 0), 0),
      openCount: open.length,
      completedValue: completed.reduce((sum, item) => sum + Number(item.potencial || 0), 0),
      completedCount: completed.length,
      declinedValue: declined.reduce((sum, item) => sum + Number(item.potencial || 0), 0),
      declinedCount: declined.length,
      registeredCount: filteredFunis.length,
      potencialPorResponsavel,
      potencialPorFase,
    };
  }, [filteredFunis]);

  // Agrupar funis por fase
  const funisPorFase = FASES_FUNIL.map(fase => {
    const funisDaFase = filteredFunis.filter(f => Number(f.fase) === fase.id);
    const totalPotencial = funisDaFase.reduce((sum, f) => sum + Number(f.potencial || 0), 0);
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
  const activeDetailGroup = funisPorFase.find(fase => fase.id === selectedDetailPhase) || funisPorFase[0];

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
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Visão executiva do funil</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Acompanhamento comercial · Conjunto completo · Dados carregados {lastUpdated ? formatDate(lastUpdated.toISOString()) : 'ao carregar'}</p>
        </div>
      </div>

      {/* Filtros Globais */}
      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/60 p-2 transition-colors duration-200">
        {isFilterEnabled('search') && <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={16} />
          <input type="text" placeholder="Buscar no dashboard..." value={filters.search} onChange={event => setFilters(prev => ({ ...prev, search: event.target.value }))} className="w-full rounded-full border border-[var(--border-color)] bg-[var(--bg-primary)] py-2.5 pl-10 pr-4 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-color)] focus:ring-2 focus:ring-[var(--accent-color)]/10" />
        </div>}
        <button type="button" onClick={() => setShowFilters(value => !value)} aria-expanded={showFilters} className={`flex h-10 items-center gap-2 rounded-full border px-4 text-sm transition-colors ${showFilters ? 'border-[var(--accent-color)] bg-[var(--accent-color)] text-white' : 'border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'}`}>
          <Filter size={16} /> Filtros
        </button>
      </div>

      {showFilters && <div className="mb-6 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {isFilterEnabled('negocio') && <select value={filters.negocio} onChange={event => setFilters(prev => ({ ...prev, negocio: event.target.value }))} className="h-10 min-w-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]"><option value="">Todos os {filterLabel('negocio').toLowerCase()}s</option>{filterOptions.negocios.map(value => <option key={value} value={value}>{value}</option>)}</select>}
          {isFilterEnabled('executivo') && <select value={filters.executivo} onChange={event => setFilters(prev => ({ ...prev, executivo: event.target.value }))} className="h-10 min-w-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]"><option value="">Todos os {filterLabel('executivo').toLowerCase()}s</option>{filterOptions.executivos.map(value => <option key={value} value={value}>{value}</option>)}</select>}
          {isFilterEnabled('carteira') && <select value={filters.carteira} onChange={event => setFilters(prev => ({ ...prev, carteira: event.target.value }))} className="h-10 min-w-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]"><option value="">Todas as {filterLabel('carteira').toLowerCase()}s</option>{filterOptions.carteiras.map(value => <option key={value} value={value}>{value}</option>)}</select>}
          {isFilterEnabled('regional') && <select value={filters.regional} onChange={event => setFilters(prev => ({ ...prev, regional: event.target.value }))} className="h-10 min-w-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]"><option value="">Todas as {filterLabel('regional').toLowerCase()}s</option>{filterOptions.regionais.map(value => <option key={value} value={value}>{value}</option>)}</select>}
          {isFilterEnabled('fase') && <select value={filters.fase} onChange={event => setFilters(prev => ({ ...prev, fase: event.target.value }))} className="h-10 min-w-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]"><option value="">Todas as {filterLabel('fase').toLowerCase()}s</option>{FASES_FUNIL.map(fase => <option key={fase.id} value={fase.id}>{fase.nome}</option>)}</select>}
          {isFilterEnabled('responsavel') && <select value={filters.responsavel} onChange={event => setFilters(prev => ({ ...prev, responsavel: event.target.value }))} className="h-10 min-w-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]"><option value="">Todos os {filterLabel('responsavel').toLowerCase()}s</option>{filterOptions.responsaveis.map(value => <option key={value} value={value}>{value}</option>)}</select>}
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={() => setFilters({ negocio: '', regional: '', fase: '', responsavel: '', executivo: '', carteira: '', search: '' })} className="rounded-full border border-[var(--border-color)] bg-[var(--bg-primary)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Limpar filtros</button>
        </div>
      </div>}

      {/* Cards de Resumo */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
        <span className="font-semibold uppercase tracking-wide">Escopo:</span><span>{filteredFunis.length} negócios encontrados</span>
        {Object.entries(filters).filter(([, value]) => Boolean(value)).map(([key, value]) => <span key={key} className="rounded-full border border-[var(--border-color)] px-2.5 py-1">{filterLabel(key)}: {value}</span>)}
        {filteredFunis.length !== funis.length && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">Visão filtrada</span>}
      </div>
      <FadeIn key={`summary-${filterSignature}`} className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={<TrendingUp size={24} />} title="Potencial em aberto" value={formatCurrencyBRL(stats.openPotential)} color="green" detail={`${stats.openCount} negócios nas fases ativas`} />
        <SummaryCard icon={<FilePlus size={24} />} title="Concluídos · total" value={formatCurrencyBRL(stats.completedValue)} color="blue" detail={`${stats.completedCount} negócios no conjunto`} />
        <SummaryCard icon={<X size={24} />} title="Declinados · total" value={formatCurrencyBRL(stats.declinedValue)} color="purple" detail={`${stats.declinedCount} negócios no conjunto`} />
        <SummaryCard icon={<Users size={24} />} title="Total de negócios" value={stats.registeredCount} color="blue" detail="Conjunto completo no recorte atual" />
      </FadeIn>

      <section className="mb-6 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-[var(--text-primary)]">Pipeline em aberto</h2>
          <span className="text-sm text-[var(--text-secondary)]">{stats.openCount} negócios · {formatCurrencyBRL(stats.openPotential)}</span>
        </div>
        <div className="grid gap-x-8 gap-y-2 md:grid-cols-2">
          {FASES_FUNIL.filter(fase => fase.id <= 6).map(fase => {
            const items = filteredFunis.filter(item => Number(item.fase) === fase.id);
            const amount = items.reduce((sum, item) => sum + Number(item.potencial || 0), 0);
            const slaValues = items.map(item => {
              const recordedSla = Number(item[SLA_FIELDS[fase.id - 1]]);
              return recordedSla > 0 ? recordedSla : calculateSLA(item.data_criacao, item.fase);
            }).filter(value => Number.isFinite(value) && value > 0);
            const averageSla = slaValues.length ? Math.round(slaValues.reduce((sum, value) => sum + value, 0) / slaValues.length) : null;
            const max = Math.max(1, ...stats.potencialPorFase.filter(item => item.fase <= 6).map(item => item.total));
            return <div key={fase.id} className="grid grid-cols-[minmax(85px,1fr)_minmax(35px,0.8fr)_2rem_minmax(62px,auto)_auto] items-center gap-2 border-b border-[var(--border-color)]/60 py-2 last:border-0 sm:grid-cols-[minmax(120px,1fr)_minmax(60px,1.3fr)_2.5rem_minmax(74px,auto)_auto] sm:gap-3">
              <span className="truncate text-sm text-[var(--text-primary)]">{fase.nome}</span>
              <div className="h-1.5 rounded-full bg-[var(--bg-secondary)]"><div className="h-1.5 rounded-full bg-[var(--accent-color)]" style={{ width: `${Math.min(100, amount / max * 100)}%` }} /></div>
              <span className="text-right text-xs text-[var(--text-secondary)]">{items.length}</span>
              <span className="whitespace-nowrap text-right text-xs text-[var(--text-secondary)]" title="SLA médio da fase">{averageSla === null ? 'Média —' : `Média ${averageSla} d`}</span>
              <span className="text-right text-sm font-medium text-[var(--text-primary)]">{formatCurrencyBRL(amount)}</span>
            </div>;
          })}
        </div>
        <div className="mt-4 border-t border-[var(--border-color)] pt-3">
          <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Potencial em aberto por responsável</h3>
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {stats.potencialPorResponsavel.slice(0, 5).map(item => <div key={item.responsavel} className="flex min-w-0 items-center justify-between gap-3 py-1 text-sm"><span className="truncate text-[var(--text-secondary)]" title={item.responsavel}>{item.responsavel}</span><span className="shrink-0 font-medium text-[var(--text-primary)]">{formatCurrencyBRL(item.total)}</span></div>)}
          </div>
          {stats.potencialPorResponsavel.length > 5 && <p className="mt-1 text-xs text-[var(--text-secondary)]">Outros {stats.potencialPorResponsavel.length - 5}: {formatCurrencyBRL(stats.potencialPorResponsavel.slice(5).reduce((sum, item) => sum + item.total, 0))}</p>}
        </div>
        <div className="mt-4 border-t border-[var(--border-color)] pt-3">
          <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Negócios para revisar</h3>
          {(() => { const oldest = [...filteredFunis].filter(item => Number(item.fase) <= 6).sort((a, b) => Number(getSortValue(b, 'sla')) - Number(getSortValue(a, 'sla'))).slice(0, 3); return oldest.length ? <ul className="grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">{oldest.map(item => <li key={item.id} className="min-w-0 text-sm"><span className="block truncate text-[var(--text-primary)]" title={item.nome_fantasia || item.razao_social || item.lumiax_genomica}>{item.nome_fantasia || item.razao_social || item.lumiax_genomica}</span><span className="text-xs text-[var(--text-secondary)]">{FASES_FUNIL.find(f => f.id === Number(item.fase))?.nome} · {getSortValue(item, 'sla')} dias · {item.responsavel || 'Sem responsável'}</span></li>)}</ul> : <p className="text-sm text-[var(--text-secondary)]">Nenhum negócio ativo neste recorte.</p>; })()}
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-[var(--text-primary)]">Detalhamento por negócios</h2>
          <span className="text-sm text-[var(--text-secondary)]">{filteredFunis.length} negócios</span>
        </div>
        <div role="tablist" aria-label="Selecionar fase dos negócios" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          {FASES_FUNIL.map(fase => {
            const count = filteredFunis.filter(item => Number(item.fase) === fase.id).length;
            const selected = activeDetailGroup?.id === fase.id;
            return <button key={fase.id} type="button" role="tab" aria-selected={selected} disabled={count === 0} onClick={() => setSelectedDetailPhase(fase.id)} className={`rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${selected ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/10' : 'border-[var(--border-color)] bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)]'}`}>
              <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{fase.nome}</span>
              <span className="mt-1 block text-xs text-[var(--text-secondary)]">{count} {count === 1 ? 'negócio' : 'negócios'}</span>
            </button>;
          })}
        </div>
        {activeDetailGroup ? <FadeIn key={`table-${filterSignature}-${activeDetailGroup.id}`} className="overflow-hidden rounded-lg border border-[var(--border-color)]">
        {(() => { const fase = activeDetailGroup; return (
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
        ); })()}
        </FadeIn> : <p className="rounded-lg bg-[var(--bg-secondary)] p-5 text-sm text-[var(--text-secondary)]">Nenhum negócio encontrado com os filtros selecionados.</p>}
      </section>

    </div>
  );
};

interface SummaryCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  color: 'green' | 'blue' | 'purple';
  detail?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ icon, title, value, color, detail }) => {
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
        {detail && <p className="mt-1 text-xs text-[var(--text-secondary)]">{detail}</p>}
      </div>
    </div>
  );
};
