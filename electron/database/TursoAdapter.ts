import { createClient, type Client, type InValue } from '@libsql/client';
import type { DatabaseAdapter } from './DatabaseAdapter';
import type { AddObservacaoDto, CreateFunilDto, DatabaseConfig, DatabaseInfo, Filters, Funil, Observacao, Regional, Settings, UpdateFunilDto } from './types';

const columns = ['lumiax_genomica', 'responsavel', 'ticket_onboarding', 'id_cliente', 'cnpj', 'razao_social', 'nome_fantasia', 'uf', 'regional', 'ev', 'carteira', 'coordenador', 'gerente', 'potencial', 'fase', 'entrada_mapeamento', 'saida_mapeamento', 'sla_mapeamento', 'entrada_proposta', 'saida_proposta', 'sla_proposta', 'entrada_negociacao', 'saida_negociacao', 'sla_negociacao', 'entrada_contrato', 'saida_contrato', 'sla_contrato', 'entrada_implantacao', 'saida_implantacao', 'sla_implantacao', 'entrada_acompanhamento', 'saida_acompanhamento', 'sla_acompanhamento', 'entrada_declinou', 'saida_declinou', 'sla_declinou', 'entrada_concluido', 'saida_concluido', 'sla_concluido', 'observacao', 'historico', 'selecionados'] as const;

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
  async updateFunil(id: number, data: UpdateFunilDto) { const entries = Object.entries(data).filter(([key]) => columns.includes(key as typeof columns[number])); await this.client.execute({ sql: `UPDATE funil SET ${entries.map(([key]) => `${key} = ?`).join(', ')} WHERE id = ?`, args: [...entries.map(([, value]) => this.toValue(value)), id] }); const result = await this.getFunilById(id); if (!result) throw new Error('Funil não encontrado após atualização.'); return result; }
  async deleteFunil(id: number) { await this.client.execute({ sql: 'DELETE FROM funil WHERE id = ?', args: [id] }); }
  async updateFunilPhase(id: number, phase: number) { await this.client.execute({ sql: 'UPDATE funil SET fase = ? WHERE id = ?', args: [phase, id] }); }
  async getRegionais() { const result = await this.client.execute('SELECT * FROM regionais ORDER BY nome_cliente'); return result.rows as unknown as Regional[]; }
  async importRegionais(data: Regional[]) { await this.client.batch([{ sql: 'DELETE FROM regionais', args: [] }, ...data.map((row) => ({ sql: 'INSERT INTO regionais (id, ent_id_sap, cnpj, raiz, nome_cliente, desc_representante, desc_regional_matriz, executivo, email, nome_coordenador) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', args: [row.id, row.ent_id_sap, row.cnpj, row.raiz, row.nome_cliente, row.desc_representante, row.desc_regional_matriz, row.executivo, row.email, row.nome_coordenador].map((value) => this.toValue(value)) }))]); }
  async getObservacoes(funilId: number) { const result = await this.client.execute({ sql: 'SELECT * FROM observacoes WHERE funil_id = ? ORDER BY data DESC, id DESC', args: [funilId] }); return result.rows as unknown as Observacao[]; }
  async addObservacao(funilId: number, data: AddObservacaoDto) { const observationDate = data.data ?? new Date().toISOString(); const result = await this.client.execute({ sql: 'INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)', args: [funilId, observationDate, data.observacao] }); return { id: Number(result.lastInsertRowid), funil_id: funilId, data: observationDate, observacao: data.observacao }; }
  async getSettings(): Promise<Settings> { const result = await this.client.execute('SELECT key, value FROM settings'); return Object.fromEntries(result.rows.map((row) => [String(row.key), row.value])); }
  async updateSettings(data: Partial<Settings>) { await this.client.batch(Object.entries(data).map(([key, value]) => ({ sql: 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', args: [key, JSON.stringify(value)] }))); }

  private async ensureSchema() {
    await this.client.batch([
      { sql: 'CREATE TABLE IF NOT EXISTS regionais (id INTEGER PRIMARY KEY, ent_id_sap INTEGER, cnpj TEXT, raiz TEXT, nome_cliente TEXT, desc_representante TEXT, desc_regional_matriz TEXT, executivo TEXT, email TEXT, nome_coordenador TEXT)', args: [] },
      { sql: `CREATE TABLE IF NOT EXISTS funil (id INTEGER PRIMARY KEY AUTOINCREMENT, ${columns.map((column) => `${column} TEXT`).join(', ')}, data_criacao TEXT DEFAULT CURRENT_TIMESTAMP, data_atualizacao TEXT DEFAULT CURRENT_TIMESTAMP)`, args: [] },
      { sql: 'CREATE TABLE IF NOT EXISTS observacoes (id INTEGER PRIMARY KEY AUTOINCREMENT, funil_id INTEGER NOT NULL, data TEXT DEFAULT CURRENT_TIMESTAMP, observacao TEXT NOT NULL)', args: [] },
      { sql: 'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)', args: [] },
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
