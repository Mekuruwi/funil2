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
  getSystemHealthMetrics: () => Promise<SystemHealthMetrics>;

  // Observacoes
  addObservacao: (funilId: number, observacao: string, data?: string) => Promise<number>;
}

export interface SystemHealthImport {
  id: number;
  operation: string;
  fileName: string | null;
  records: number;
  status: 'success' | 'warning' | 'error';
  errorMessage: string | null;
  createdAt: string;
}

export interface SystemHealthMetrics {
  databaseSizeBytes: number;
  databaseTables: Array<{ name: string; rows: number; sizeBytes: number }>;
  activeRecords: number;
  activeRecordsByTable: Array<{ name: string; rows: number }>;
  validationErrors: number;
  validationIssues: Array<{ code: string; label: string; table: string; count: number }>;
  recentImports: SystemHealthImport[];
  lastAccessAt: string | null;
  currentPeriodImports: number;
  latestOperation: {
    status: 'success' | 'warning' | 'error';
    operation: string;
    createdAt: string;
    errorMessage: string | null;
  } | null;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
