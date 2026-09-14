import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

const DB_PATH = path.join(app.getPath('userData'), 'funil_comercial.db');

let database: Database.Database | null = null;

export function initializeDatabase(): Database.Database {
  if (database) return database;

  const db = new Database(DB_PATH);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create regionais table (dados vindos da base de regionais)
  db.exec(`
    CREATE TABLE IF NOT EXISTS regionais (
      id INTEGER PRIMARY KEY,
      ent_id_sap INTEGER,
      cnpj TEXT,
      raiz TEXT,
      nome_cliente TEXT,
      desc_representante TEXT,
      desc_regional_matriz TEXT,
      executivo TEXT,
      email TEXT,
      nome_coordenador TEXT
    )
  `);

  // Create funil table (dados vindos do forms)
  db.exec(`
    CREATE TABLE IF NOT EXISTS funil (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lumiax_genomica TEXT,
      responsavel TEXT,
      ticket_onboarding TEXT,
      id_cliente INTEGER,
      cnpj TEXT,
      razao_social TEXT,
      nome_fantasia TEXT,
      uf TEXT,
      regional TEXT,
      ev TEXT,
      carteira TEXT,
      coordenador TEXT,
      gerente TEXT,
      potencial REAL,
      fase TEXT,
      entrada_mapeamento TEXT,
      saida_mapeamento TEXT,
      sla_mapeamento INTEGER,
      entrada_proposta TEXT,
      saida_proposta TEXT,
      sla_proposta INTEGER,
      entrada_negociacao TEXT,
      saida_negociacao TEXT,
      sla_negociacao INTEGER,
      entrada_contrato TEXT,
      saida_contrato TEXT,
      sla_contrato INTEGER,
      entrada_implantacao TEXT,
      saida_implantacao TEXT,
      sla_implantacao INTEGER,
      entrada_acompanhamento TEXT,
      saida_acompanhamento TEXT,
      sla_acompanhamento INTEGER,
      entrada_declinou TEXT,
      saida_declinou TEXT,
      sla_declinou INTEGER,
      entrada_concluido TEXT,
      saida_concluido TEXT,
      sla_concluido INTEGER,
      observacao TEXT,
      historico TEXT,
      selecionados TEXT,
      data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
      data_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (id_cliente) REFERENCES regionais(id)
    )
  `);

  // Create observacoes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS observacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      funil_id INTEGER NOT NULL,
      data DATETIME DEFAULT CURRENT_TIMESTAMP,
      observacao TEXT NOT NULL,
      FOREIGN KEY (funil_id) REFERENCES funil(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_funil_id_cliente ON funil(id_cliente);
    CREATE INDEX IF NOT EXISTS idx_funil_fase ON funil(fase);
    CREATE INDEX IF NOT EXISTS idx_funil_cnpj ON funil(cnpj);
    CREATE INDEX IF NOT EXISTS idx_funil_data_criacao ON funil(data_criacao DESC);
    CREATE INDEX IF NOT EXISTS idx_funil_responsavel ON funil(responsavel);
    CREATE INDEX IF NOT EXISTS idx_funil_ev ON funil(ev);
    CREATE INDEX IF NOT EXISTS idx_funil_lumiax_genomica ON funil(lumiax_genomica);
    CREATE INDEX IF NOT EXISTS idx_regionais_cnpj ON regionais(cnpj);
    CREATE INDEX IF NOT EXISTS idx_regionais_cnpj_normalizado ON regionais(
      replace(replace(replace(replace(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
    );
    CREATE INDEX IF NOT EXISTS idx_observacoes_funil_id ON observacoes(funil_id);
    CREATE INDEX IF NOT EXISTS idx_observacoes_funil_data ON observacoes(funil_id, data DESC, id DESC);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS import_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation TEXT NOT NULL,
      file_name TEXT,
      records INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK (status IN ('success', 'warning', 'error')),
      error_message TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_import_operations_created_at
      ON import_operations(created_at DESC);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS system_access (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_access_at DATETIME NOT NULL
    );
  `);
  db.prepare(`
    INSERT INTO system_access (id, last_access_at) VALUES (1, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET last_access_at = excluded.last_access_at
  `).run();

  database = db;
  return db;
}

export function getDatabase(): Database.Database {
  return database || initializeDatabase();
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
  latestOperation: {
    status: 'success' | 'warning' | 'error';
    operation: string;
    createdAt: string;
    errorMessage: string | null;
  } | null;
}

export function recordImportOperation(
  operation: string,
  records: number,
  status: 'success' | 'warning' | 'error',
  fileName?: string,
  errorMessage?: string,
): void {
  getDatabase().prepare(`
    INSERT INTO import_operations (operation, file_name, records, status, error_message)
    VALUES (?, ?, ?, ?, ?)
  `).run(operation, fileName || null, records, status, errorMessage || null);
}

export function getSystemHealthMetrics(): SystemHealthMetrics {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO system_access (id, last_access_at) VALUES (1, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET last_access_at = excluded.last_access_at
  `).run();

  const activeRecords = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM regionais) + (SELECT COUNT(*) FROM funil) AS count
  `).get() as { count: number };
  const validationErrors = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM regionais
       WHERE COALESCE(TRIM(cnpj), '') = '' OR COALESCE(TRIM(nome_cliente), '') = '')
      + (SELECT COUNT(*) FROM funil
         WHERE id_cliente IS NOT NULL
           AND id_cliente > 0
           AND id_cliente NOT IN (SELECT id FROM regionais)) AS count
  `).get() as { count: number };
  const tableNames = ['regionais', 'funil', 'observacoes', 'import_operations', 'system_access'];
  const tableSizes = db.prepare(`
    SELECT name, COALESCE(SUM(pgsize), 0) AS sizeBytes
    FROM dbstat
    WHERE name IN (${tableNames.map(() => '?').join(',')})
    GROUP BY name
  `).all(...tableNames) as Array<{ name: string; sizeBytes: number }>;
  const databaseTables = tableNames.map((name) => ({
    name,
    rows: Number((db.prepare(`SELECT COUNT(*) AS count FROM "${name}"`).get() as { count: number }).count),
    sizeBytes: Number(tableSizes.find((table) => table.name === name)?.sizeBytes || 0),
  }));
  const activeRecordsByTable = databaseTables
    .filter((table) => table.name === 'regionais' || table.name === 'funil')
    .map(({ name, rows }) => ({ name, rows }));
  const validationIssues = [
    {
      code: 'regional-cnpj-missing',
      label: 'Regionais sem CNPJ',
      table: 'regionais',
      count: Number((db.prepare(`SELECT COUNT(*) AS count FROM regionais WHERE COALESCE(TRIM(cnpj), '') = ''`).get() as { count: number }).count),
    },
    {
      code: 'regional-name-missing',
      label: 'Regionais sem nome do cliente',
      table: 'regionais',
      count: Number((db.prepare(`SELECT COUNT(*) AS count FROM regionais WHERE COALESCE(TRIM(nome_cliente), '') = ''`).get() as { count: number }).count),
    },
    {
      code: 'funil-regional-not-found',
      label: 'Funis com regional não encontrada',
      table: 'funil',
      count: Number((db.prepare(`
        SELECT COUNT(*) AS count FROM funil
        WHERE id_cliente IS NOT NULL AND id_cliente > 0
          AND id_cliente NOT IN (SELECT id FROM regionais)
      `).get() as { count: number }).count),
    },
  ];
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const recentImports = db.prepare(`
    SELECT id, operation, file_name AS fileName, records, status,
           error_message AS errorMessage, created_at AS createdAt
    FROM import_operations
    ORDER BY created_at DESC, id DESC
    LIMIT 10
  `).all() as SystemHealthMetrics['recentImports'];
  const latestOperation = recentImports[0] || null;
  const lastAccess = db.prepare(
    'SELECT last_access_at AS lastAccessAt FROM system_access WHERE id = 1'
  ).get() as { lastAccessAt: string } | undefined;
  const currentPeriodImports = db.prepare(`
    SELECT COUNT(*) AS count FROM import_operations
    WHERE strftime('%Y-%m', created_at) = ?
  `).get(currentPeriod) as { count: number };

  return {
    databaseSizeBytes: fs.statSync(DB_PATH).size,
    databaseTables,
    activeRecords: Number(activeRecords.count),
    activeRecordsByTable,
    validationErrors: Number(validationErrors.count),
    validationIssues,
    recentImports,
    lastAccessAt: lastAccess?.lastAccessAt || null,
    currentPeriodImports: Number(currentPeriodImports.count),
    latestOperation: latestOperation
      ? {
          status: latestOperation.status,
          operation: latestOperation.operation,
          createdAt: latestOperation.createdAt,
          errorMessage: latestOperation.errorMessage,
        }
      : null,
  };
}
