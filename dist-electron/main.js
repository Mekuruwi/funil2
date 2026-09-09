import { app as i, ipcMain as r, BrowserWindow as p } from "electron";
import d, { dirname as O } from "path";
import T from "better-sqlite3";
import { fileURLToPath as h } from "url";
const l = d.join(i.getPath("userData"), "funil_comercial.db");
function b() {
  const o = new T(l);
  return o.pragma("foreign_keys = ON"), o.exec(`
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
  `), o.exec(`
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
  `), o.exec(`
    CREATE TABLE IF NOT EXISTS observacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      funil_id INTEGER NOT NULL,
      data DATETIME DEFAULT CURRENT_TIMESTAMP,
      observacao TEXT NOT NULL,
      FOREIGN KEY (funil_id) REFERENCES funil(id) ON DELETE CASCADE
    )
  `), o.exec(`
    CREATE INDEX IF NOT EXISTS idx_funil_id_cliente ON funil(id_cliente);
    CREATE INDEX IF NOT EXISTS idx_funil_fase ON funil(fase);
    CREATE INDEX IF NOT EXISTS idx_funil_cnpj ON funil(cnpj);
    CREATE INDEX IF NOT EXISTS idx_regionais_cnpj ON regionais(cnpj);
    CREATE INDEX IF NOT EXISTS idx_observacoes_funil_id ON observacoes(funil_id);
  `), o;
}
function c() {
  const o = new T(l);
  return o.pragma("foreign_keys = ON"), o;
}
const X = h(import.meta.url), E = O(X);
let s = null;
function m() {
  if (s && !s.isDestroyed()) {
    s.focus();
    return;
  }
  s = new p({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: d.join(E, "preload.js"),
      contextIsolation: !0,
      nodeIntegration: !1
    }
  }), process.env.NODE_ENV === "development" || !i.isPackaged ? s.loadURL("http://localhost:5173") : s.loadFile(d.join(E, "../dist/index.html")), s.on("closed", () => {
    s = null;
  });
}
i.whenReady().then(() => {
  b(), m(), r.handle("regionais:getAll", () => c().prepare("SELECT * FROM regionais ORDER BY nome_cliente").all()), r.handle("regionais:getById", (o, a) => c().prepare("SELECT * FROM regionais WHERE id = ?").get(a) || null), r.handle("regionais:insert", (o, a) => c().prepare(`
      INSERT INTO regionais (ent_id_sap, cnpj, raiz, nome_cliente, desc_representante, 
        desc_regional_matriz, executivo, email, nome_coordenador)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
    a.ent_id_sap,
    a.cnpj,
    a.raiz,
    a.nome_cliente,
    a.desc_representante,
    a.desc_regional_matriz,
    a.executivo,
    a.email,
    a.nome_coordenador
  ).lastInsertRowid), r.handle("regionais:update", (o, a, e) => (c().prepare(`
      UPDATE regionais SET
        ent_id_sap = ?, cnpj = ?, raiz = ?, nome_cliente = ?,
        desc_representante = ?, desc_regional_matriz = ?, executivo = ?,
        email = ?, nome_coordenador = ?
      WHERE id = ?
    `).run(
    e.ent_id_sap,
    e.cnpj,
    e.raiz,
    e.nome_cliente,
    e.desc_representante,
    e.desc_regional_matriz,
    e.executivo,
    e.email,
    e.nome_coordenador,
    a
  ), !0)), r.handle("regionais:delete", (o, a) => (c().prepare("DELETE FROM regionais WHERE id = ?").run(a), !0)), r.handle("regionais:clear", () => (c().prepare("DELETE FROM regionais").run(), !0)), r.handle("funil:getAll", () => c().prepare(`
      SELECT f.*, r.nome_cliente, r.desc_representante, r.desc_regional_matriz,
             r.executivo as executivo_regional, r.nome_coordenador as coord_regional
      FROM funil f
      LEFT JOIN regionais r ON f.cnpj = r.cnpj
      ORDER BY f.data_criacao DESC
    `).all()), r.handle("funil:getById", (o, a) => {
    const e = c(), n = e.prepare(`
      SELECT f.*, r.nome_cliente, r.desc_representante, r.desc_regional_matriz,
             r.executivo as executivo_regional, r.nome_coordenador as coord_regional
      FROM funil f
      LEFT JOIN regionais r ON f.cnpj = r.cnpj
      WHERE f.id = ?
    `).get(a), t = e.prepare("SELECT * FROM observacoes WHERE funil_id = ? ORDER BY data DESC").all(a);
    return n ? { ...n, observacoes: t } : null;
  }), r.handle("funil:insert", (o, a) => c().prepare(`
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
    `).run(
    a.lumiax_genomica,
    a.responsavel,
    a.ticket_onboarding,
    a.id_cliente,
    a.cnpj,
    a.razao_social,
    a.nome_fantasia,
    a.uf,
    a.regional,
    a.ev,
    a.carteira,
    a.coordenador,
    a.gerente,
    a.potencial,
    a.fase,
    a.entrada_mapeamento,
    a.saida_mapeamento,
    a.sla_mapeamento,
    a.entrada_proposta,
    a.saida_proposta,
    a.sla_proposta,
    a.entrada_negociacao,
    a.saida_negociacao,
    a.sla_negociacao,
    a.entrada_contrato,
    a.saida_contrato,
    a.sla_contrato,
    a.entrada_implantacao,
    a.saida_implantacao,
    a.sla_implantacao,
    a.entrada_acompanhamento,
    a.saida_acompanhamento,
    a.sla_acompanhamento,
    a.entrada_declinou,
    a.saida_declinou,
    a.sla_declinou,
    a.entrada_concluido,
    a.saida_concluido,
    a.sla_concluido,
    a.observacao,
    a.historico,
    a.selecionados
  ).lastInsertRowid), r.handle("funil:update", (o, a, e) => (c().prepare(`
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
    `).run(
    e.lumiax_genomica,
    e.responsavel,
    e.ticket_onboarding,
    e.id_cliente,
    e.cnpj,
    e.razao_social,
    e.nome_fantasia,
    e.uf,
    e.regional,
    e.ev,
    e.carteira,
    e.coordenador,
    e.gerente,
    e.potencial,
    e.fase,
    e.entrada_mapeamento,
    e.saida_mapeamento,
    e.sla_mapeamento,
    e.entrada_proposta,
    e.saida_proposta,
    e.sla_proposta,
    e.entrada_negociacao,
    e.saida_negociacao,
    e.sla_negociacao,
    e.entrada_contrato,
    e.saida_contrato,
    e.sla_contrato,
    e.entrada_implantacao,
    e.saida_implantacao,
    e.sla_implantacao,
    e.entrada_acompanhamento,
    e.saida_acompanhamento,
    e.sla_acompanhamento,
    e.entrada_declinou,
    e.saida_declinou,
    e.sla_declinou,
    e.entrada_concluido,
    e.saida_concluido,
    e.sla_concluido,
    e.observacao,
    e.historico,
    e.selecionados,
    a
  ), !0)), r.handle("funil:delete", (o, a) => (c().prepare("DELETE FROM funil WHERE id = ?").run(a), !0)), r.handle("observacoes:add", (o, a, e) => c().prepare("INSERT INTO observacoes (funil_id, observacao) VALUES (?, ?)").run(a, e).lastInsertRowid), r.handle("observacoes:getByFunilId", (o, a) => c().prepare("SELECT * FROM observacoes WHERE funil_id = ? ORDER BY data DESC").all(a)), r.handle("dashboard:getStats", (o, a) => {
    const e = c();
    let n = "1=1";
    const t = [];
    a != null && a.nome_cliente && (n += " AND f.nome_fantasia LIKE ?", t.push(`%${a.nome_cliente}%`)), a != null && a.regional && (n += " AND f.regional = ?", t.push(a.regional)), a != null && a.fase && (n += " AND f.fase = ?", t.push(a.fase)), a != null && a.responsavel && (n += " AND f.responsavel LIKE ?", t.push(`%${a.responsavel}%`));
    const _ = e.prepare(`
      SELECT COALESCE(SUM(f.potencial), 0) as total FROM funil f
      LEFT JOIN regionais r ON f.cnpj = r.cnpj WHERE ${n}
    `).get(...t), R = e.prepare(`
      SELECT COUNT(*) as count FROM funil f
      LEFT JOIN regionais r ON f.cnpj = r.cnpj WHERE ${n}
    `).get(...t), N = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7), g = e.prepare(`
      SELECT COUNT(*) as count FROM funil f
      LEFT JOIN regionais r ON f.cnpj = r.cnpj
      WHERE strftime('%Y-%m', f.data_criacao) = ? AND ${n}
    `).get(N, ...t), u = e.prepare(`
      SELECT f.responsavel, SUM(f.potencial) as total, COUNT(*) as count
      FROM funil f LEFT JOIN regionais r ON f.cnpj = r.cnpj
      WHERE ${n} GROUP BY f.responsavel ORDER BY total DESC
    `).all(...t), I = e.prepare(`
      SELECT f.fase, SUM(f.potencial) as total, COUNT(*) as count
      FROM funil f LEFT JOIN regionais r ON f.cnpj = r.cnpj
      WHERE ${n} GROUP BY f.fase ORDER BY f.fase
    `).all(...t);
    return {
      totalPotencial: _.total,
      totalCount: R.count,
      newItemsThisMonth: g.count,
      potencialPorResponsavel: u,
      potencialPorFase: I
    };
  });
});
i.on("window-all-closed", () => {
  process.platform !== "darwin" && i.quit();
});
i.on("activate", () => {
  p.getAllWindows().length === 0 && m();
});
