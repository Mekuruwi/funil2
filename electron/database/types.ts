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

export interface Filters {
  fase?: string;
  responsavel?: string;
  regional?: string;
  search?: string;
}

export interface Funil {
  id: number;
  [key: string]: unknown;
}

export interface CreateFunilDto {
  [key: string]: unknown;
}

export type UpdateFunilDto = Partial<CreateFunilDto>;

export interface Regional {
  id?: number;
  [key: string]: unknown;
}

export interface Observacao {
  id: number;
  funil_id: number;
  data: string;
  observacao: string;
}

export interface AddObservacaoDto {
  observacao: string;
  data?: string;
}

export interface Settings {
  [key: string]: unknown;
}

export interface DatabaseInfo {
  provider: DatabaseProvider;
  connected: boolean;
  serverVersion?: string;
  databaseName?: string;
}

export interface SystemHealthMetrics {
  databaseSizeBytes: number;
  databaseTables: Array<{ name: string; rows: number; sizeBytes: number }>;
  activeRecords: number;
  activeRecordsByTable: Array<{ name: string; rows: number }>;
  validationErrors: number;
  validationIssues: Array<{ code: string; label: string; table: string; count: number }>;
  recentImports: Array<{
    id: number;
    operation: string;
    fileName: string | null;
    records: number;
    status: 'success' | 'warning' | 'error';
    errorMessage: string | null;
    createdAt: string;
  }>;
  lastAccessAt: string | null;
  currentPeriodImports: number;
  latestOperation: SystemHealthMetrics['recentImports'][number] | null;
}
