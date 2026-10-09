import { createClient, type Client, type InValue } from '@libsql/client';
import type { DatabaseAdapter } from './DatabaseAdapter';
import type { AddObservacaoDto, CreateFunilDto, DatabaseConfig, DatabaseInfo, Filters, Funil, Observacao, Regional, Settings, SystemHealthMetrics, UpdateFunilDto } from './types';

const columns = ['lumiax_genomica', 'responsavel', 'ticket_onboarding', 'id_cliente', 'cnpj', 'razao_social', 'nome_fantasia', 'uf', 'regional', 'ev', 'carteira', 'coordenador', 'gerente', 'potencial', 'fase', 'entrada_mapeamento', 'saida_mapeamento', 'sla_mapeamento', 'entrada_proposta', 'saida_proposta', 'sla_proposta', 'entrada_negociacao', 'saida_negociacao', 'sla_negociacao', 'entrada_contrato', 'saida_contrato', 'sla_contrato', 'entrada_implantacao', 'saida_implantacao', 'sla_implantacao', 'entrada_acompanhamento', 'saida_acompanhamento', 'sla_acompanhamento', 'entrada_declinou', 'saida_declinou', 'sla_declinou', 'entrada_concluido', 'saida_concluido', 'sla_concluido', 'observacao', 'historico', 'selecionados'] as const;
const tableSizeColumns: Record<string, string[]> = {
  regionais: ['id', 'ent_id_sap', 'cnpj', 'raiz', 'nome_cliente', 'desc_representante', 'desc_regional_matriz', 'executivo', 'email', 'nome_coordenador'],
  funil: ['id', ...columns, 'data_criacao', 'data_atualizacao'],
  observacoes: ['id', 'funil_id', 'data', 'observacao'],
  import_operations: ['id', 'operation', 'file_name', 'records', 'status', 'error_message', 'created_at'],
  system_access: ['id', 'last_access_at'],
};

export class TursoAdapter implements DatabaseAdapter {
  private readonly config: DatabaseConfig;
  private readonly client: Client;
  private connected = false;

  constructor(config: DatabaseConfig) {
    if (!config.connectionString || !config.authToken) throw new Error('Turso exige a URL do banco e um token de autenticação.');
    this.config = config;
    this.client = createClient({ url: config.connectionString, authToken: config.authToken });
  }

  async connect() { await this.client.execute('SELECT 1'); await this.ensureSchema(); this.connected = true; }
  async disconnect() { this.client.close(); this.connected = false; }
  isConnected() { return this.connected; }
  async testConnection() { await this.client.execute('SELECT 1'); return this.getDatabaseInfo(); }
  async getDatabaseInfo(): Promise<DatabaseInfo> { return { provider: 'turso', connected: this.connected, databaseName: this.config.connectionString }; }
  async getSystemHealthMetrics(): Promise<SystemHealthMetrics> {
    const names = ['regionais', 'funil', 'observacoes', 'import_operations', 'system_access'];
    const tables = await Promise.all(names.map(async (name) => {
      const [count, sizeBytes] = await Promise.all([
        this.client.execute(`SELECT COUNT(*) AS count FROM ${name}`),
        this.getTableSizeBytes(name),
      ]);
      return { name, rows: Number(count.rows[0].count || 0), sizeBytes };
    }));
    const issues = [
      { code: 'regional-cnpj-missing', label: 'Regionais sem CNPJ', table: 'regionais', count: Number((await this.client.execute("SELECT COUNT(*) AS count FROM regionais WHERE cnpj IS NULL OR TRIM(cnpj) = ''")).rows[0].count || 0) },
      { code: 'regional-name-missing', label: 'Regionais sem nome do cliente', table: 'regionais', count: Number((await this.client.execute("SELECT COUNT(*) AS count FROM regionais WHERE nome_cliente IS NULL OR TRIM(nome_cliente) = ''")).rows[0].count || 0) },
      { code: 'funil-regional-not-found', label: 'Funis com regional não encontrada', table: 'funil', count: Number((await this.client.execute('SELECT COUNT(*) AS count FROM funil WHERE id_cliente IS NOT NULL AND id_cliente > 0 AND id_cliente NOT IN (SELECT id FROM regionais)')).rows[0].count || 0) },
    ];
    const imports = (await this.client.execute('SELECT id, operation, file_name as fileName, records, status, error_message as errorMessage, created_at as createdAt FROM import_operations ORDER BY created_at DESC, id DESC LIMIT 10')).rows as unknown as SystemHealthMetrics['recentImports'];
    const access = (await this.client.execute('SELECT last_access_at as lastAccessAt FROM system_access WHERE id = 1')).rows[0] as { lastAccessAt?: string } | undefined;
    const pageCount = Number((await this.client.execute('PRAGMA page_count')).rows[0]?.page_count || 0);
    const pageSize = Number((await this.client.execute('PRAGMA page_size')).rows[0]?.page_size || 0);
    const currentPeriod = new Date().toISOString().slice(0, 7);
    const currentPeriodImports = Number((await this.client.execute({ sql: "SELECT COUNT(*) AS count FROM import_operations WHERE substr(created_at, 1, 7) = ?", args: [currentPeriod] })).rows[0]?.count || 0);
    return { databaseSizeBytes: pageCount * pageSize, databaseTables: tables, activeRecords: tables.filter((item) => item.name === 'regionais' || item.name === 'funil').reduce((sum, item) => sum + item.rows, 0), activeRecordsByTable: tables.filter((item) => item.name === 'regionais' || item.name === 'funil').map(({ name, rows }) => ({ name, rows })), validationErrors: issues.reduce((sum, issue) => sum + issue.count, 0), validationIssues: issues, recentImports: imports, lastAccessAt: access?.lastAccessAt || null, currentPeriodImports, latestOperation: imports[0] || null };
  }

  async recordImportOperation(operation: string, records: number, status: 'success' | 'warning' | 'error', errorMessage?: string) {
    await this.client.execute({ sql: 'INSERT INTO import_operations (operation, records, status, error_message) VALUES (?, ?, ?, ?)', args: [operation, records, status, errorMessage || null] });
  }

  async getFunis(filters?: Filters) {
    const conditions: string[] = []; const args: InValue[] = [];
    for (const [column, value] of [['fase', filters?.fase], ['responsavel', filters?.responsavel], ['regional', filters?.regional]] as const) {
      if (value) { conditions.push(`${column} = ?`); args.push(value); }
    }
    if (filters?.search) { conditions.push('(cnpj LIKE ? OR razao_social LIKE ? OR nome_fantasia LIKE ?)'); args.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`); }
    const result = await this.client.execute({ sql: `SELECT * FROM funil ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY data_criacao DESC`, args });
    return result.rows as unknown as Funil[];
  }
  async getFunilById(id: number) { const result = await this.client.execute({ sql: 'SELECT * FROM funil WHERE id = ?', args: [id] }); return (result.rows[0] as unknown as Funil) || null; }
  async createFunil(data: CreateFunilDto) { return this.insertFunil(data); }
  async importFunis(data: CreateFunilDto[]) {
    const statements = data.map((item) => {
      const entries = Object.entries(item).filter(([key]) => columns.includes(key as typeof columns[number]));
      return { sql: `INSERT INTO funil (${entries.map(([key]) => key).join(', ')}) VALUES (${entries.map(() => '?').join(', ')})`, args: entries.map(([, value]) => this.toValue(value)) };
    });
    for (let index = 0; index < statements.length; index += 500) {
      await this.client.batch(statements.slice(index, index + 500));
    }
    const identifiers = data.map((item) => String(item.cnpj || '').replace(/\D/g, '')).filter(Boolean);
    if (identifiers.length) {
      const placeholders = identifiers.map(() => '?').join(',');
      const result = await this.client.execute({ sql: `SELECT id, cnpj FROM funil WHERE cnpj IN (${placeholders})`, args: identifiers });
      const idsByCnpj = new Map(result.rows.map((row) => [String(row.cnpj).replace(/\D/g, ''), Number(row.id)]));
      const observations = data.flatMap((item) => {
        const funilId = idsByCnpj.get(String(item.cnpj || '').replace(/\D/g, ''));
        const values = item.observacoes as Array<{ data?: string; observacao: string }> | undefined;
        return funilId && values ? values.map((observation) => ({ sql: 'INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)', args: [funilId, observation.data ?? new Date().toISOString(), observation.observacao] as InValue[] })) : [];
      });
      for (let index = 0; index < observations.length; index += 500) {
        await this.client.batch(observations.slice(index, index + 500));
      }
    }
    return data.length;
  }
  async updateFunil(id: number, data: UpdateFunilDto) { const entries = Object.entries(data).filter(([key]) => columns.includes(key as typeof columns[number])); await this.client.execute({ sql: `UPDATE funil SET ${entries.map(([key]) => `${key} = ?`).join(', ')} WHERE id = ?`, args: [...entries.map(([, value]) => this.toValue(value)), id] }); const result = await this.getFunilById(id); if (!result) throw new Error('Funil não encontrado após atualização.'); return result; }
  async deleteFunil(id: number) { await this.client.execute({ sql: 'DELETE FROM funil WHERE id = ?', args: [id] }); }
  async updateFunilPhase(id: number, phase: number) { await this.client.execute({ sql: 'UPDATE funil SET fase = ? WHERE id = ?', args: [phase, id] }); }
  async getRegionais() { const result = await this.client.execute('SELECT * FROM regionais ORDER BY nome_cliente'); return result.rows as unknown as Regional[]; }
  async getRegionalById(id: number) { const result = await this.client.execute({ sql: 'SELECT * FROM regionais WHERE id = ?', args: [id] }); return (result.rows[0] as unknown as Regional) || null; }
  async createRegional(data: Regional) { const result = await this.client.execute({ sql: 'INSERT INTO regionais (ent_id_sap, cnpj, raiz, nome_cliente, desc_representante, desc_regional_matriz, executivo, email, nome_coordenador) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', args: [data.ent_id_sap, data.cnpj, data.raiz, data.nome_cliente, data.desc_representante, data.desc_regional_matriz, data.executivo, data.email, data.nome_coordenador].map((value) => this.toValue(value)) }); return Number(result.lastInsertRowid); }
  async updateRegional(id: number, data: Regional) { await this.client.execute({ sql: 'UPDATE regionais SET ent_id_sap = ?, cnpj = ?, raiz = ?, nome_cliente = ?, desc_representante = ?, desc_regional_matriz = ?, executivo = ?, email = ?, nome_coordenador = ? WHERE id = ?', args: [data.ent_id_sap, data.cnpj, data.raiz, data.nome_cliente, data.desc_representante, data.desc_regional_matriz, data.executivo, data.email, data.nome_coordenador, id].map((value) => this.toValue(value)) }); }
  async deleteRegional(id: number) { await this.client.execute({ sql: 'DELETE FROM regionais WHERE id = ?', args: [id] }); }
  async clearRegionais() { await this.client.execute('DELETE FROM regionais'); }
  async importRegionais(data: Regional[]) {
    const seenIds = new Set<number>();
    let nextId = data.reduce((max, row) => {
      const id = Number(row.id);
      return Number.isInteger(id) && id > max ? id : max;
    }, 0) + 1;
    const statements = data.map((row) => {
      const id = Number(row.id);
      const assignedId = Number.isInteger(id) && id > 0 && !seenIds.has(id) ? id : nextId++;
      seenIds.add(assignedId);
      const values = [assignedId, row.ent_id_sap, row.cnpj, row.raiz, row.nome_cliente, row.desc_representante, row.desc_regional_matriz, row.executivo, row.email, row.nome_coordenador];
      return {
        sql: 'INSERT INTO regionais (id, ent_id_sap, cnpj, raiz, nome_cliente, desc_representante, desc_regional_matriz, executivo, email, nome_coordenador) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: values.map((value) => this.toValue(value)),
      };
    });
    await this.client.batch([{ sql: 'DELETE FROM regionais', args: [] }, ...statements]);
  }
  async deleteFunis(ids: number[]) { if (ids.length) await this.client.execute({ sql: `DELETE FROM funil WHERE id IN (${ids.map(() => '?').join(',')})`, args: ids }); }
  async getObservacoes(funilId: number) { const result = await this.client.execute({ sql: 'SELECT * FROM observacoes WHERE funil_id = ? ORDER BY data DESC, id DESC', args: [funilId] }); return result.rows as unknown as Observacao[]; }
  async getObservacoesForFunis(funilIds: number[]) {
    const observations: Observacao[] = [];
    for (let offset = 0; offset < funilIds.length; offset += 400) {
      const ids = funilIds.slice(offset, offset + 400);
      if (ids.length === 0) continue;
      const result = await this.client.execute({
        sql: `SELECT * FROM observacoes WHERE funil_id IN (${ids.map(() => '?').join(',')}) ORDER BY data DESC, id DESC`,
        args: ids,
      });
      observations.push(...result.rows as unknown as Observacao[]);
    }
    return observations;
  }

  private async getTableSizeBytes(tableName: string): Promise<number> {
    try {
      const result = await this.client.execute({
        sql: 'SELECT COALESCE(SUM(pgsize), 0) AS size_bytes FROM dbstat WHERE name = ?',
        args: [tableName],
      });
      return Number(result.rows[0]?.size_bytes || 0);
    } catch {
      // dbstat can be unavailable on libSQL endpoints; this is a logical data size,
      // not allocated database storage.
      const columnsForTable = tableSizeColumns[tableName];
      if (!columnsForTable) return 0;
      const byteLength = columnsForTable
        .map((column) => `COALESCE(length(CAST("${column}" AS TEXT)), 0)`)
        .join(' + ');
      const result = await this.client.execute(`SELECT COALESCE(SUM(${byteLength}), 0) AS size_bytes FROM "${tableName}"`);
      return Number(result.rows[0]?.size_bytes || 0);
    }
  }
  async addObservacao(funilId: number, data: AddObservacaoDto) { const observationDate = data.data ?? new Date().toISOString(); const result = await this.client.execute({ sql: 'INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)', args: [funilId, observationDate, data.observacao] }); return { id: Number(result.lastInsertRowid), funil_id: funilId, data: observationDate, observacao: data.observacao }; }
  async getSettings(): Promise<Settings> { const result = await this.client.execute('SELECT key, value FROM settings'); return Object.fromEntries(result.rows.map((row) => [String(row.key), row.value])); }
  async updateSettings(data: Partial<Settings>) { await this.client.batch(Object.entries(data).map(([key, value]) => ({ sql: 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', args: [key, JSON.stringify(value)] }))); }

  private async ensureSchema() {
    await this.client.batch([
      { sql: 'CREATE TABLE IF NOT EXISTS regionais (id INTEGER PRIMARY KEY, ent_id_sap INTEGER, cnpj TEXT, raiz TEXT, nome_cliente TEXT, desc_representante TEXT, desc_regional_matriz TEXT, executivo TEXT, email TEXT, nome_coordenador TEXT)', args: [] },
      { sql: `CREATE TABLE IF NOT EXISTS funil (id INTEGER PRIMARY KEY AUTOINCREMENT, ${columns.map((column) => `${column} TEXT`).join(', ')}, data_criacao TEXT DEFAULT CURRENT_TIMESTAMP, data_atualizacao TEXT DEFAULT CURRENT_TIMESTAMP)`, args: [] },
      { sql: 'CREATE TABLE IF NOT EXISTS observacoes (id INTEGER PRIMARY KEY AUTOINCREMENT, funil_id INTEGER NOT NULL, data TEXT DEFAULT CURRENT_TIMESTAMP, observacao TEXT NOT NULL)', args: [] },
      { sql: 'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)', args: [] },
      { sql: "CREATE TABLE IF NOT EXISTS import_operations (id INTEGER PRIMARY KEY AUTOINCREMENT, operation TEXT NOT NULL, file_name TEXT, records INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, error_message TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)", args: [] },
      { sql: "CREATE TABLE IF NOT EXISTS system_access (id INTEGER PRIMARY KEY, last_access_at TEXT NOT NULL)", args: [] },
      { sql: "INSERT INTO system_access (id, last_access_at) VALUES (1, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET last_access_at = excluded.last_access_at", args: [] },
    ]);
  }

  private async insertFunil(data: CreateFunilDto) {
    const entries = Object.entries(data).filter(([key]) => columns.includes(key as typeof columns[number]));
    const result = await this.client.execute({ sql: `INSERT INTO funil (${entries.map(([key]) => key).join(', ')}) VALUES (${entries.map(() => '?').join(', ')})`, args: entries.map(([, value]) => this.toValue(value)) });
    const created = await this.getFunilById(Number(result.lastInsertRowid)); if (!created) throw new Error('Não foi possível recuperar o funil criado.'); return created;
  }

  private toValue(value: unknown): InValue {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') return value;
    return String(value);
  }
}
