import type {
  AddObservacaoDto,
  CreateFunilDto,
  DatabaseConfig,
  DatabaseInfo,
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
  updateFunil(id: number, data: UpdateFunilDto): Promise<Funil>;
  deleteFunil(id: number): Promise<void>;
  updateFunilPhase(id: number, phase: number): Promise<void>;

  getRegionais(): Promise<Regional[]>;
  importRegionais(data: Regional[]): Promise<void>;
  getObservacoes(funilId: number): Promise<Observacao[]>;
  addObservacao(funilId: number, data: AddObservacaoDto): Promise<Observacao>;
  getSettings(): Promise<Settings>;
  updateSettings(data: Partial<Settings>): Promise<void>;
  getDatabaseInfo(): Promise<DatabaseInfo>;
}

export type DatabaseAdapterConfig = DatabaseConfig;
