import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { initializeDatabase, getDatabase } from './database';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;

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
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    
    // 2. DESATIVAR DEVTOOLS AUTOMÁTICO
    // mainWindow.webContents.openDevTools(); // <-- MANTENHA COMENTADO OU APAGUE
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Initialize database
  initializeDatabase();

  createWindow();

  // IPC Handlers for Regionais (base de regionais)
  ipcMain.handle('regionais:getAll', () => {
    const db = getDatabase();
    const result = db.prepare('SELECT * FROM regionais ORDER BY nome_cliente').all();
    return result;
  });

  ipcMain.handle('regionais:getById', (_, id: number) => {
    const db = getDatabase();
    const result = db.prepare('SELECT * FROM regionais WHERE id = ?').get(id);
    return result || null;
  });

  ipcMain.handle('regionais:insert', (_, regional) => {
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

  ipcMain.handle('regionais:update', (_, id, regional) => {
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

  ipcMain.handle('regionais:delete', (_, id: number) => {
    const db = getDatabase();
    db.prepare('DELETE FROM regionais WHERE id = ?').run(id);
    return true;
  });

  // Limpa todos os registros da tabela regionais (operação slot)
  ipcMain.handle('regionais:clear', () => {
    const db = getDatabase();
    db.prepare('DELETE FROM regionais').run();
    return true;
  });

  // IPC Handlers for Funil (dados do forms)
  ipcMain.handle('funil:getAll', () => {
    const db = getDatabase();
    const result = db.prepare(`
      SELECT f.*, r.nome_cliente, r.desc_representante, r.desc_regional_matriz,
             r.executivo as executivo_regional, r.nome_coordenador as coord_regional
      FROM funil f
      LEFT JOIN regionais r ON f.cnpj = r.cnpj
      ORDER BY f.data_criacao DESC
    `).all();
    return result;
  });

  ipcMain.handle('funil:getById', (_, id: number) => {
    const db = getDatabase();
    const funil = db.prepare(`
      SELECT f.*, r.nome_cliente, r.desc_representante, r.desc_regional_matriz,
             r.executivo as executivo_regional, r.nome_coordenador as coord_regional
      FROM funil f
      LEFT JOIN regionais r ON f.cnpj = r.cnpj
      WHERE f.id = ?
    `).get(id);
    
    const observacoes = db.prepare('SELECT * FROM observacoes WHERE funil_id = ? ORDER BY data DESC')
      .all(id);
    
    if (!funil) return null;
    return { ...funil, observacoes } as any;
  });

  ipcMain.handle('funil:insert', (_, funil) => {
    const db = getDatabase();
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
      funil.ticket_onboarding,
      funil.id_cliente,
      funil.cnpj,
      funil.razao_social,
      funil.nome_fantasia,
      funil.uf,
      funil.regional,
      funil.ev,
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
      funil.selecionados
    );
    return result.lastInsertRowid;
  });

  ipcMain.handle('funil:update', (_, id, funil) => {
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
      funil.ev,
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

  ipcMain.handle('funil:delete', (_, id: number) => {
    const db = getDatabase();
    db.prepare('DELETE FROM funil WHERE id = ?').run(id);
    return true;
  });

  // IPC Handlers for Observacoes
  ipcMain.handle('observacoes:add', (_, funilId, observacao) => {
    const db = getDatabase();
    const stmt = db.prepare('INSERT INTO observacoes (funil_id, observacao) VALUES (?, ?)');
    const result = stmt.run(funilId, observacao);
    return result.lastInsertRowid;
  });

  ipcMain.handle('observacoes:getByFunilId', (_, funilId: number) => {
    const db = getDatabase();
    const result = db.prepare('SELECT * FROM observacoes WHERE funil_id = ? ORDER BY data DESC').all(funilId);
    return result;
  });

  // IPC Handlers for Dashboard stats
  ipcMain.handle('dashboard:getStats', (_, filters) => {
    const db = getDatabase();
    let whereClause = '1=1';
    const params: any[] = [];

    if (filters?.nome_cliente) {
      whereClause += ` AND f.nome_fantasia LIKE ?`;
      params.push(`%${filters.nome_cliente}%`);
    }
    if (filters?.regional) {
      whereClause += ` AND f.regional = ?`;
      params.push(filters.regional);
    }
    if (filters?.fase) {
      whereClause += ` AND f.fase = ?`;
      params.push(filters.fase);
    }
    if (filters?.responsavel) {
      whereClause += ` AND f.responsavel LIKE ?`;
      params.push(`%${filters.responsavel}%`);
    }

    const totalPotencial = db.prepare(`
      SELECT COALESCE(SUM(f.potencial), 0) as total FROM funil f
      LEFT JOIN regionais r ON f.cnpj = r.cnpj WHERE ${whereClause}
    `).get(...params);

    const totalCount = db.prepare(`
      SELECT COUNT(*) as count FROM funil f
      LEFT JOIN regionais r ON f.cnpj = r.cnpj WHERE ${whereClause}
    `).get(...params);

    const currentMonth = new Date().toISOString().slice(0, 7);
    const newItemsThisMonth = db.prepare(`
      SELECT COUNT(*) as count FROM funil f
      LEFT JOIN regionais r ON f.cnpj = r.cnpj
      WHERE strftime('%Y-%m', f.data_criacao) = ? AND ${whereClause}
    `).get(currentMonth, ...params);

    const potencialPorResponsavel = db.prepare(`
      SELECT f.responsavel, SUM(f.potencial) as total, COUNT(*) as count
      FROM funil f LEFT JOIN regionais r ON f.cnpj = r.cnpj
      WHERE ${whereClause} GROUP BY f.responsavel ORDER BY total DESC
    `).all(...params);

    const potencialPorFase = db.prepare(`
      SELECT f.fase, SUM(f.potencial) as total, COUNT(*) as count
      FROM funil f LEFT JOIN regionais r ON f.cnpj = r.cnpj
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
