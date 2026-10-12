import type {
  FunilImportInput,
  FunilInput,
  FunilWithDetails,
  ObservationImportInput,
  RegionalImportInput,
  Regional,
} from './index';

export interface ElectronAPI {
  logError: (context: string, message: string, stack?: string) => Promise<void>;
  windowControls: {
    minimize: () => Promise<void>;
    toggleMaximize: () => Promise<void>;
    toggleFullscreen: () => Promise<void>;
    close: () => Promise<void>;
    editCommand: (command: 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll') => Promise<void>;
  };
  database: {
    testConnection: (config: DatabaseConfig) => Promise<{ success: boolean; error?: string; info?: DatabaseInfo }>;
    getCurrentProvider: () => Promise<{ provider: DatabaseProvider; connected: boolean }>;
    getCurrentConfig: () => Promise<DatabaseConfig>;
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
    getDocumentSettings: () => Promise<DocumentSettings>;
    selectDocumentTemplate: (kind: 'proposal' | 'contract' | 'addendum') => Promise<string | null>;
    selectDocumentOutputFolder: () => Promise<string | null>;
    saveDocumentSettings: (settings: DocumentSettings) => Promise<DocumentSettings>;
    importPriceCatalog: (rows: PriceCatalogRow[]) => Promise<{ count: number }>;
    generateDocuments: (request: DocumentGenerationRequest) => Promise<{ files: string[] }>;
  };
  // Regionais
  getRegionais: () => Promise<Regional[]>;
  importRegionais: (regionais: RegionalImportInput[]) => Promise<number>;

  // Funil
  getFunil: () => Promise<FunilWithDetails[]>;
  getFunilById: (id: number) => Promise<FunilWithDetails | null>;
  insertFunil: (funil: FunilInput) => Promise<number>;
  updateFunil: (id: number, funil: FunilInput) => Promise<boolean>;
  replaceFunilResponsavel: (currentName: string, nextName: string) => Promise<number>;
  bulkUpdateFunil: (request: FunilBulkUpdate) => Promise<number>;
  updateFunilPhase: (id: number, fase: number) => Promise<boolean>;
  deleteFunil: (id: number) => Promise<boolean>;
  deleteFunis: (ids: number[]) => Promise<number>;
  importFunis: (funis: FunilImportInput[]) => Promise<number>;
  importObservacoes: (observacoes: ObservationImportInput[]) => Promise<{ updated: number; ignored: number }>;
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

export interface DocumentSettings {
  templates: { proposal: string | null; contract: string | null; addendum: string | null };
  outputFolder: string | null;
  priceCatalog: PriceCatalogRow[];
  priceCatalogName: string | null;
  responsibleContacts: ResponsibleContact[];
}

export interface ResponsibleContact {
  name: string;
  email: string;
  phone: string;
}

export type FunilBulkField = 'responsavel' | 'regional' | 'carteira' | 'ev' | 'coordenador' | 'gerente' | 'lumiax_genomica' | 'uf';
export type FunilBulkOperator = 'equals' | 'contains' | 'startsWith' | 'isEmpty' | 'isNotEmpty';

export interface FunilBulkCondition {
  field: FunilBulkField;
  operator: FunilBulkOperator;
  value?: string;
}

export interface FunilBulkUpdate {
  field: FunilBulkField;
  newValue: string;
  conditions: FunilBulkCondition[];
}

export interface PriceCatalogRow {
  exam: string;
  order: number;
  service: string;
  baseValue: number;
}

export interface DocumentGenerationRequest {
  funil: FunilWithDetails;
  documents: Array<'proposal' | 'contract' | 'addendum'>;
  formats: Array<'editable' | 'pdf'>;
  overrides?: { municipio?: string; endereco?: string; uf?: string; email?: string; telefone?: string; rdi?: boolean; mtg?: boolean };
  priceOverrides?: Record<string, number>;
  templateOverrides?: Partial<DocumentSettings['templates']>;
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
