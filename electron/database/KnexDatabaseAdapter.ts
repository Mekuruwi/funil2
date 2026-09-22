import type { Knex } from 'knex';
import knex from 'knex';
import type { DatabaseAdapter } from './DatabaseAdapter';
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
  SystemHealthMetrics,
  UpdateFunilDto,
} from './types';

const funilColumns = [
  'lumiax_genomica', 'responsavel', 'ticket_onboarding', 'id_cliente', 'cnpj',
  'razao_social', 'nome_fantasia', 'uf', 'regional', 'ev', 'carteira',
  'coordenador', 'gerente', 'potencial', 'fase', 'entrada_mapeamento',
  'saida_mapeamento', 'sla_mapeamento', 'entrada_proposta', 'saida_proposta',
  'sla_proposta', 'entrada_negociacao', 'saida_negociacao', 'sla_negociacao',
  'entrada_contrato', 'saida_contrato', 'sla_contrato', 'entrada_implantacao',
  'saida_implantacao', 'sla_implantacao', 'entrada_acompanhamento',
  'saida_acompanhamento', 'sla_acompanhamento', 'entrada_declinou',
  'saida_declinou', 'sla_declinou', 'entrada_concluido', 'saida_concluido',
  'sla_concluido', 'observacao', 'historico', 'selecionados',
] as const;

export abstract class KnexDatabaseAdapter implements DatabaseAdapter {
  protected readonly config: DatabaseConfig;
  protected readonly db: Knex;
  private connected = false;

  protected constructor(config: DatabaseConfig, client: Knex.Config['client'], connection: Knex.Config['connection']) {
    this.config = config;
    this.db = knex({ client, connection, useNullAsDefault: client === 'better-sqlite3' });
  }

  async connect(): Promise<void> {
    await this.db.raw(this.config.provider === 'sqlite' ? 'select 1' : 'select 1');
    await this.ensureSchema();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    await this.db.destroy();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async testConnection(): Promise<DatabaseInfo> {
    await this.db.raw('select 1');
    return this.getDatabaseInfo();
  }

  async getDatabaseInfo(): Promise<DatabaseInfo> {
    return {
      provider: this.config.provider,
      connected: this.connected,
      databaseName: this.config.filename || this.config.database || this.config.connectionString,
    };
  }

  async getSystemHealthMetrics(): Promise<SystemHealthMetrics> {
    const tableNames = ['regionais', 'funil', 'observacoes', 'import_operations', 'system_access'];
    const counts = await Promise.all(tableNames.map(async (name) => ({
      name,
      rows: Number((await this.db(name).count({ count: '*' }).first())?.count || 0),
      sizeBytes: 0,
    })));
    const regionalMissingCnpj = Number((await this.db('regionais').whereNull('cnpj').orWhere('cnpj', '').count({ count: '*' }).first())?.count || 0);
    const regionalMissingName = Number((await this.db('regionais').whereNull('nome_cliente').orWhere('nome_cliente', '').count({ count: '*' }).first())?.count || 0);
    const invalidClient = Number((await this.db('funil').whereNotNull('id_cliente').whereNot('id_cliente', 0).whereNotIn('id_cliente', this.db('regionais').select('id')).count({ count: '*' }).first())?.count || 0);
    const recentImports = await this.db('import_operations').select(
      'id', 'operation', 'file_name as fileName', 'records', 'status',
      'error_message as errorMessage', 'created_at as createdAt',
    ).orderBy([{ column: 'created_at', order: 'desc' }, { column: 'id', order: 'desc' }]).limit(10) as SystemHealthMetrics['recentImports'];
    const lastAccess = await this.db('system_access').where({ id: 1 }).first();
    const currentPeriod = new Date().toISOString().slice(0, 7);
    const periodExpression = this.config.provider === 'mysql'
      ? "DATE_FORMAT(created_at, '%Y-%m')"
      : this.config.provider === 'sqlite'
        ? "strftime('%Y-%m', created_at)"
        : "to_char(created_at, 'YYYY-MM')";
    const currentPeriodImports = Number((await this.db('import_operations').whereRaw(
      `${periodExpression} = ?`,
      [currentPeriod],
    ).count({ count: '*' }).first())?.count || 0);
    const validationIssues = [
      { code: 'regional-cnpj-missing', label: 'Regionais sem CNPJ', table: 'regionais', count: regionalMissingCnpj },
      { code: 'regional-name-missing', label: 'Regionais sem nome do cliente', table: 'regionais', count: regionalMissingName },
      { code: 'funil-regional-not-found', label: 'Funis com regional não encontrada', table: 'funil', count: invalidClient },
    ];
    return {
      databaseSizeBytes: await this.estimateDatabaseSize(),
      databaseTables: counts,
      activeRecords: counts.filter(({ name }) => name === 'regionais' || name === 'funil').reduce((sum, table) => sum + table.rows, 0),
      activeRecordsByTable: counts.filter(({ name }) => name === 'regionais' || name === 'funil').map(({ name, rows }) => ({ name, rows })),
      validationErrors: validationIssues.reduce((sum, issue) => sum + issue.count, 0),
      validationIssues,
      recentImports,
      lastAccessAt: lastAccess?.last_access_at || null,
      currentPeriodImports,
      latestOperation: recentImports[0] || null,
    };
  }

  async recordImportOperation(operation: string, records: number, status: 'success' | 'warning' | 'error', errorMessage?: string): Promise<void> {
    await this.db('import_operations').insert({
      operation,
      records,
      status,
      error_message: errorMessage || null,
    });
  }

  private async estimateDatabaseSize(): Promise<number> {
    const rows = await Promise.all(['regionais', 'funil', 'observacoes', 'import_operations', 'system_access'].map(async (name) => {
      const result = await this.db(name).select('*');
      return JSON.stringify(result).length;
    }));
    return rows.reduce((total, size) => total + size, 0);
  }

  async getFunis(filters?: Filters): Promise<Funil[]> {
    let query = this.db('funil').select('*').orderBy('data_criacao', 'desc');
    if (filters?.fase) query = query.where('fase', filters.fase);
    if (filters?.responsavel) query = query.where('responsavel', filters.responsavel);
    if (filters?.regional) query = query.where('regional', filters.regional);
    if (filters?.search) {
      query = query.where((builder) => builder
        .whereILike('cnpj', `%${filters.search}%`)
        .orWhereILike('razao_social', `%${filters.search}%`)
        .orWhereILike('nome_fantasia', `%${filters.search}%`));
    }
    return query as unknown as Promise<Funil[]>;
  }

  async getFunilById(id: number): Promise<Funil | null> {
    const row = await this.db('funil').where({ id }).first();
    return (row as Funil | undefined) || null;
  }

  async createFunil(data: CreateFunilDto): Promise<Funil> {
    const values = this.pickFunilColumns(data);
    const result = await this.db('funil').insert(values).returning('id');
    const id = this.extractId(result);
    const created = await this.getFunilById(id);
    if (!created) throw new Error('Não foi possível recuperar o funil criado.');
    return created;
  }

  async importFunis(data: CreateFunilDto[]): Promise<number> {
    let inserted = 0;
    await this.db.transaction(async (transaction) => {
      for (const item of data) {
        const values = this.pickFunilColumns(item);
        const [id] = await transaction('funil').insert(values).returning('id');
        const funilId = this.extractId(id);
        const observations = item.observacoes as Array<{ data?: string; observacao: string }> | undefined;
        if (observations?.length) {
          await transaction('observacoes').insert(observations.map((observation) => ({
            funil_id: funilId,
            data: observation.data,
            observacao: observation.observacao,
          })));
        }
        inserted += 1;
      }
    });
    return inserted;
  }

  async updateFunil(id: number, data: UpdateFunilDto): Promise<Funil> {
    await this.db('funil').where({ id }).update(this.pickFunilColumns(data));
    const updated = await this.getFunilById(id);
    if (!updated) throw new Error('Funil não encontrado após atualização.');
    return updated;
  }

  async deleteFunil(id: number): Promise<void> {
    await this.db('funil').where({ id }).delete();
  }

  async updateFunilPhase(id: number, phase: number): Promise<void> {
    await this.db('funil').where({ id }).update({ fase: phase });
  }

  async getRegionais(): Promise<Regional[]> {
    return this.db('regionais').select('*').orderBy('nome_cliente') as unknown as Promise<Regional[]>;
  }

  async getRegionalById(id: number): Promise<Regional | null> {
    return (await this.db('regionais').where({ id }).first() as Regional | undefined) || null;
  }

  async createRegional(data: Regional): Promise<number> {
    const [id] = await this.db('regionais').insert(data).returning('id');
    return this.extractId(id);
  }

  async updateRegional(id: number, data: Regional): Promise<void> {
    const { id: _id, ...values } = data;
    await this.db('regionais').where({ id }).update(values);
  }

  async deleteRegional(id: number): Promise<void> {
    await this.db('regionais').where({ id }).delete();
  }

  async clearRegionais(): Promise<void> {
    await this.db('regionais').delete();
  }

  async importRegionais(data: Regional[]): Promise<void> {
    const seenIds = new Set<number>();
    let nextId = data.reduce((max, row) => {
      const id = Number(row.id);
      return Number.isInteger(id) && id > max ? id : max;
    }, 0) + 1;
    const normalized = data.map((row) => {
      const id = Number(row.id);
      const assignedId = Number.isInteger(id) && id > 0 && !seenIds.has(id) ? id : nextId++;
      seenIds.add(assignedId);
      return { ...row, id: assignedId };
    });
    await this.db.transaction(async (transaction) => {
      await transaction('regionais').delete();
      if (normalized.length > 0) await transaction('regionais').insert(normalized);
    });
  }

  async deleteFunis(ids: number[]): Promise<void> {
    await this.db('funil').whereIn('id', ids).delete();
  }

  async getObservacoes(funilId: number): Promise<Observacao[]> {
    return this.db('observacoes').where({ funil_id: funilId }).orderBy([{ column: 'data', order: 'desc' }, { column: 'id', order: 'desc' }]) as unknown as Promise<Observacao[]>;
  }

  async addObservacao(funilId: number, data: AddObservacaoDto): Promise<Observacao> {
    const [id] = await this.db('observacoes').insert({ funil_id: funilId, ...data }).returning('id');
    const observation = await this.db('observacoes').where({ id: this.extractId(id) }).first();
    if (!observation) throw new Error('Não foi possível recuperar a observação criada.');
    return observation as Observacao;
  }

  async getSettings(): Promise<Settings> {
    const rows = await this.db('settings').select('*');
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  async updateSettings(data: Partial<Settings>): Promise<void> {
    await this.db.transaction(async (transaction) => {
      for (const [key, value] of Object.entries(data)) {
        await transaction('settings').insert({ key, value: JSON.stringify(value) })
          .onConflict('key').merge({ value: JSON.stringify(value) });
      }
    });
  }

  protected async ensureSchema(): Promise<void> {
    if (!(await this.db.schema.hasTable('regionais'))) {
      await this.db.schema.createTable('regionais', (table) => {
        table.increments('id').primary();
        table.integer('ent_id_sap');
        table.text('cnpj');
        table.text('raiz');
        table.text('nome_cliente');
        table.text('desc_representante');
        table.text('desc_regional_matriz');
        table.text('executivo');
        table.text('email');
        table.text('nome_coordenador');
      });
    }
    if (!(await this.db.schema.hasTable('funil'))) {
      await this.db.schema.createTable('funil', (table) => {
        table.increments('id').primary();
        for (const column of funilColumns) table.text(column);
        table.timestamp('data_criacao').defaultTo(this.db.fn.now());
        table.timestamp('data_atualizacao').defaultTo(this.db.fn.now());
      });
    }
    if (!(await this.db.schema.hasTable('observacoes'))) {
      await this.db.schema.createTable('observacoes', (table) => {
        table.increments('id').primary();
        table.integer('funil_id').notNullable();
        table.timestamp('data').defaultTo(this.db.fn.now());
        table.text('observacao').notNullable();
      });
    }
    if (!(await this.db.schema.hasTable('settings'))) {
      await this.db.schema.createTable('settings', (table) => {
        table.string('key').primary();
        table.text('value').notNullable();
      });
    }
    if (!(await this.db.schema.hasTable('import_operations'))) {
      await this.db.schema.createTable('import_operations', (table) => {
        table.increments('id').primary();
        table.text('operation').notNullable();
        table.text('file_name');
        table.integer('records').notNullable().defaultTo(0);
        table.text('status').notNullable();
        table.text('error_message');
        table.timestamp('created_at').notNullable().defaultTo(this.db.fn.now());
      });
    }
    if (!(await this.db.schema.hasTable('system_access'))) {
      await this.db.schema.createTable('system_access', (table) => {
        table.integer('id').primary();
        table.timestamp('last_access_at').notNullable();
      });
    }
    await this.db('system_access').insert({ id: 1, last_access_at: this.db.fn.now() }).onConflict('id').merge({ last_access_at: this.db.fn.now() });
  }

  private pickFunilColumns(data: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(data).filter(([key]) => funilColumns.includes(key as typeof funilColumns[number])));
  }

  private extractId(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'bigint') return Number(value);
    if (value && typeof value === 'object' && 'id' in value) return this.extractId(value.id);
    throw new Error('O banco não retornou o identificador gerado.');
  }
}
