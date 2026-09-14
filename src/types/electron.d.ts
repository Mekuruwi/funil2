export interface ElectronAPI {
  // Regionais
  getRegionais: () => Promise<any[]>;
  importRegionais: (regionais: any[]) => Promise<number>;

  // Funil
  getFunil: () => Promise<any[]>;
  getFunilById: (id: number) => Promise<any>;
  insertFunil: (funil: any) => Promise<number>;
  updateFunil: (id: number, funil: any) => Promise<boolean>;
  updateFunilPhase: (id: number, fase: number) => Promise<boolean>;
  deleteFunil: (id: number) => Promise<boolean>;
  deleteFunis: (ids: number[]) => Promise<number>;
  importFunis: (funis: any[]) => Promise<number>;
  importObservacoes: (observacoes: any[]) => Promise<{ updated: number; ignored: number }>;

  // Observacoes
  addObservacao: (funilId: number, observacao: string, data?: string) => Promise<number>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
