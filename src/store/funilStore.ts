import { create } from 'zustand';
import { FunilWithDetails, Regional } from '../types';

interface FunilState {
  funis: FunilWithDetails[];
  regionais: Regional[];
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchFunis: () => Promise<void>;
  fetchRegionais: () => Promise<void>;
  addFunil: (funil: any) => Promise<void>;
  updateFunil: (id: number, funil: any) => Promise<void>;
  updateFunilPhase: (id: number, fase: number) => Promise<void>;
  deleteFunil: (id: number) => Promise<void>;
  deleteFunis: (ids: number[]) => Promise<void>;
  addObservacao: (funilId: number, observacao: string, data?: string) => Promise<void>;
}

export const useFunilStore = create<FunilState>((set) => ({
  funis: [],
  regionais: [],
  loading: false,
  error: null,

  fetchFunis: async () => {
    set({ loading: true, error: null });
    try {
      const funis = await window.electronAPI.getFunil();
      set({ funis, loading: false });
    } catch (error) {
      set({ error: 'Erro ao buscar funis', loading: false });
    }
  },

  fetchRegionais: async () => {
    try {
      const regionais = await window.electronAPI.getRegionais();
      set({ regionais });
    } catch (error) {
      set({ error: 'Erro ao buscar regionais' });
    }
  },

  addFunil: async (funil) => {
    set({ error: null });
    try {
      const id = await window.electronAPI.insertFunil(funil);
      const created = await window.electronAPI.getFunilById(Number(id));
      if (created) set(state => ({ funis: [created, ...state.funis] }));
    } catch (error) {
      set({ error: 'Erro ao adicionar funil' });
      throw error;
    }
  },

  updateFunil: async (id, funil) => {
    set({ loading: true, error: null });
    try {
      await window.electronAPI.updateFunil(id, funil);
      const updated = await window.electronAPI.getFunilById(id);
      if (updated) set(state => ({ funis: state.funis.map(item => item.id === id ? updated : item) }));
      set({ loading: false });
    } catch (error) {
      set({ error: 'Erro ao atualizar funil', loading: false });
    }
  },

  updateFunilPhase: async (id, fase) => {
    try {
      await window.electronAPI.updateFunilPhase(id, fase);
      set(state => ({
        funis: state.funis.map(item => item.id === id ? { ...item, fase } : item),
      }));
    } catch (error) {
      set({ error: 'Erro ao atualizar fase' });
      throw error;
    }
  },

  deleteFunil: async (id) => {
    set({ loading: true, error: null });
    try {
      await window.electronAPI.deleteFunil(id);
      set(state => ({ funis: state.funis.filter(item => item.id !== id) }));
      set({ loading: false });
    } catch (error) {
      set({ error: 'Erro ao deletar funil', loading: false });
    }
  },

  deleteFunis: async (ids) => {
    set({ loading: true, error: null });
    try {
      await window.electronAPI.deleteFunis(ids);
      const deleted = new Set(ids);
      set(state => ({ funis: state.funis.filter(item => !deleted.has(item.id)) }));
      set({ loading: false });
    } catch (error) {
      set({ error: 'Erro ao deletar funis', loading: false });
      throw error;
    }
  },

  addObservacao: async (funilId, observacao, data) => {
    try {
      const id = await window.electronAPI.addObservacao(funilId, observacao, data);
      const observation = {
        id,
        funil_id: funilId,
        data: data || new Date().toISOString(),
        observacao,
      };
      set(state => ({
        funis: state.funis.map(funil => funil.id === funilId
          ? { ...funil, observacoes: [observation, ...(funil.observacoes || [])] }
          : funil),
      }));
    } catch (error) {
      set({ error: 'Erro ao adicionar observação' });
    }
  },
}));
