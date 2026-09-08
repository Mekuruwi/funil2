export interface ElectronAPI {
  // Regionais
  getRegionais: () => Promise<any[]>;
  getRegionalById: (id: number) => Promise<any>;
  insertRegional: (regional: any) => Promise<number>;
  updateRegional: (id: number, regional: any) => Promise<boolean>;
  deleteRegional: (id: number) => Promise<boolean>;

  // Funil
  getFunil: () => Promise<any[]>;
  getFunilById: (id: number) => Promise<any>;
  insertFunil: (funil: any) => Promise<number>;
  updateFunil: (id: number, funil: any) => Promise<boolean>;
  deleteFunil: (id: number) => Promise<boolean>;

  // Observacoes
  addObservacao: (funilId: number, observacao: string) => Promise<number>;
  getObservacoesByFunilId: (funilId: number) => Promise<any[]>;

  // Dashboard
  getDashboardStats: (filters: any) => Promise<{
    totalPotencial: number;
    totalCount: number;
    newItemsThisMonth: number;
    potencialPorResponsavel: any[];
    potencialPorFase: any[];
  }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
