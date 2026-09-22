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
      databaseName: this.config.database,
    };
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

  async importRegionais(data: Regional[]): Promise<void> {
    await this.db.transaction(async (transaction) => {
      await transaction('regionais').delete();
      if (data.length > 0) await transaction('regionais').insert(data);
    });
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
