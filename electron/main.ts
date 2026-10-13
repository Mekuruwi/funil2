import { app, BrowserWindow, ipcMain, Menu, shell, type IpcMainInvokeEvent } from 'electron';
import log from 'electron-log/main';
import path from 'path';
import { initializeDatabase, getDatabase as getLegacyDatabase, recordImportOperation } from './database';
import { DatabaseFactory } from './database/DatabaseFactory';
import type { DatabaseAdapter } from './database/DatabaseAdapter';
import type { DatabaseConfig } from './database/types';
import { loadDatabaseConfig, saveDatabaseConfig } from './database/configStore';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { registerDocumentIpcHandlers } from './ipc/documentHandlers';
import { registerDashboardIpcHandlers } from './ipc/dashboardHandlers';
import { assertDatabaseConfig, assertRecordList } from './ipc/validation';
import { attachObservations as attachHistory, normalizedCnpjSql, parseLegacyHistory } from './domain/funnelHistory';
import electronUpdater from 'electron-updater';

const { autoUpdater } = electronUpdater;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
log.initialize();

let mainWindow: BrowserWindow | null = null;
let configuredAdapter: DatabaseAdapter | null = null;
let configuredDatabase: DatabaseConfig | null = null;
let manualUpdateCheckPending = false;

function sendUpdateStatus(status: Record<string, unknown>) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updates:status', status);
  }
}

function configureAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.logger = log;

  autoUpdater.on('update-available', (info) => {
    manualUpdateCheckPending = false;
    sendUpdateStatus({ status: 'available', version: info.version });
  });
  autoUpdater.on('update-not-available', () => {
    if (manualUpdateCheckPending) {
      sendUpdateStatus({ status: 'not-available', currentVersion: app.getVersion() });
    }
    manualUpdateCheckPending = false;
  });
  autoUpdater.on('download-progress', (progress) => {
    sendUpdateStatus({ status: 'downloading', percent: Math.round(progress.percent) });
  });
  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus({ status: 'downloaded', version: info.version });
  });
  autoUpdater.on('error', (error) => {
    log.warn('Falha ao verificar ou baixar uma atualização.', error);
    if (manualUpdateCheckPending) sendUpdateStatus({ status: 'error' });
    manualUpdateCheckPending = false;
  });
}

async function checkForUpdates(manual = false) {
  if (!app.isPackaged) {
    if (manual) sendUpdateStatus({ status: 'error' });
    return;
  }

  manualUpdateCheckPending = manual;
  if (manual) sendUpdateStatus({ status: 'checking' });
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    log.warn('Não foi possível consultar atualizações.', error);
    if (manualUpdateCheckPending) sendUpdateStatus({ status: 'error' });
    manualUpdateCheckPending = false;
  }
}

function handleIpc(channel: string, handler: (event: IpcMainInvokeEvent, ...args: any[]) => unknown) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!mainWindow || event.sender.id !== mainWindow.webContents.id || event.senderFrame !== event.sender.mainFrame) {
      throw new Error('Origem inválida para chamada IPC.');
    }
    return handler(event, ...args);
  });
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
function attachObservations(db: ReturnType<typeof getDatabase>, funis: any[]) {
  if (funis.length === 0) return [];

  // Uma única consulta substitui uma consulta por card (N+1).
  const ids = funis.map(funil => funil.id);
  const placeholders = ids.map(() => '?').join(',');
  const observations = db.prepare(
    `SELECT * FROM observacoes WHERE funil_id IN (${placeholders}) ORDER BY data DESC, id DESC`
  ).all(...ids) as any[];
  return attachHistory(funis, observations);
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
    fullscreen: true,
    frame: false,
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
  Menu.setApplicationMenu(null);
  configureAutoUpdater();
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

  // Dá tempo para a interface registrar os eventos antes da consulta silenciosa inicial.
  setTimeout(() => { void checkForUpdates(); }, 8000);

  handleIpc('window:minimize', () => mainWindow?.minimize());
  handleIpc('window:toggleMaximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
      mainWindow.maximize();
    } else if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  handleIpc('window:toggleFullscreen', () => {
    if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
  });
  handleIpc('window:close', () => mainWindow?.close());
  handleIpc('window:editCommand', (_event, command: string) => {
    const commands = ['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll'] as const;
    if (commands.includes(command as typeof commands[number]) && mainWindow) {
      mainWindow.webContents[command as typeof commands[number]]();
    }
  });

  handleIpc('app:logError', (_event, context: string, message: string, stack?: string) => {
    log.error(`[Renderer] ${context.slice(0, 200)}: ${message.slice(0, 2000)}`, stack?.slice(0, 8000));
  });

  handleIpc('app:openUninstallSettings', async () => {
    if (process.platform !== 'win32') {
      throw new Error('A tela de aplicativos instalados está disponível apenas no Windows.');
    }
    await shell.openExternal('ms-settings:appsfeatures');
  });

  handleIpc('updates:check', async () => checkForUpdates(true));
  handleIpc('updates:download', async () => {
    if (!app.isPackaged) {
      sendUpdateStatus({ status: 'error' });
      return;
    }
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      log.warn('Não foi possível baixar a atualização.', error);
      sendUpdateStatus({ status: 'error' });
    }
  });
  handleIpc('updates:install', () => {
    if (app.isPackaged) autoUpdater.quitAndInstall(false, true);
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

  registerDocumentIpcHandlers(handleIpc);

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
        WHERE ${normalizedCnpjSql('r2.cnpj')} = ${normalizedCnpjSql('f.cnpj')}
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
        WHERE ${normalizedCnpjSql('r2.cnpj')} = ${normalizedCnpjSql('f.cnpj')}
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
        WHERE (${normalizedCnpjSql('cnpj')} = ? AND ? <> '')
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

  handleIpc('funil:replaceResponsavel', async (_, currentName: unknown, nextName: unknown) => {
    if (typeof currentName !== 'string' || typeof nextName !== 'string') throw new Error('Informe o responsável atual e o novo responsável.');
    const current = currentName.trim();
    const next = nextName.trim();
    if (!current || !next || current.length > 160 || next.length > 160) throw new Error('Os nomes dos responsáveis devem ter entre 1 e 160 caracteres.');
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
    if (normalize(current) === normalize(next)) throw new Error('Escolha um nome diferente do responsável atual.');
    if (configuredAdapter?.isConnected()) return configuredAdapter.replaceFunilResponsavel(current, next);
    const result = getDatabase().prepare(`
      UPDATE funil SET responsavel = ?, data_atualizacao = CURRENT_TIMESTAMP
      WHERE LOWER(TRIM(responsavel)) = LOWER(?)
    `).run(next, current);
    return result.changes;
  });

  handleIpc('funil:bulkUpdate', async (_, input: unknown) => {
    const fields = ['responsavel', 'regional', 'carteira', 'ev', 'coordenador', 'gerente', 'lumiax_genomica', 'uf'] as const;
    const operators = ['equals', 'contains', 'startsWith', 'isEmpty', 'isNotEmpty'] as const;
    if (!input || typeof input !== 'object') throw new Error('Regra de atualização inválida.');
    const request = input as { field?: unknown; newValue?: unknown; conditions?: unknown };
    if (typeof request.field !== 'string' || !fields.includes(request.field as typeof fields[number])) throw new Error('Selecione um campo válido para atualizar.');
    if (typeof request.newValue !== 'string' || request.newValue.trim().length === 0 || request.newValue.length > 500) throw new Error('Informe um novo valor de até 500 caracteres.');
    if (!Array.isArray(request.conditions) || request.conditions.length === 0 || request.conditions.length > 5) throw new Error('Adicione de 1 a 5 condições para limitar a atualização.');
    const conditions = request.conditions.map((raw, index) => {
      if (!raw || typeof raw !== 'object') throw new Error(`Condição ${index + 1} inválida.`);
      const condition = raw as { field?: unknown; operator?: unknown; value?: unknown };
      if (typeof condition.field !== 'string' || !fields.includes(condition.field as typeof fields[number])) throw new Error(`Campo inválido na condição ${index + 1}.`);
      if (typeof condition.operator !== 'string' || !operators.includes(condition.operator as typeof operators[number])) throw new Error(`Operador inválido na condição ${index + 1}.`);
      if (condition.operator !== 'isEmpty' && condition.operator !== 'isNotEmpty' && (typeof condition.value !== 'string' || condition.value.length === 0)) {
        throw new Error(`Informe o valor da condição ${index + 1}.`);
      }
      return {
        field: condition.field as typeof fields[number],
        operator: condition.operator as typeof operators[number],
        value: typeof condition.value === 'string' ? condition.value.slice(0, 500) : '',
      };
    });
    if (configuredAdapter?.isConnected()) return configuredAdapter.bulkUpdateFunil(request.field as typeof fields[number], request.newValue.trim(), conditions);

    const clauses: string[] = [];
    const params: string[] = [];
    for (const condition of conditions) {
      const column = condition.field;
      switch (condition.operator) {
        case 'equals': clauses.push(`LOWER(TRIM(COALESCE(${column}, ''))) = LOWER(?)`); params.push(condition.value.trim()); break;
        case 'contains': clauses.push(`LOWER(COALESCE(${column}, '')) LIKE LOWER(?) ESCAPE '!'`); params.push(`%${condition.value.replace(/[!%_]/g, '!$&')}%`); break;
        case 'startsWith': clauses.push(`LOWER(COALESCE(${column}, '')) LIKE LOWER(?) ESCAPE '!'`); params.push(`${condition.value.replace(/[!%_]/g, '!$&')}%`); break;
        case 'isEmpty': clauses.push(`(${column} IS NULL OR TRIM(${column}) = '')`); break;
        case 'isNotEmpty': clauses.push(`(${column} IS NOT NULL AND TRIM(${column}) <> '')`); break;
      }
    }
    const result = getDatabase().prepare(`UPDATE funil SET ${request.field} = ?, data_atualizacao = CURRENT_TIMESTAMP WHERE ${clauses.join(' AND ')}`)
      .run(request.newValue.trim(), ...params);
    return result.changes;
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

  registerDashboardIpcHandlers(handleIpc, { getAdapter: () => configuredAdapter, getDatabase });
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
