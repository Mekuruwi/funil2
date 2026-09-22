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
