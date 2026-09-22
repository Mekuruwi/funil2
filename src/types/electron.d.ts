export interface ElectronAPI {
  database: {
    testConnection: (config: DatabaseConfig) => Promise<{ success: boolean; error?: string; info?: DatabaseInfo }>;
    getCurrentProvider: () => Promise<{ provider: DatabaseProvider; connected: boolean }>;
    switchProvider: (config: DatabaseConfig) => Promise<DatabaseInfo>;
    migrateData: (from: DatabaseConfig, to: DatabaseConfig) => Promise<{
      success: boolean;
      regionais?: number;
      funis?: number;
      error?: string;
    }>;
  };
  settings: {
    selectFolder: () => Promise<string | null>;
  };
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

export type DatabaseProvider = 'sqlite' | 'postgres' | 'mysql' | 'supabase' | 'turso';

export interface DatabaseConfig {
  provider: DatabaseProvider;
  filename?: string;
  connectionString?: string;
  authToken?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  ssl?: boolean;
}

export interface DatabaseInfo {
  provider: DatabaseProvider;
  connected: boolean;
  serverVersion?: string;
  databaseName?: string;
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
