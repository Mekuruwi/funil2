import { app as N, ipcMain as s, BrowserWindow as D } from "electron";
import h, { dirname as X } from "path";
import f from "better-sqlite3";
import { fileURLToPath as F } from "url";
const j = h.join(N.getPath("userData"), "funil_comercial.db");
let S = null;
function A() {
  if (S) return S;
  const t = new f(j);
  return t.pragma("foreign_keys = ON"), t.exec(`
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
  `), t.exec(`
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
  `), t.exec(`
    CREATE TABLE IF NOT EXISTS observacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      funil_id INTEGER NOT NULL,
      data DATETIME DEFAULT CURRENT_TIMESTAMP,
      observacao TEXT NOT NULL,
      FOREIGN KEY (funil_id) REFERENCES funil(id) ON DELETE CASCADE
    )
  `), t.exec(`
    CREATE INDEX IF NOT EXISTS idx_funil_id_cliente ON funil(id_cliente);
    CREATE INDEX IF NOT EXISTS idx_funil_fase ON funil(fase);
    CREATE INDEX IF NOT EXISTS idx_funil_cnpj ON funil(cnpj);
    CREATE INDEX IF NOT EXISTS idx_funil_data_criacao ON funil(data_criacao DESC);
    CREATE INDEX IF NOT EXISTS idx_funil_responsavel ON funil(responsavel);
    CREATE INDEX IF NOT EXISTS idx_funil_ev ON funil(ev);
    CREATE INDEX IF NOT EXISTS idx_funil_lumiax_genomica ON funil(lumiax_genomica);
    CREATE INDEX IF NOT EXISTS idx_regionais_cnpj ON regionais(cnpj);
    CREATE INDEX IF NOT EXISTS idx_regionais_cnpj_normalizado ON regionais(
      replace(replace(replace(replace(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
    );
    CREATE INDEX IF NOT EXISTS idx_observacoes_funil_id ON observacoes(funil_id);
    CREATE INDEX IF NOT EXISTS idx_observacoes_funil_data ON observacoes(funil_id, data DESC, id DESC);
  `), S = t, t;
}
function d() {
  return S || A();
}
const x = F(import.meta.url), v = X(x);
let g = null;
const p = (t) => `replace(replace(replace(replace(${t}, '.', ''), '/', ''), '-', ''), ' ', '')`;
function $(t, a) {
  return String(a || "").split(/\r?\n/).flatMap((e, n) => {
    const r = e.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(.+)$/);
    return r ? [{
      id: -(t * 1e4 + n + 1),
      funil_id: t,
      data: `${r[3]}-${r[2]}-${r[1]}`,
      observacao: r[4].trim()
    }] : [];
  });
}
function C(t, a) {
  if (a.length === 0) return [];
  const e = /* @__PURE__ */ new Map(), n = a.map((i) => i.id), r = n.map(() => "?").join(","), _ = t.prepare(
    `SELECT * FROM observacoes WHERE funil_id IN (${r}) ORDER BY data DESC, id DESC`
  ).all(...n);
  for (const i of _) {
    const E = e.get(i.funil_id) || [];
    E.push(i), e.set(i.funil_id, E);
  }
  return a.map((i) => {
    const E = e.get(i.id) || [], l = $(i.id, i.historico).sort((c, T) => T.data.localeCompare(c.data));
    return {
      ...i,
      observacoes: E.length > 0 ? E : l
    };
  });
}
function M() {
  if (g && !g.isDestroyed()) {
    g.focus();
    return;
  }
  g = new D({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: h.join(v, "../electron/preload.cjs"),
      contextIsolation: !0,
      nodeIntegration: !1
    }
  }), !!process.env.VITE_DEV_SERVER_URL ? g.loadURL(process.env.VITE_DEV_SERVER_URL || "http://localhost:5173") : g.loadFile(h.join(v, "../dist/index.html")), g.on("closed", () => {
    g = null;
  });
}
N.whenReady().then(() => {
  A(), M(), s.handle("regionais:getAll", () => d().prepare("SELECT * FROM regionais ORDER BY nome_cliente").all()), s.handle("regionais:getById", (t, a) => d().prepare("SELECT * FROM regionais WHERE id = ?").get(a) || null), s.handle("regionais:insert", (t, a) => d().prepare(`
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
  ).lastInsertRowid), s.handle("regionais:import", (t, a) => {
    if (!Array.isArray(a) || a.length === 0)
      throw new Error("Nenhum registro de regional foi fornecido para importação.");
    const e = d(), n = e.prepare(`
      INSERT INTO regionais (ent_id_sap, cnpj, raiz, nome_cliente, desc_representante,
        desc_regional_matriz, executivo, email, nome_coordenador)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return e.transaction((_) => {
      e.prepare("DELETE FROM regionais").run();
      for (const i of _)
        n.run(
          i.ent_id_sap,
          i.cnpj,
          i.raiz,
          i.nome_cliente,
          i.desc_representante,
          i.desc_regional_matriz,
          i.executivo,
          i.email,
          i.nome_coordenador
        );
    })(a), a.length;
  }), s.handle("regionais:update", (t, a, e) => (d().prepare(`
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
  ), !0)), s.handle("regionais:delete", (t, a) => (d().prepare("DELETE FROM regionais WHERE id = ?").run(a), !0)), s.handle("regionais:clear", () => (d().prepare("DELETE FROM regionais").run(), !0)), s.handle("funil:getAll", () => {
    const t = d(), a = t.prepare(`
      SELECT f.*, r.nome_cliente, r.desc_representante, r.desc_regional_matriz as regional_cruzada,
             r.executivo as executivo_regional, r.nome_coordenador as coord_regional,
             r.desc_representante as carteira_cruzada
      FROM funil f
      LEFT JOIN regionais r ON r.id = (
        SELECT r2.id
        FROM regionais r2
        WHERE ${p("r2.cnpj")} = ${p("f.cnpj")}
        ORDER BY r2.id
        LIMIT 1
      )
      ORDER BY f.data_criacao DESC
    `).all();
    return C(t, a);
  }), s.handle("funil:getById", (t, a) => {
    const e = d(), n = e.prepare(`
      SELECT f.*, r.nome_cliente, r.desc_representante, r.desc_regional_matriz,
             r.executivo as executivo_regional, r.nome_coordenador as coord_regional,
             COALESCE(r.desc_regional_matriz, f.regional) as regional_cruzada,
             COALESCE(r.desc_representante, f.carteira) as carteira_cruzada
      FROM funil f
      LEFT JOIN regionais r ON r.id = (
        SELECT r2.id
        FROM regionais r2
        WHERE ${p("r2.cnpj")} = ${p("f.cnpj")}
        ORDER BY r2.id
        LIMIT 1
      )
      WHERE f.id = ?
    `).get(a);
    return n ? C(e, [n])[0] : null;
  }), s.handle("funil:updatePhase", (t, a, e) => {
    if (!Number.isInteger(e) || e < 1 || e > 8)
      throw new Error("Fase inválida.");
    return d().prepare("UPDATE funil SET fase = ?, data_atualizacao = CURRENT_TIMESTAMP WHERE id = ?").run(e, a), !0;
  }), s.handle("funil:insert", (t, a) => {
    const e = d(), n = String(a.cnpj || "").replace(/\D/g, ""), r = Number(a.id_cliente), _ = Number.isInteger(r) ? r : 0;
    if ((n || Number.isInteger(_) && _ > 0) && e.prepare(`
        SELECT id
        FROM funil
        WHERE (${p("cnpj")} = ? AND ? <> '')
           OR (id_cliente = ? AND ? > 0)
        LIMIT 1
      `).get(n, n, _, _))
      throw new Error("Já existe um registro do funil com este CNPJ ou cliente.");
    return e.prepare(`
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
      a.ticket_onboarding || a.ticket || "",
      a.id_cliente || null,
      a.cnpj,
      a.razao_social,
      a.nome_fantasia,
      a.uf,
      a.regional || "",
      a.executivo || a.ev,
      a.carteira || "",
      a.coordenador || "",
      a.gerente || "",
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
    ).lastInsertRowid;
  }), s.handle("funil:import", (t, a) => {
    if (!Array.isArray(a) || a.length === 0)
      throw new Error("Nenhum registro de funil foi fornecido para importação.");
    const e = d(), n = new Set(
      e.prepare("SELECT id FROM regionais").all().map((c) => c.id)
    ), r = (c) => c == null || c === "" ? null : typeof c == "boolean" ? c ? 1 : 0 : c instanceof Date ? c.toISOString() : typeof c == "object" ? String(c) : c, _ = e.prepare(`
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
    `), i = new Set(
      e.prepare("SELECT cnpj FROM funil WHERE cnpj IS NOT NULL AND cnpj <> ''").all().map((c) => String(c.cnpj).replace(/\D/g, "")).filter(Boolean)
    ), E = new Set(
      e.prepare("SELECT id_cliente FROM funil WHERE id_cliente IS NOT NULL AND id_cliente > 0").all().map((c) => Number(c.id_cliente))
    );
    return e.transaction((c) => {
      let T = 0;
      for (const o of c) {
        const m = String(o.cnpj || "").replace(/\D/g, ""), b = Number(o.id_cliente), u = Number.isInteger(b) ? b : 0;
        if (m && i.has(m) || Number.isInteger(u) && u > 0 && E.has(u)) continue;
        const L = _.run(
          ...[
            o.lumiax_genomica,
            o.responsavel,
            o.ticket_onboarding,
            n.has(u) ? u : null,
            o.cnpj,
            o.razao_social,
            o.nome_fantasia,
            o.uf,
            o.regional,
            o.ev,
            o.carteira,
            o.coordenador,
            o.gerente,
            o.potencial,
            o.fase,
            o.entrada_mapeamento,
            o.saida_mapeamento,
            o.sla_mapeamento,
            o.entrada_proposta,
            o.saida_proposta,
            o.sla_proposta,
            o.entrada_negociacao,
            o.saida_negociacao,
            o.sla_negociacao,
            o.entrada_contrato,
            o.saida_contrato,
            o.sla_contrato,
            o.entrada_implantacao,
            o.saida_implantacao,
            o.sla_implantacao,
            o.entrada_acompanhamento,
            o.saida_acompanhamento,
            o.sla_acompanhamento,
            o.entrada_declinou,
            o.saida_declinou,
            o.sla_declinou,
            o.entrada_concluido,
            o.saida_concluido,
            o.sla_concluido,
            o.observacao,
            o.historico,
            o.selecionados
          ].map(r)
        );
        if (o.observacao) {
          const R = String(o.observacao).match(/^(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(.*)$/), O = R ? `${R[3]}-${R[2]}-${R[1]}` : (/* @__PURE__ */ new Date()).toISOString(), I = R ? R[4] : String(o.observacao);
          e.prepare("INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)").run(L.lastInsertRowid, O, I);
        }
        if (o.historico) {
          const R = e.prepare("INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)");
          for (const O of String(o.historico).split(/\r?\n/)) {
            const I = O.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(.+)$/);
            I && R.run(L.lastInsertRowid, `${I[3]}-${I[2]}-${I[1]}`, I[4].trim());
          }
        }
        m && i.add(m), Number.isInteger(u) && u > 0 && E.add(u), T += 1;
      }
      return T;
    })(a);
  }), s.handle("funil:update", (t, a, e) => (d().prepare(`
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
    e.executivo || e.ev,
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
  ), !0)), s.handle("funil:delete", (t, a) => (d().prepare("DELETE FROM funil WHERE id = ?").run(a), !0)), s.handle("funil:deleteMany", (t, a) => {
    if (!Array.isArray(a) || a.length === 0) return 0;
    const e = d();
    return e.transaction((r) => {
      const _ = e.prepare("DELETE FROM funil WHERE id = ?");
      for (const i of r)
        Number.isInteger(i) && _.run(i);
    })(a), a.length;
  }), s.handle("observacoes:add", (t, a, e, n) => d().prepare("INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)").run(a, n || (/* @__PURE__ */ new Date()).toISOString(), e).lastInsertRowid), s.handle("observacoes:getByFunilId", (t, a) => d().prepare("SELECT * FROM observacoes WHERE funil_id = ? ORDER BY data DESC").all(a)), s.handle("observacoes:import", (t, a) => {
    const e = d(), n = e.prepare("INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)"), r = e.prepare("SELECT id FROM funil WHERE replace(replace(replace(replace(cnpj, '.', ''), '/', ''), '-', ''), ' ', '') = ? LIMIT 1");
    return e.transaction((_) => {
      let i = 0, E = 0;
      for (const l of _) {
        const c = String(l.cnpj || l.CNPJ || "").replace(/\D/g, ""), T = String(l.observacao || l.Observação || l.Observacoes || "").trim(), o = String(l.data || l.Data || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!c || !T || !o) {
          E += 1;
          continue;
        }
        const m = r.get(c);
        if (!(m != null && m.id)) {
          E += 1;
          continue;
        }
        n.run(m.id, `${o[1]}-${o[2]}-${o[3]}`, T), i += 1;
      }
      return { updated: i, ignored: E };
    })(Array.isArray(a) ? a : []);
  }), s.handle("dashboard:getStats", (t, a) => {
    const e = d();
    let n = "1=1";
    const r = [];
    a != null && a.negocio && (n += " AND f.lumiax_genomica LIKE ?", r.push(`%${a.negocio}%`)), a != null && a.regional && (n += " AND COALESCE(r.desc_regional_matriz, f.regional) LIKE ?", r.push(`%${a.regional}%`)), a != null && a.fase && (n += " AND f.fase = ?", r.push(a.fase)), a != null && a.responsavel && (n += " AND f.responsavel LIKE ?", r.push(`%${a.responsavel}%`)), a != null && a.executivo && (n += " AND f.ev LIKE ?", r.push(`%${a.executivo}%`)), a != null && a.carteira && (n += " AND f.carteira LIKE ?", r.push(`%${a.carteira}%`));
    const _ = e.prepare(`
      SELECT COALESCE(SUM(f.potencial), 0) as total FROM funil f
      LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${p("r2.cnpj")} = ${p("f.cnpj")}
        ORDER BY r2.id LIMIT 1
      ) WHERE ${n}
    `).get(...r), i = e.prepare(`
      SELECT COUNT(*) as count FROM funil f
      LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${p("r2.cnpj")} = ${p("f.cnpj")}
        ORDER BY r2.id LIMIT 1
      ) WHERE ${n}
    `).get(...r), E = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7), l = e.prepare(`
      SELECT COUNT(*) as count FROM funil f
      LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${p("r2.cnpj")} = ${p("f.cnpj")}
        ORDER BY r2.id LIMIT 1
      )
      WHERE strftime('%Y-%m', f.data_criacao) = ? AND ${n}
    `).get(E, ...r), c = e.prepare(`
      SELECT f.responsavel, SUM(f.potencial) as total, COUNT(*) as count
      FROM funil f LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${p("r2.cnpj")} = ${p("f.cnpj")}
        ORDER BY r2.id LIMIT 1
      )
      WHERE ${n} GROUP BY f.responsavel ORDER BY total DESC
    `).all(...r), T = e.prepare(`
      SELECT f.fase, SUM(f.potencial) as total, COUNT(*) as count
      FROM funil f LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${p("r2.cnpj")} = ${p("f.cnpj")}
        ORDER BY r2.id LIMIT 1
      )
      WHERE ${n} GROUP BY f.fase ORDER BY f.fase
    `).all(...r);
    return {
      totalPotencial: _.total,
      totalCount: i.count,
      newItemsThisMonth: l.count,
      potencialPorResponsavel: c,
      potencialPorFase: T
    };
  });
});
N.on("window-all-closed", () => {
  process.platform !== "darwin" && N.quit();
});
N.on("activate", () => {
  D.getAllWindows().length === 0 && M();
});
