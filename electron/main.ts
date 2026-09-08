import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { initializeDatabase, getDatabase } from './database';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
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
    mainWindow.webContents.openDevTools();
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

  // IPC Handlers for Regionais
  ipcMain.handle('regionais:getAll', () => {
    const db = getDatabase();
    const result = db.prepare('SELECT * FROM regionais ORDER BY nome_fantasia').all();
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
      INSERT INTO regionais (carteira, nome_fantasia, razao_social, cnpj, executivo, regional, coordenador, gerente)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      regional.carteira,
      regional.nome_fantasia,
      regional.razao_social,
      regional.cnpj,
      regional.executivo,
      regional.regional,
      regional.coordenador,
      regional.gerente
    );
    return result.lastInsertRowid;
  });

  ipcMain.handle('regionais:update', (_, id, regional) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE regionais SET
        carteira = ?, nome_fantasia = ?, razao_social = ?, cnpj = ?,
        executivo = ?, regional = ?, coordenador = ?, gerente = ?
      WHERE id = ?
    `);
    stmt.run(
      regional.carteira,
      regional.nome_fantasia,
      regional.razao_social,
      regional.cnpj,
      regional.executivo,
      regional.regional,
      regional.coordenador,
      regional.gerente,
      id
    );
    return true;
  });

  ipcMain.handle('regionais:delete', (_, id: number) => {
    const db = getDatabase();
    db.prepare('DELETE FROM regionais WHERE id = ?').run(id);
    return true;
  });

  // IPC Handlers for Funil
  ipcMain.handle('funil:getAll', () => {
    const db = getDatabase();
    const result = db.prepare(`
      SELECT f.*, r.nome_fantasia, r.razao_social, r.cnpj, r.carteira, 
             r.executivo, r.regional, r.coordenador, r.gerente
      FROM funil f
      LEFT JOIN regionais r ON f.id_cliente = r.id
      ORDER BY f.data_criacao DESC
    `).all();
    return result;
  });

  ipcMain.handle('funil:getById', (_, id: number) => {
    const db = getDatabase();
    const funil = db.prepare(`
      SELECT f.*, r.nome_fantasia, r.razao_social, r.cnpj, r.carteira,
             r.executivo, r.regional, r.coordenador, r.gerente
      FROM funil f
      LEFT JOIN regionais r ON f.id_cliente = r.id
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
      INSERT INTO funil (ticket, negocio, id_cliente, potencial, fase, responsavel)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      funil.ticket,
      funil.negocio,
      funil.id_cliente,
      funil.potencial,
      funil.fase,
      funil.responsavel
    );
    return result.lastInsertRowid;
  });

  ipcMain.handle('funil:update', (_, id, funil) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE funil SET
        ticket = ?, negocio = ?, id_cliente = ?, potencial = ?,
        fase = ?, responsavel = ?, data_atualizacao = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(
      funil.ticket,
      funil.negocio,
      funil.id_cliente,
      funil.potencial,
      funil.fase,
      funil.responsavel,
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

    if (filters?.negocio) {
      whereClause += ` AND f.negocio LIKE ?`;
      params.push(`%${filters.negocio}%`);
    }
    if (filters?.regional) {
      whereClause += ` AND r.regional = ?`;
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
      LEFT JOIN regionais r ON f.id_cliente = r.id WHERE ${whereClause}
    `).get(...params);

    const totalCount = db.prepare(`
      SELECT COUNT(*) as count FROM funil f
      LEFT JOIN regionais r ON f.id_cliente = r.id WHERE ${whereClause}
    `).get(...params);

    const currentMonth = new Date().toISOString().slice(0, 7);
    const newItemsThisMonth = db.prepare(`
      SELECT COUNT(*) as count FROM funil f
      LEFT JOIN regionais r ON f.id_cliente = r.id
      WHERE strftime('%Y-%m', f.data_criacao) = ? AND ${whereClause}
    `).get(currentMonth, ...params);

    const potencialPorResponsavel = db.prepare(`
      SELECT f.responsavel, SUM(f.potencial) as total, COUNT(*) as count
      FROM funil f LEFT JOIN regionais r ON f.id_cliente = r.id
      WHERE ${whereClause} GROUP BY f.responsavel ORDER BY total DESC
    `).all(...params);

    const potencialPorFase = db.prepare(`
      SELECT f.fase, SUM(f.potencial) as total, COUNT(*) as count
      FROM funil f LEFT JOIN regionais r ON f.id_cliente = r.id
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
