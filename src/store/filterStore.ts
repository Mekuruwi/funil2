import { create } from 'zustand';

export type FilterKey = 'negocio' | 'fase' | 'responsavel' | 'regional' | 'carteira' | 'executivo' | 'search';

export interface FilterDefinition {
  key: FilterKey;
  label: string;
  enabled: boolean;
}

const defaultFilters: FilterDefinition[] = [
  { key: 'negocio', label: 'Negócio', enabled: true },
  { key: 'fase', label: 'Fase', enabled: true },
  { key: 'responsavel', label: 'Responsável', enabled: true },
  { key: 'regional', label: 'Regional', enabled: true },
  { key: 'carteira', label: 'Carteira', enabled: true },
  { key: 'executivo', label: 'Executivo', enabled: true },
  { key: 'search', label: 'Busca livre', enabled: true },
];

interface FilterStore {
  filters: FilterDefinition[];
  elementValues: Partial<Record<FilterKey, string[]>>;
  toggleFilter: (key: FilterKey) => void;
  renameFilter: (key: FilterKey, label: string) => void;
  setElementValues: (key: FilterKey, values: string[]) => void;
  addElement: (key: FilterKey, value: string) => void;
  updateElement: (key: FilterKey, previous: string, value: string) => void;
  deleteElement: (key: FilterKey, value: string) => void;
  resetFilters: () => void;
}

const loadFilters = (): FilterDefinition[] => {
  if (typeof window === 'undefined') return defaultFilters;
  const saved = localStorage.getItem('funil-filters');
  if (!saved) return defaultFilters;
  try {
    const parsed = JSON.parse(saved) as FilterDefinition[];
    return defaultFilters.map(filter => parsed.find(item => item.key === filter.key) || filter);
  } catch {
    return defaultFilters;
  }
};

const loadElementValues = (): Partial<Record<FilterKey, string[]>> => {
  if (typeof window === 'undefined') return {};
  const saved = localStorage.getItem('funil-filter-elements');
  if (!saved) return {};
  try {
    return JSON.parse(saved) as Partial<Record<FilterKey, string[]>>;
  } catch {
    return {};
  }
};

const saveElementValues = (values: Partial<Record<FilterKey, string[]>>) => {
  localStorage.setItem('funil-filter-elements', JSON.stringify(values));
};

export const useFilterStore = create<FilterStore>((set) => ({
  filters: loadFilters(),
  elementValues: loadElementValues(),
  toggleFilter: (key) => set(state => {
    const filters = state.filters.map(filter =>
      filter.key === key ? { ...filter, enabled: !filter.enabled } : filter
    );
    localStorage.setItem('funil-filters', JSON.stringify(filters));
    return { filters };
  }),
  renameFilter: (key, label) => set(state => {
    const nextLabel = label.trim();
    if (!nextLabel) return state;
    const filters = state.filters.map(filter =>
      filter.key === key ? { ...filter, label: nextLabel } : filter
    );
    localStorage.setItem('funil-filters', JSON.stringify(filters));
    return { filters };
  }),
  setElementValues: (key, values) => set(state => {
    const elementValues = { ...state.elementValues, [key]: Array.from(new Set(values)).filter(Boolean) };
    saveElementValues(elementValues);
    return { elementValues };
  }),
  addElement: (key, value) => set(state => {
    const next = value.trim();
    if (!next) return state;
    const current = state.elementValues[key] || [];
    if (current.includes(next)) return state;
    const elementValues = { ...state.elementValues, [key]: [...current, next].sort((a, b) => a.localeCompare(b, 'pt-BR')) };
    saveElementValues(elementValues);
    return { elementValues };
  }),
  updateElement: (key, previous, value) => set(state => {
    const next = value.trim();
    if (!next) return state;
    const current = state.elementValues[key] || [];
    if (current.some(item => item === next && item !== previous)) return state;
    const elementValues = { ...state.elementValues, [key]: current.map(item => item === previous ? next : item) };
    saveElementValues(elementValues);
    return { elementValues };
  }),
  deleteElement: (key, value) => set(state => {
    const elementValues = { ...state.elementValues, [key]: (state.elementValues[key] || []).filter(item => item !== value) };
    saveElementValues(elementValues);
    return { elementValues };
  }),
  resetFilters: () => {
    localStorage.setItem('funil-filters', JSON.stringify(defaultFilters));
    localStorage.removeItem('funil-filter-elements');
    set({ filters: defaultFilters, elementValues: {} });
  },
}));
