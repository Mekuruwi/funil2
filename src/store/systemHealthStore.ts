import { create } from 'zustand';
import { reportError } from '../utils/errorReporting';
import { SystemHealthMetrics } from '../types/electron';

interface SystemHealthState {
  metrics: SystemHealthMetrics | null;
  isLoading: boolean;
  error: string | null;
  fetchMetrics: () => Promise<void>;
}

export const useSystemHealthStore = create<SystemHealthState>((set) => ({
  metrics: null,
  isLoading: false,
  error: null,

  fetchMetrics: async () => {
    set({ isLoading: true, error: null });
    try {
      const metrics = await window.electronAPI.getSystemHealthMetrics();
      set({ metrics, isLoading: false });
    } catch (error) {
      reportError('Falha ao carregar métricas de saúde do sistema', error);
      set({ isLoading: false, error: error instanceof Error ? error.message : 'Não foi possível carregar a saúde do sistema.' });
    }
  },
}));
