import { app, ipcMain, BrowserWindow } from "electron";
import path, { dirname } from "path";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
const DB_PATH = path.join(app.getPath("userData"), "funil_comercial.db");
function initializeDatabase() {
  const db = new Database(DB_PATH);
  db.pragma("foreign_keys = ON");
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
  db.exec(`
    CREATE TABLE IF NOT EXISTS observacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      funil_id INTEGER NOT NULL,
      data DATETIME DEFAULT CURRENT_TIMESTAMP,
      observacao TEXT NOT NULL,
      FOREIGN KEY (funil_id) REFERENCES funil(id) ON DELETE CASCADE
    )
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_funil_id_cliente ON funil(id_cliente);
    CREATE INDEX IF NOT EXISTS idx_funil_fase ON funil(fase);
    CREATE INDEX IF NOT EXISTS idx_funil_cnpj ON funil(cnpj);
    CREATE INDEX IF NOT EXISTS idx_regionais_cnpj ON regionais(cnpj);
    CREATE INDEX IF NOT EXISTS idx_observacoes_funil_id ON observacoes(funil_id);
  `);
  return db;
}
function getDatabase() {
  const db = new Database(DB_PATH);
  db.pragma("foreign_keys = ON");
  return db;
}
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = dirname(__filename$1);
let mainWindow = null;
function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return;
  }
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname$1, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname$1, "../dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
app.whenReady().then(() => {
  initializeDatabase();
  createWindow();
  ipcMain.handle("regionais:getAll", () => {
    const db = getDatabase();
    const result = db.prepare("SELECT * FROM regionais ORDER BY nome_cliente").all();
    return result;
  });
  ipcMain.handle("regionais:getById", (_, id) => {
    const db = getDatabase();
    const result = db.prepare("SELECT * FROM regionais WHERE id = ?").get(id);
    return result || null;
  });
  ipcMain.handle("regionais:insert", (_, regional) => {
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
  ipcMain.handle("regionais:update", (_, id, regional) => {
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
  ipcMain.handle("regionais:delete", (_, id) => {
    const db = getDatabase();
    db.prepare("DELETE FROM regionais WHERE id = ?").run(id);
    return true;
  });
  ipcMain.handle("regionais:clear", () => {
    const db = getDatabase();
    db.prepare("DELETE FROM regionais").run();
    return true;
  });
  ipcMain.handle("funil:getAll", () => {
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
  ipcMain.handle("funil:getById", (_, id) => {
    const db = getDatabase();
    const funil = db.prepare(`
      SELECT f.*, r.nome_cliente, r.desc_representante, r.desc_regional_matriz,
             r.executivo as executivo_regional, r.nome_coordenador as coord_regional
      FROM funil f
      LEFT JOIN regionais r ON f.cnpj = r.cnpj
      WHERE f.id = ?
    `).get(id);
    const observacoes = db.prepare("SELECT * FROM observacoes WHERE funil_id = ? ORDER BY data DESC").all(id);
    if (!funil) return null;
    return { ...funil, observacoes };
  });
  ipcMain.handle("funil:insert", (_, funil) => {
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
  ipcMain.handle("funil:update", (_, id, funil) => {
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
  ipcMain.handle("funil:delete", (_, id) => {
    const db = getDatabase();
    db.prepare("DELETE FROM funil WHERE id = ?").run(id);
    return true;
  });
  ipcMain.handle("observacoes:add", (_, funilId, observacao) => {
    const db = getDatabase();
    const stmt = db.prepare("INSERT INTO observacoes (funil_id, observacao) VALUES (?, ?)");
    const result = stmt.run(funilId, observacao);
    return result.lastInsertRowid;
  });
  ipcMain.handle("observacoes:getByFunilId", (_, funilId) => {
    const db = getDatabase();
    const result = db.prepare("SELECT * FROM observacoes WHERE funil_id = ? ORDER BY data DESC").all(funilId);
    return result;
  });
  ipcMain.handle("dashboard:getStats", (_, filters) => {
    const db = getDatabase();
    let whereClause = "1=1";
    const params = [];
    if (filters == null ? void 0 : filters.nome_cliente) {
      whereClause += ` AND f.nome_fantasia LIKE ?`;
      params.push(`%${filters.nome_cliente}%`);
    }
    if (filters == null ? void 0 : filters.regional) {
      whereClause += ` AND f.regional = ?`;
      params.push(filters.regional);
    }
    if (filters == null ? void 0 : filters.fase) {
      whereClause += ` AND f.fase = ?`;
      params.push(filters.fase);
    }
    if (filters == null ? void 0 : filters.responsavel) {
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
    const currentMonth = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
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
    `).all(...params);
    return {
      totalPotencial: totalPotencial.total,
      totalCount: totalCount.count,
      newItemsThisMonth: newItemsThisMonth.count,
      potencialPorResponsavel,
      potencialPorFase
    };
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
