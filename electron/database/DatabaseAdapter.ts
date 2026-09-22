import type {
  AddObservacaoDto,
  CreateFunilDto,
  DatabaseConfig,
  DatabaseInfo,
  SystemHealthMetrics,
  Filters,
  Funil,
  Observacao,
  Regional,
  Settings,
  UpdateFunilDto,
} from './types';

export interface DatabaseAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  testConnection(): Promise<DatabaseInfo>;

  getFunis(filters?: Filters): Promise<Funil[]>;
  getFunilById(id: number): Promise<Funil | null>;
  createFunil(data: CreateFunilDto): Promise<Funil>;
  importFunis(data: CreateFunilDto[]): Promise<number>;
  updateFunil(id: number, data: UpdateFunilDto): Promise<Funil>;
  deleteFunil(id: number): Promise<void>;
  updateFunilPhase(id: number, phase: number): Promise<void>;

  getRegionais(): Promise<Regional[]>;
  getRegionalById(id: number): Promise<Regional | null>;
  createRegional(data: Regional): Promise<number>;
  updateRegional(id: number, data: Regional): Promise<void>;
  deleteRegional(id: number): Promise<void>;
  clearRegionais(): Promise<void>;
  importRegionais(data: Regional[]): Promise<void>;
  deleteFunis(ids: number[]): Promise<void>;
  getObservacoes(funilId: number): Promise<Observacao[]>;
  addObservacao(funilId: number, data: AddObservacaoDto): Promise<Observacao>;
  getSettings(): Promise<Settings>;
  updateSettings(data: Partial<Settings>): Promise<void>;
  getDatabaseInfo(): Promise<DatabaseInfo>;
  getSystemHealthMetrics(): Promise<SystemHealthMetrics>;
  recordImportOperation(operation: string, records: number, status: 'success' | 'warning' | 'error', errorMessage?: string): Promise<void>;
}

export type DatabaseAdapterConfig = DatabaseConfig;
