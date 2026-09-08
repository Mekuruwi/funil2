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
  deleteFunil: (id: number) => Promise<void>;
  addObservacao: (funilId: number, observacao: string) => Promise<void>;
}

export const useFunilStore = create<FunilState>((set, get) => ({
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
    set({ loading: true, error: null });
    try {
      await window.electronAPI.insertFunil(funil);
      await get().fetchFunis();
      set({ loading: false });
    } catch (error) {
      set({ error: 'Erro ao adicionar funil', loading: false });
    }
  },

  updateFunil: async (id, funil) => {
    set({ loading: true, error: null });
    try {
      await window.electronAPI.updateFunil(id, funil);
      await get().fetchFunis();
      set({ loading: false });
    } catch (error) {
      set({ error: 'Erro ao atualizar funil', loading: false });
    }
  },

  deleteFunil: async (id) => {
    set({ loading: true, error: null });
    try {
      await window.electronAPI.deleteFunil(id);
      await get().fetchFunis();
      set({ loading: false });
    } catch (error) {
      set({ error: 'Erro ao deletar funil', loading: false });
    }
  },

  addObservacao: async (funilId, observacao) => {
    try {
      await window.electronAPI.addObservacao(funilId, observacao);
      await get().fetchFunis();
    } catch (error) {
      set({ error: 'Erro ao adicionar observação' });
    }
  },
}));
