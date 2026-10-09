import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';
import log from 'electron-log/main';
import path from 'path';
import { initializeDatabase, getDatabase as getLegacyDatabase, getSystemHealthMetrics, recordImportOperation } from './database';
import { DatabaseFactory } from './database/DatabaseFactory';
import type { DatabaseAdapter } from './database/DatabaseAdapter';
import type { DatabaseConfig } from './database/types';
import { loadDatabaseConfig, saveDatabaseConfig } from './database/configStore';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
log.initialize();

let mainWindow: BrowserWindow | null = null;
let configuredAdapter: DatabaseAdapter | null = null;
let configuredDatabase: DatabaseConfig | null = null;

function handleIpc(channel: string, handler: (event: IpcMainInvokeEvent, ...args: any[]) => unknown) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!mainWindow || event.sender.id !== mainWindow.webContents.id || event.senderFrame !== event.sender.mainFrame) {
      throw new Error('Origem inválida para chamada IPC.');
    }
    return handler(event, ...args);
  });
}

function assertDatabaseConfig(value: unknown): asserts value is DatabaseConfig {
  const config = value as Partial<DatabaseConfig> | null;
  const providers = ['sqlite', 'postgres', 'mysql', 'supabase', 'turso'];
  if (!config || typeof config !== 'object' || !providers.includes(String(config.provider))) {
    throw new Error('Configuração de banco inválida.');
  }
  for (const field of ['filename', 'connectionString', 'authToken', 'host', 'user', 'password', 'database'] as const) {
    const fieldValue = config[field];
    if (fieldValue !== undefined && (typeof fieldValue !== 'string' || fieldValue.length > 4096)) {
      throw new Error(`Campo inválido na configuração: ${field}.`);
    }
  }
  if (config.port !== undefined && (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535)) {
    throw new Error('Porta inválida na configuração do banco.');
  }
}

function assertRecordList(value: unknown, label: string): asserts value is Array<Record<string, unknown>> {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50000) {
    throw new Error(`Lista de ${label} inválida ou acima do limite de 50.000 registros.`);
  }
  for (const row of value) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`Registro inválido em ${label}.`);
    for (const fieldValue of Object.values(row)) {
      if (fieldValue !== null && !['string', 'number', 'boolean'].includes(typeof fieldValue)) {
        throw new Error(`Valor inválido em um registro de ${label}.`);
      }
      if (typeof fieldValue === 'string' && fieldValue.length > 2000000) {
        throw new Error(`Texto acima do limite permitido em ${label}.`);
      }
    }
  }
}

function getDatabase(): ReturnType<typeof getLegacyDatabase> {
  if (!configuredAdapter?.isConnected()) {
    throw new Error(`O banco configurado (${configuredDatabase?.provider || 'desconhecido'}) não está conectado.`);
  }

  return getLegacyDatabase();
}

async function recordActiveImport(operation: string, records: number, status: 'success' | 'warning' | 'error', errorMessage?: string) {
  if (configuredAdapter?.isConnected()) {
    await configuredAdapter.recordImportOperation(operation, records, status, errorMessage);
    return;
  }
  recordImportOperation(operation, records, status, undefined, errorMessage);
}
const normalizedCnpj = (column: string) =>
  `replace(replace(replace(replace(${column}, '.', ''), '/', ''), '-', ''), ' ', '')`;

function parseLegacyHistory(funilId: number, historico: unknown) {
  return String(historico || '').split(/\r?\n/).flatMap((line, index) => {
    const match = line.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(.+)$/);
    if (!match) return [];
    return [{
      id: -(funilId * 10000 + index + 1),
      funil_id: funilId,
      data: `${match[3]}-${match[2]}-${match[1]}`,
      observacao: match[4].trim(),
    }];
  });
}

function attachObservations(db: ReturnType<typeof getDatabase>, funis: any[]) {
  if (funis.length === 0) return [];

  // Uma única consulta substitui uma consulta por card (N+1).
  const observationsByFunil = new Map<number, any[]>();
  const ids = funis.map(funil => funil.id);
  const placeholders = ids.map(() => '?').join(',');
  const observations = db.prepare(
    `SELECT * FROM observacoes WHERE funil_id IN (${placeholders}) ORDER BY data DESC, id DESC`
  ).all(...ids) as any[];
  for (const observation of observations) {
    const current = observationsByFunil.get(observation.funil_id) || [];
    current.push(observation);
    observationsByFunil.set(observation.funil_id, current);
  }

  return funis.map(funil => {
    const persisted = observationsByFunil.get(funil.id) || [];
    const legacyObservacoes = parseLegacyHistory(funil.id, funil.historico)
      .sort((a, b) => b.data.localeCompare(a.data));
    return {
      ...funil,
      observacoes: persisted.length > 0 ? persisted : legacyObservacoes,
    };
  });
}

function createWindow() {
  // 1. PROTEÇÃO CONTRA JANELAS DUPLICADAS
  // Se a janela já existe e não foi destruída, apenas traz ela para o foco e não cria outra
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, '../electron/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
  const developmentUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    const allowed = isDev
      ? new URL(targetUrl).origin === new URL(developmentUrl).origin
      : targetUrl.startsWith('file:') && path.resolve(fileURLToPath(targetUrl)) === path.resolve(path.join(__dirname, '../dist/index.html'));
    if (!allowed) event.preventDefault();
  });

  if (isDev) {
    mainWindow.loadURL(developmentUrl);
    
    // 2. DESATIVAR DEVTOOLS AUTOMÁTICO
    // mainWindow.webContents.openDevTools(); // <-- MANTENHA COMENTADO OU APAGUE
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Initialize database
  initializeDatabase();
  configuredDatabase = await loadDatabaseConfig();
  try {
    assertDatabaseConfig(configuredDatabase);
    const adapter = DatabaseFactory.create(configuredDatabase);
    await adapter.connect();
    configuredAdapter = adapter;
  } catch (error) {
    log.error('Não foi possível conectar ao provider configurado.', error);
    configuredAdapter = null;
  }

  createWindow();

  handleIpc('app:logError', (_event, context: string, message: string, stack?: string) => {
    log.error(`[Renderer] ${context.slice(0, 200)}: ${message.slice(0, 2000)}`, stack?.slice(0, 8000));
  });

  handleIpc('database:testConnection', async (_event, config: DatabaseConfig) => {
    assertDatabaseConfig(config);
    const adapter = DatabaseFactory.create(config);
    try {
      await adapter.connect();
      return { success: true, info: await adapter.getDatabaseInfo() };
    } catch (error) {
      log.warn('Falha ao testar conexão do banco de dados.', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      if (adapter.isConnected()) await adapter.disconnect();
    }
  });

  handleIpc('database:getCurrentProvider', () => ({
    provider: configuredDatabase?.provider || 'sqlite',
    connected: configuredAdapter?.isConnected() || false,
  }));

  handleIpc('database:getCurrentConfig', () => configuredDatabase);

  handleIpc('database:switchProvider', async (_event, config: DatabaseConfig) => {
    assertDatabaseConfig(config);
    const nextAdapter = DatabaseFactory.create(config);
    await nextAdapter.connect();
    try {
      await saveDatabaseConfig(config);
    } catch (error) {
      await nextAdapter.disconnect();
      throw error;
    }
    const previousAdapter = configuredAdapter;
    configuredAdapter = nextAdapter;
    configuredDatabase = config;
    if (previousAdapter?.isConnected()) {
      try {
        await previousAdapter.disconnect();
      } catch (error) {
        log.warn('O novo banco foi ativado, mas não foi possível encerrar a conexão anterior.', error);
      }
    }
    return await nextAdapter.getDatabaseInfo();
  });

  handleIpc('database:migrateData', async (_event, fromConfig: DatabaseConfig, toConfig: DatabaseConfig) => {
    assertDatabaseConfig(fromConfig);
    assertDatabaseConfig(toConfig);
    const source = DatabaseFactory.create(fromConfig);
    const target = DatabaseFactory.create(toConfig);
    let sourceConnected = false;
    let targetConnected = false;
    try {
      await source.connect();
      sourceConnected = true;
      await target.connect();
      targetConnected = true;

      const existingRegionais = await target.getRegionais();
      const existingFunis = await target.getFunis();
      const targetMetrics = await target.getSystemHealthMetrics();
      const existingObservations = targetMetrics.databaseTables.find((table) => table.name === 'observacoes')?.rows || 0;
      if (existingRegionais.length || existingFunis.length || existingObservations > 0) {
        throw new Error('O banco de destino precisa estar vazio antes da migração.');
      }

      const regionais = await source.getRegionais();
      const funis = await source.getFunis();
      await target.importRegionais(regionais);
      for (const funil of funis) {
        const created = await target.createFunil(funil);
        const observations = await source.getObservacoes(funil.id);
        for (const observation of observations) {
          await target.addObservacao(created.id, {
            data: observation.data,
            observacao: observation.observacao,
          });
        }
      }
      return { success: true, regionais: regionais.length, funis: funis.length };
    } catch (error) {
      return {
        success: false,
        error: `${error instanceof Error ? error.message : String(error)}${targetConnected ? ' A migração pode ter deixado dados parciais no destino; confira o banco antes de tentar novamente.' : ''}`,
      };
    } finally {
      if (sourceConnected) await source.disconnect();
      if (targetConnected) await target.disconnect();
    }
  });

  handleIpc('settings:selectFolder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    return result.canceled ? null : result.filePaths[0] || null;
  });

  // IPC Handlers for Regionais (base de regionais)
  handleIpc('regionais:getAll', () => {
    if (configuredAdapter?.isConnected()) return configuredAdapter.getRegionais();
    const db = getDatabase();
    const result = db.prepare('SELECT * FROM regionais ORDER BY nome_cliente').all();
    return result;
  });

  handleIpc('regionais:getById', async (_, id: number) => {
    if (configuredAdapter?.isConnected()) return configuredAdapter.getRegionalById(id);
    const db = getDatabase();
    const result = db.prepare('SELECT * FROM regionais WHERE id = ?').get(id);
    return result || null;
  });

  handleIpc('regionais:insert', async (_, regional) => {
    if (configuredAdapter?.isConnected()) return configuredAdapter.createRegional(regional);
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO regionais (ent_id_sap, cnpj, raiz, nome_cliente, desc_representante, 
        desc_regional_matriz, executivo, email, nome_coordenador)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      regional.ent_id_sap,
      regional.cnpj,
      regional.raiz,
      regional.nome_cliente,
      regional.desc_representante,
      regional.desc_regional_matriz,
      regional.executivo,
      regional.email,
      regional.nome_coordenador
    );
    return result.lastInsertRowid;
  });

  handleIpc('regionais:import', async (_, regionais: any[]) => {
    assertRecordList(regionais, 'regionais');
    if (!Array.isArray(regionais) || regionais.length === 0) {
      recordImportOperation('Importação de regionais', 0, 'error', undefined, 'Nenhum registro fornecido.');
      throw new Error('Nenhum registro de regional foi fornecido para importação.');
    }

    if (configuredAdapter?.isConnected()) {
      await configuredAdapter.importRegionais(regionais);
      await recordActiveImport('Importação de regionais', regionais.length, 'success');
      return regionais.length;
    }
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO regionais (ent_id_sap, cnpj, raiz, nome_cliente, desc_representante,
        desc_regional_matriz, executivo, email, nome_coordenador)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const importTransaction = db.transaction((rows: any[]) => {
      db.prepare('DELETE FROM regionais').run();
      for (const regional of rows) {
        stmt.run(
          regional.ent_id_sap,
          regional.cnpj,
          regional.raiz,
          regional.nome_cliente,
          regional.desc_representante,
          regional.desc_regional_matriz,
          regional.executivo,
          regional.email,
          regional.nome_coordenador
        );
      }
    });

    try {
      importTransaction(regionais);
    } catch (error) {
      log.error('Falha ao importar regionais.', error);
      recordImportOperation('Importação de regionais', 0, 'error', undefined, error instanceof Error ? error.message : String(error));
      throw error;
    }
    recordImportOperation('Importação de regionais', regionais.length, 'success');
    return regionais.length;
  });

  handleIpc('regionais:update', async (_, id, regional) => {
    if (configuredAdapter?.isConnected()) {
      await configuredAdapter.updateRegional(id, regional);
      return true;
    }
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE regionais SET
        ent_id_sap = ?, cnpj = ?, raiz = ?, nome_cliente = ?,
        desc_representante = ?, desc_regional_matriz = ?, executivo = ?,
        email = ?, nome_coordenador = ?
      WHERE id = ?
    `);
    stmt.run(
      regional.ent_id_sap,
      regional.cnpj,
      regional.raiz,
      regional.nome_cliente,
      regional.desc_representante,
      regional.desc_regional_matriz,
      regional.executivo,
      regional.email,
      regional.nome_coordenador,
      id
    );
    return true;
  });

  handleIpc('regionais:delete', async (_, id: number) => {
    if (configuredAdapter?.isConnected()) {
      await configuredAdapter.deleteRegional(id);
      return true;
    }
    const db = getDatabase();
    db.prepare('DELETE FROM regionais WHERE id = ?').run(id);
    return true;
  });

  // Limpa todos os registros da tabela regionais (operação slot)
  handleIpc('regionais:clear', async () => {
    if (configuredAdapter?.isConnected()) {
      await configuredAdapter.clearRegionais();
      return true;
    }
    const db = getDatabase();
    db.prepare('DELETE FROM regionais').run();
    return true;
  });

  // IPC Handlers for Funil (dados do forms)
  handleIpc('funil:getAll', async () => {
    if (configuredAdapter?.isConnected()) {
      const funis = await configuredAdapter.getFunis();
      const observations = await configuredAdapter.getObservacoesForFunis(funis.map((funil) => funil.id));
      const observationsByFunil = new Map<number, typeof observations>();
      for (const observation of observations) {
        const current = observationsByFunil.get(observation.funil_id) || [];
        current.push(observation);
        observationsByFunil.set(observation.funil_id, current);
      }
      const withObservations = await Promise.all(funis.map(async (funil) => ({
        ...funil,
        observacoes: observationsByFunil.get(funil.id)?.length
          ? observationsByFunil.get(funil.id)
          : parseLegacyHistory(funil.id, funil.historico),
      })));
      return withObservations;
    }
    const db = getDatabase();
    const result = db.prepare(`
      SELECT f.*, r.nome_cliente, r.desc_representante, r.desc_regional_matriz as regional_cruzada,
             r.executivo as executivo_regional, r.nome_coordenador as coord_regional,
             r.desc_representante as carteira_cruzada
      FROM funil f
      LEFT JOIN regionais r ON r.id = (
        SELECT r2.id
        FROM regionais r2
        WHERE ${normalizedCnpj('r2.cnpj')} = ${normalizedCnpj('f.cnpj')}
        ORDER BY r2.id
        LIMIT 1
      )
      ORDER BY f.data_criacao DESC
    `).all() as any[];
    return attachObservations(db, result);
  });

  handleIpc('funil:getById', async (_, id: number) => {
    if (configuredAdapter?.isConnected()) {
      const funil = await configuredAdapter.getFunilById(id);
      if (!funil) return null;
      return { ...funil, observacoes: await configuredAdapter.getObservacoes(id) };
    }
    const db = getDatabase();
    const funil = db.prepare(`
      SELECT f.*, r.nome_cliente, r.desc_representante, r.desc_regional_matriz,
             r.executivo as executivo_regional, r.nome_coordenador as coord_regional,
             COALESCE(r.desc_regional_matriz, f.regional) as regional_cruzada,
             COALESCE(r.desc_representante, f.carteira) as carteira_cruzada
      FROM funil f
      LEFT JOIN regionais r ON r.id = (
        SELECT r2.id
        FROM regionais r2
        WHERE ${normalizedCnpj('r2.cnpj')} = ${normalizedCnpj('f.cnpj')}
        ORDER BY r2.id
        LIMIT 1
      )
      WHERE f.id = ?
    `).get(id);
    
    if (!funil) return null;
    return attachObservations(db, [funil])[0];
  });

  handleIpc('funil:updatePhase', async (_, id: number, fase: number) => {
    if (!Number.isInteger(fase) || fase < 1 || fase > 8) {
      throw new Error('Fase inválida.');
    }
    if (configuredAdapter?.isConnected()) {
      await configuredAdapter.updateFunilPhase(id, fase);
      return true;
    }
    const db = getDatabase();
    db.prepare('UPDATE funil SET fase = ?, data_atualizacao = CURRENT_TIMESTAMP WHERE id = ?')
      .run(fase, id);
    return true;
  });

  handleIpc('funil:insert', async (_, funil) => {
    if (configuredAdapter?.isConnected()) {
      const normalized = { ...funil, ticket_onboarding: funil.ticket_onboarding || funil.ticket || '', ev: funil.executivo || funil.ev };
      const existing = await configuredAdapter.getFunis({ search: String(funil.cnpj || '') });
      if (existing.some((item) => String(item.cnpj || '').replace(/\D/g, '') === String(funil.cnpj || '').replace(/\D/g, ''))) {
        throw new Error('Já existe um registro do funil com este CNPJ ou cliente.');
      }
      const created = await configuredAdapter.createFunil(normalized);
      if (funil.observacao) await configuredAdapter.addObservacao(created.id, { observacao: String(funil.observacao) });
      return created.id;
    }
    const db = getDatabase();
    const cnpj = String(funil.cnpj || '').replace(/\D/g, '');
    const parsedIdCliente = Number(funil.id_cliente);
    const idCliente = Number.isInteger(parsedIdCliente) ? parsedIdCliente : 0;
    if (cnpj || Number.isInteger(idCliente) && idCliente > 0) {
      const duplicate = db.prepare(`
        SELECT id
        FROM funil
        WHERE (${normalizedCnpj('cnpj')} = ? AND ? <> '')
           OR (id_cliente = ? AND ? > 0)
        LIMIT 1
      `).get(cnpj, cnpj, idCliente, idCliente) as { id?: number } | undefined;
      if (duplicate) {
        throw new Error('Já existe um registro do funil com este CNPJ ou cliente.');
      }
    }

    const stmt = db.prepare(`
      INSERT INTO funil (
        lumiax_genomica, responsavel, ticket_onboarding, id_cliente, cnpj,
        razao_social, nome_fantasia, uf, regional, ev, carteira, coordenador,
        gerente, potencial, fase, entrada_mapeamento, saida_mapeamento, sla_mapeamento,
        entrada_proposta, saida_proposta, sla_proposta, entrada_negociacao, saida_negociacao,
        sla_negociacao, entrada_contrato, saida_contrato, sla_contrato, entrada_implantacao,
        saida_implantacao, sla_implantacao, entrada_acompanhamento, saida_acompanhamento,
        sla_acompanhamento, entrada_declinou, saida_declinou, sla_declinou, entrada_concluido,
        saida_concluido, sla_concluido, observacao, historico, selecionados
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      funil.lumiax_genomica,
      funil.responsavel,
      funil.ticket_onboarding || funil.ticket || '',
      funil.id_cliente || null,
      funil.cnpj,
      funil.razao_social,
      funil.nome_fantasia,
      funil.uf,
      funil.regional || '',
      funil.executivo || funil.ev,
      funil.carteira || '',
      funil.coordenador || '',
      funil.gerente || '',
      funil.potencial,
      funil.fase,
      funil.entrada_mapeamento,
      funil.saida_mapeamento,
      funil.sla_mapeamento,
      funil.entrada_proposta,
      funil.saida_proposta,
      funil.sla_proposta,
      funil.entrada_negociacao,
      funil.saida_negociacao,
      funil.sla_negociacao,
      funil.entrada_contrato,
      funil.saida_contrato,
      funil.sla_contrato,
      funil.entrada_implantacao,
      funil.saida_implantacao,
      funil.sla_implantacao,
      funil.entrada_acompanhamento,
      funil.saida_acompanhamento,
      funil.sla_acompanhamento,
      funil.entrada_declinou,
      funil.saida_declinou,
      funil.sla_declinou,
      funil.entrada_concluido,
      funil.saida_concluido,
      funil.sla_concluido,
      funil.observacao,
      funil.historico,
      funil.selecionados
    );
    return result.lastInsertRowid;
  });

  handleIpc('funil:import', (_, funis: any[]) => {
    assertRecordList(funis, 'funis');
    if (!Array.isArray(funis) || funis.length === 0) {
      recordImportOperation('Importação de funil', 0, 'error', undefined, 'Nenhum registro fornecido.');
      throw new Error('Nenhum registro de funil foi fornecido para importação.');
    }

    if (configuredAdapter?.isConnected()) {
      return (async () => {
        const existing = await configuredAdapter.getFunis();
        const existingCnpjs = new Set(existing.map((item) => String(item.cnpj || '').replace(/\D/g, '')).filter(Boolean));
        const existingClientIds = new Set(existing.map((item) => Number(item.id_cliente)).filter((id) => Number.isInteger(id) && id > 0));
        const pending: any[] = [];
        for (const funil of funis) {
          const cnpj = String(funil.cnpj || '').replace(/\D/g, '');
          const idCliente = Number(funil.id_cliente);
          if ((cnpj && existingCnpjs.has(cnpj)) || (Number.isInteger(idCliente) && idCliente > 0 && existingClientIds.has(idCliente))) continue;
          const observations: Array<{ data?: string; observacao: string }> = [];
          if (funil.observacao) observations.push({ observacao: String(funil.observacao) });
          if (funil.historico) {
            for (const line of String(funil.historico).split(/\r?\n/)) {
              const match = line.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(.+)$/);
              if (match) observations.push({ data: `${match[3]}-${match[2]}-${match[1]}`, observacao: match[4].trim() });
            }
          }
          pending.push({
            ...funil,
            ticket_onboarding: funil.ticket_onboarding || funil.ticket || '',
            id_cliente: Number.isInteger(idCliente) && idCliente > 0 ? idCliente : null,
            ev: funil.ev || funil.executivo,
            observacoes: observations,
          });
          if (cnpj) existingCnpjs.add(cnpj);
          if (Number.isInteger(idCliente) && idCliente > 0) existingClientIds.add(idCliente);
        }
        const inserted = await configuredAdapter.importFunis(pending);
        await recordActiveImport('Importação de funil', inserted, inserted < funis.length ? 'warning' : 'success');
        return inserted;
      })();
    }
    const db = getDatabase();
    const validRegionalIds = new Set(
      (db.prepare('SELECT id FROM regionais').all() as Array<{ id: number }>).map(row => row.id)
    );
    const sqliteValue = (value: any): string | number | bigint | Buffer | null => {
      if (value === undefined || value === null || value === '') return null;
      if (typeof value === 'boolean') return value ? 1 : 0;
      if (value instanceof Date) return value.toISOString();
      if (typeof value === 'object') return String(value);
      return value;
    };
    const stmt = db.prepare(`
      INSERT INTO funil (
        lumiax_genomica, responsavel, ticket_onboarding, id_cliente, cnpj,
        razao_social, nome_fantasia, uf, regional, ev, carteira, coordenador,
        gerente, potencial, fase, entrada_mapeamento, saida_mapeamento, sla_mapeamento,
        entrada_proposta, saida_proposta, sla_proposta, entrada_negociacao, saida_negociacao,
        sla_negociacao, entrada_contrato, saida_contrato, sla_contrato, entrada_implantacao,
        saida_implantacao, sla_implantacao, entrada_acompanhamento, saida_acompanhamento,
        sla_acompanhamento, entrada_declinou, saida_declinou, sla_declinou, entrada_concluido,
        saida_concluido, sla_concluido, observacao, historico, selecionados
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const existingCnpjs = new Set(
      (db.prepare(`SELECT cnpj FROM funil WHERE cnpj IS NOT NULL AND cnpj <> ''`).all() as Array<{ cnpj: string }>)
        .map(row => String(row.cnpj).replace(/\D/g, ''))
        .filter(Boolean)
    );
    const existingClientIds = new Set(
      (db.prepare('SELECT id_cliente FROM funil WHERE id_cliente IS NOT NULL AND id_cliente > 0').all() as Array<{ id_cliente: number }>)
        .map(row => Number(row.id_cliente))
    );
    const importTransaction = db.transaction((rows: any[]) => {
      let inserted = 0;
      for (const funil of rows) {
        const cnpj = String(funil.cnpj || '').replace(/\D/g, '');
        const parsedIdCliente = Number(funil.id_cliente);
        const idCliente = Number.isInteger(parsedIdCliente) ? parsedIdCliente : 0;
        if ((cnpj && existingCnpjs.has(cnpj)) || (Number.isInteger(idCliente) && idCliente > 0 && existingClientIds.has(idCliente))) continue;
        const result = stmt.run(
          ...[
            funil.lumiax_genomica, funil.responsavel, funil.ticket_onboarding,
            validRegionalIds.has(idCliente) ? idCliente : null,
            funil.cnpj, funil.razao_social, funil.nome_fantasia, funil.uf, funil.regional,
            funil.ev, funil.carteira, funil.coordenador, funil.gerente, funil.potencial,
            funil.fase, funil.entrada_mapeamento, funil.saida_mapeamento, funil.sla_mapeamento,
            funil.entrada_proposta, funil.saida_proposta, funil.sla_proposta,
            funil.entrada_negociacao, funil.saida_negociacao, funil.sla_negociacao,
            funil.entrada_contrato, funil.saida_contrato, funil.sla_contrato,
            funil.entrada_implantacao, funil.saida_implantacao, funil.sla_implantacao,
            funil.entrada_acompanhamento, funil.saida_acompanhamento, funil.sla_acompanhamento,
            funil.entrada_declinou, funil.saida_declinou, funil.sla_declinou,
            funil.entrada_concluido, funil.saida_concluido, funil.sla_concluido,
            funil.observacao, funil.historico, funil.selecionados
          ].map(sqliteValue)
        );
        if (funil.observacao) {
          const observationMatch = String(funil.observacao).match(/^(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(.*)$/);
          const observationDate = observationMatch
            ? `${observationMatch[3]}-${observationMatch[2]}-${observationMatch[1]}`
            : new Date().toISOString();
          const observationText = observationMatch ? observationMatch[4] : String(funil.observacao);
          db.prepare('INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)')
            .run(result.lastInsertRowid, observationDate, observationText);
        }
        if (funil.historico) {
          const historyInsert = db.prepare('INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)');
          for (const line of String(funil.historico).split(/\r?\n/)) {
            const match = line.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(.+)$/);
            if (match) historyInsert.run(result.lastInsertRowid, `${match[3]}-${match[2]}-${match[1]}`, match[4].trim());
          }
        }
        if (cnpj) existingCnpjs.add(cnpj);
        if (Number.isInteger(idCliente) && idCliente > 0) existingClientIds.add(idCliente);
        inserted += 1;
      }
      return inserted;
    });

    let inserted: number;
    try {
      inserted = importTransaction(funis);
    } catch (error) {
      log.error('Falha ao importar funis.', error);
      recordImportOperation('Importação de funil', 0, 'error', undefined, error instanceof Error ? error.message : String(error));
      throw error;
    }
    recordImportOperation('Importação de funil', inserted, inserted < funis.length ? 'warning' : 'success');
    return inserted;
  });

  handleIpc('funil:update', async (_, id, funil) => {
    if (configuredAdapter?.isConnected()) {
      await configuredAdapter.updateFunil(id, { ...funil, ticket_onboarding: funil.ticket_onboarding || funil.ticket || '', ev: funil.executivo || funil.ev });
      return true;
    }
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE funil SET
        lumiax_genomica = ?, responsavel = ?, ticket_onboarding = ?, id_cliente = ?,
        cnpj = ?, razao_social = ?, nome_fantasia = ?, uf = ?, regional = ?, ev = ?,
        carteira = ?, coordenador = ?, gerente = ?, potencial = ?, fase = ?,
        entrada_mapeamento = ?, saida_mapeamento = ?, sla_mapeamento = ?,
        entrada_proposta = ?, saida_proposta = ?, sla_proposta = ?,
        entrada_negociacao = ?, saida_negociacao = ?, sla_negociacao = ?,
        entrada_contrato = ?, saida_contrato = ?, sla_contrato = ?,
        entrada_implantacao = ?, saida_implantacao = ?, sla_implantacao = ?,
        entrada_acompanhamento = ?, saida_acompanhamento = ?, sla_acompanhamento = ?,
        entrada_declinou = ?, saida_declinou = ?, sla_declinou = ?,
        entrada_concluido = ?, saida_concluido = ?, sla_concluido = ?,
        observacao = ?, historico = ?, selecionados = ?,
        data_atualizacao = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(
      funil.lumiax_genomica,
      funil.responsavel,
      funil.ticket_onboarding,
      funil.id_cliente,
      funil.cnpj,
      funil.razao_social,
      funil.nome_fantasia,
      funil.uf,
      funil.regional,
      funil.executivo || funil.ev,
      funil.carteira,
      funil.coordenador,
      funil.gerente,
      funil.potencial,
      funil.fase,
      funil.entrada_mapeamento,
      funil.saida_mapeamento,
      funil.sla_mapeamento,
      funil.entrada_proposta,
      funil.saida_proposta,
      funil.sla_proposta,
      funil.entrada_negociacao,
      funil.saida_negociacao,
      funil.sla_negociacao,
      funil.entrada_contrato,
      funil.saida_contrato,
      funil.sla_contrato,
      funil.entrada_implantacao,
      funil.saida_implantacao,
      funil.sla_implantacao,
      funil.entrada_acompanhamento,
      funil.saida_acompanhamento,
      funil.sla_acompanhamento,
      funil.entrada_declinou,
      funil.saida_declinou,
      funil.sla_declinou,
      funil.entrada_concluido,
      funil.saida_concluido,
      funil.sla_concluido,
      funil.observacao,
      funil.historico,
      funil.selecionados,
      id
    );
    return true;
  });

  handleIpc('funil:delete', async (_, id: number) => {
    if (configuredAdapter?.isConnected()) {
      await configuredAdapter.deleteFunil(id);
      return true;
    }
    const db = getDatabase();
    db.prepare('DELETE FROM funil WHERE id = ?').run(id);
    return true;
  });

  handleIpc('funil:deleteMany', async (_, ids: number[]) => {
    if (!Array.isArray(ids) || ids.length === 0) return 0;
    if (configuredAdapter?.isConnected()) {
      await configuredAdapter.deleteFunis(ids.filter((id) => Number.isInteger(id)));
      return ids.length;
    }
    const db = getDatabase();
    const deleteTransaction = db.transaction((recordIds: number[]) => {
      const stmt = db.prepare('DELETE FROM funil WHERE id = ?');
      for (const id of recordIds) {
        if (Number.isInteger(id)) stmt.run(id);
      }
    });
    deleteTransaction(ids);
    return ids.length;
  });

  // IPC Handlers for Observacoes
  handleIpc('observacoes:add', async (_, funilId, observacao, data) => {
    if (configuredAdapter?.isConnected()) {
      const result = await configuredAdapter.addObservacao(funilId, { observacao, data });
      return result.id;
    }
    const db = getDatabase();
    const stmt = db.prepare('INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)');
    const result = stmt.run(funilId, data || new Date().toISOString(), observacao);
    return result.lastInsertRowid;
  });

  handleIpc('observacoes:getByFunilId', async (_, funilId: number) => {
    if (configuredAdapter?.isConnected()) return configuredAdapter.getObservacoes(funilId);
    const db = getDatabase();
    const result = db.prepare('SELECT * FROM observacoes WHERE funil_id = ? ORDER BY data DESC').all(funilId);
    return result;
  });

  handleIpc('observacoes:import', (_, rows: any[]) => {
    assertRecordList(rows, 'observações');
    if (configuredAdapter?.isConnected()) {
      return (async () => {
        let updated = 0;
        let ignored = 0;
        for (const row of Array.isArray(rows) ? rows : []) {
          const cnpj = String(row.cnpj || row.CNPJ || '').replace(/\D/g, '');
          const text = String(row.observacao || row.Observação || row.Observacoes || '').trim();
          const match = String(row.data || row.Data || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (!cnpj || !text || !match) {
            ignored += 1;
            continue;
          }
          const funil = (await configuredAdapter.getFunis({ search: cnpj }))
            .find((item) => String(item.cnpj || '').replace(/\D/g, '') === cnpj);
          if (!funil) {
            ignored += 1;
            continue;
          }
          await configuredAdapter.addObservacao(funil.id, { data: `${match[1]}-${match[2]}-${match[3]}`, observacao: text });
          updated += 1;
        }
        await recordActiveImport('Importação de observações', updated, ignored > 0 ? 'warning' : 'success');
        return { updated, ignored };
      })();
    }
    const db = getDatabase();
    const insert = db.prepare('INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)');
    const findFunil = db.prepare("SELECT id FROM funil WHERE replace(replace(replace(replace(cnpj, '.', ''), '/', ''), '-', ''), ' ', '') = ? LIMIT 1");
    const result = db.transaction((items: any[]) => {
      let updated = 0;
      let ignored = 0;
      for (const row of items) {
        const cnpj = String(row.cnpj || row.CNPJ || '').replace(/\D/g, '');
        const text = String(row.observacao || row.Observação || row.Observacoes || '').trim();
        const match = String(row.data || row.Data || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!cnpj || !text || !match) {
          ignored += 1;
          continue;
        }
        const funil = findFunil.get(cnpj) as { id?: number } | undefined;
        if (!funil?.id) {
          ignored += 1;
          continue;
        }
        insert.run(funil.id, `${match[1]}-${match[2]}-${match[3]}`, text);
        updated += 1;
      }
      return { updated, ignored };
    })(Array.isArray(rows) ? rows : []);
    recordImportOperation('Importação de observações', result.updated, result.ignored > 0 ? 'warning' : 'success');
    return result;
  });

  handleIpc('systemHealth:getMetrics', () => {
    if (configuredAdapter?.isConnected()) return configuredAdapter.getSystemHealthMetrics();
    return getSystemHealthMetrics();
  });

  // IPC Handlers for Dashboard stats
  handleIpc('dashboard:getStats', async (_, filters) => {
    if (configuredAdapter?.isConnected()) {
      const [funis, regionais] = await Promise.all([
        configuredAdapter.getFunis(),
        configuredAdapter.getRegionais(),
      ]);
      const regionalByCnpj = new Map<string, (typeof regionais)[number]>();
      for (const regional of regionais) {
        const cnpj = String(regional.cnpj || '').replace(/\D/g, '');
        if (cnpj && !regionalByCnpj.has(cnpj)) regionalByCnpj.set(cnpj, regional);
      }
      const filteredFunis = funis.filter((funil) => {
        const regional = regionalByCnpj.get(String(funil.cnpj || '').replace(/\D/g, ''));
        const regionalName = String(regional?.desc_regional_matriz || funil.regional || '');
        return (!filters?.negocio || String(funil.lumiax_genomica || '').toLowerCase().includes(String(filters.negocio).toLowerCase()))
          && (!filters?.regional || regionalName.toLowerCase().includes(String(filters.regional).toLowerCase()))
          && (!filters?.fase || String(funil.fase) === String(filters.fase))
          && (!filters?.responsavel || String(funil.responsavel || '').toLowerCase().includes(String(filters.responsavel).toLowerCase()))
          && (!filters?.executivo || String(funil.ev || '').toLowerCase().includes(String(filters.executivo).toLowerCase()))
          && (!filters?.carteira || String(funil.carteira || '').toLowerCase().includes(String(filters.carteira).toLowerCase()));
      });
      const byResponsavel = new Map<string, { responsavel: string; total: number; count: number }>();
      const byFase = new Map<string, { fase: string; total: number; count: number }>();
      for (const funil of filteredFunis) {
        const potential = Number(funil.potencial) || 0;
        const responsavel = String(funil.responsavel || '');
        const fase = String(funil.fase || '');
        const ownerGroup = byResponsavel.get(responsavel) || { responsavel, total: 0, count: 0 };
        ownerGroup.total += potential;
        ownerGroup.count += 1;
        byResponsavel.set(responsavel, ownerGroup);
        const phaseGroup = byFase.get(fase) || { fase, total: 0, count: 0 };
        phaseGroup.total += potential;
        phaseGroup.count += 1;
        byFase.set(fase, phaseGroup);
      }
      const currentMonth = new Date().toISOString().slice(0, 7);
      return {
        totalPotencial: filteredFunis.reduce((total, funil) => total + (Number(funil.potencial) || 0), 0),
        totalCount: filteredFunis.length,
        newItemsThisMonth: filteredFunis.filter((funil) => String(funil.data_criacao || '').slice(0, 7) === currentMonth).length,
        potencialPorResponsavel: [...byResponsavel.values()].sort((a, b) => b.total - a.total),
        potencialPorFase: [...byFase.values()].sort((a, b) => a.fase.localeCompare(b.fase, undefined, { numeric: true })),
      };
    }
    const db = getDatabase();
    let whereClause = '1=1';
    const params: any[] = [];

    if (filters?.negocio) {
      whereClause += ` AND f.lumiax_genomica LIKE ?`;
      params.push(`%${filters.negocio}%`);
    }
    if (filters?.regional) {
      whereClause += ` AND COALESCE(r.desc_regional_matriz, f.regional) LIKE ?`;
      params.push(`%${filters.regional}%`);
    }
    if (filters?.fase) {
      whereClause += ` AND f.fase = ?`;
      params.push(filters.fase);
    }
    if (filters?.responsavel) {
      whereClause += ` AND f.responsavel LIKE ?`;
      params.push(`%${filters.responsavel}%`);
    }
    if (filters?.executivo) {
      whereClause += ` AND f.ev LIKE ?`;
      params.push(`%${filters.executivo}%`);
    }
    if (filters?.carteira) {
      whereClause += ` AND f.carteira LIKE ?`;
      params.push(`%${filters.carteira}%`);
    }

    const totalPotencial = db.prepare(`
      SELECT COALESCE(SUM(f.potencial), 0) as total FROM funil f
      LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${normalizedCnpj('r2.cnpj')} = ${normalizedCnpj('f.cnpj')}
        ORDER BY r2.id LIMIT 1
      ) WHERE ${whereClause}
    `).get(...params);

    const totalCount = db.prepare(`
      SELECT COUNT(*) as count FROM funil f
      LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${normalizedCnpj('r2.cnpj')} = ${normalizedCnpj('f.cnpj')}
        ORDER BY r2.id LIMIT 1
      ) WHERE ${whereClause}
    `).get(...params);

    const currentMonth = new Date().toISOString().slice(0, 7);
    const newItemsThisMonth = db.prepare(`
      SELECT COUNT(*) as count FROM funil f
      LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${normalizedCnpj('r2.cnpj')} = ${normalizedCnpj('f.cnpj')}
        ORDER BY r2.id LIMIT 1
      )
      WHERE strftime('%Y-%m', f.data_criacao) = ? AND ${whereClause}
    `).get(currentMonth, ...params);

    const potencialPorResponsavel = db.prepare(`
      SELECT f.responsavel, SUM(f.potencial) as total, COUNT(*) as count
      FROM funil f LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${normalizedCnpj('r2.cnpj')} = ${normalizedCnpj('f.cnpj')}
        ORDER BY r2.id LIMIT 1
      )
      WHERE ${whereClause} GROUP BY f.responsavel ORDER BY total DESC
    `).all(...params);

    const potencialPorFase = db.prepare(`
      SELECT f.fase, SUM(f.potencial) as total, COUNT(*) as count
      FROM funil f LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${normalizedCnpj('r2.cnpj')} = ${normalizedCnpj('f.cnpj')}
        ORDER BY r2.id LIMIT 1
      )
      WHERE ${whereClause} GROUP BY f.fase ORDER BY f.fase
    `).all(...params) as any[];

    return {
      totalPotencial: (totalPotencial as any).total,
      totalCount: (totalCount as any).count,
      newItemsThisMonth: (newItemsThisMonth as any).count,
      potencialPorResponsavel,
      potencialPorFase,
    };
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
