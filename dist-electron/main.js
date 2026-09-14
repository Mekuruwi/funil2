import { app as C, ipcMain as E, BrowserWindow as v } from "electron";
import b, { dirname as U } from "path";
import j from "better-sqlite3";
import x from "fs";
import { fileURLToPath as $ } from "url";
const f = b.join(C.getPath("userData"), "funil_comercial.db");
let L = null;
function F() {
  if (L) return L;
  const n = new j(f);
  return n.pragma("foreign_keys = ON"), n.exec(`
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
  `), n.exec(`
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
  `), n.exec(`
    CREATE TABLE IF NOT EXISTS observacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      funil_id INTEGER NOT NULL,
      data DATETIME DEFAULT CURRENT_TIMESTAMP,
      observacao TEXT NOT NULL,
      FOREIGN KEY (funil_id) REFERENCES funil(id) ON DELETE CASCADE
    )
  `), n.exec(`
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
  `), n.exec(`
    CREATE TABLE IF NOT EXISTS import_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation TEXT NOT NULL,
      file_name TEXT,
      records INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK (status IN ('success', 'warning', 'error')),
      error_message TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_import_operations_created_at
      ON import_operations(created_at DESC);
  `), n.exec(`
    CREATE TABLE IF NOT EXISTS system_access (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_access_at DATETIME NOT NULL
    );
  `), n.prepare(`
    INSERT INTO system_access (id, last_access_at) VALUES (1, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET last_access_at = excluded.last_access_at
  `).run(), L = n, n;
}
function d() {
  return L || F();
}
function O(n, a, e, t, r) {
  d().prepare(`
    INSERT INTO import_operations (operation, file_name, records, status, error_message)
    VALUES (?, ?, ?, ?, ?)
  `).run(n, null, a, e, r || null);
}
function w() {
  const n = d();
  n.prepare(`
    INSERT INTO system_access (id, last_access_at) VALUES (1, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET last_access_at = excluded.last_access_at
  `).run();
  const a = n.prepare(`
    SELECT
      (SELECT COUNT(*) FROM regionais) + (SELECT COUNT(*) FROM funil) AS count
  `).get(), e = n.prepare(`
    SELECT
      (SELECT COUNT(*) FROM regionais
       WHERE COALESCE(TRIM(cnpj), '') = '' OR COALESCE(TRIM(nome_cliente), '') = '')
      + (SELECT COUNT(*) FROM funil
         WHERE id_cliente IS NOT NULL
           AND id_cliente > 0
           AND id_cliente NOT IN (SELECT id FROM regionais)) AS count
  `).get(), t = ["regionais", "funil", "observacoes", "import_operations", "system_access"], r = n.prepare(`
    SELECT name, COALESCE(SUM(pgsize), 0) AS sizeBytes
    FROM dbstat
    WHERE name IN (${t.map(() => "?").join(",")})
    GROUP BY name
  `).all(...t), c = t.map((l) => {
    var I;
    return {
      name: l,
      rows: Number(n.prepare(`SELECT COUNT(*) AS count FROM "${l}"`).get().count),
      sizeBytes: Number(((I = r.find((u) => u.name === l)) == null ? void 0 : I.sizeBytes) || 0)
    };
  }), s = c.filter((l) => l.name === "regionais" || l.name === "funil").map(({ name: l, rows: I }) => ({ name: l, rows: I })), p = [
    {
      code: "regional-cnpj-missing",
      label: "Regionais sem CNPJ",
      table: "regionais",
      count: Number(n.prepare("SELECT COUNT(*) AS count FROM regionais WHERE COALESCE(TRIM(cnpj), '') = ''").get().count)
    },
    {
      code: "regional-name-missing",
      label: "Regionais sem nome do cliente",
      table: "regionais",
      count: Number(n.prepare("SELECT COUNT(*) AS count FROM regionais WHERE COALESCE(TRIM(nome_cliente), '') = ''").get().count)
    },
    {
      code: "funil-regional-not-found",
      label: "Funis com regional não encontrada",
      table: "funil",
      count: Number(n.prepare(`
        SELECT COUNT(*) AS count FROM funil
        WHERE id_cliente IS NOT NULL AND id_cliente > 0
          AND id_cliente NOT IN (SELECT id FROM regionais)
      `).get().count)
    }
  ], m = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7), _ = n.prepare(`
    SELECT id, operation, file_name AS fileName, records, status,
           error_message AS errorMessage, created_at AS createdAt
    FROM import_operations
    ORDER BY created_at DESC, id DESC
    LIMIT 10
  `).all(), i = _[0] || null, R = n.prepare(
    "SELECT last_access_at AS lastAccessAt FROM system_access WHERE id = 1"
  ).get(), o = n.prepare(`
    SELECT COUNT(*) AS count FROM import_operations
    WHERE strftime('%Y-%m', created_at) = ?
  `).get(m);
  return {
    databaseSizeBytes: x.statSync(f).size,
    databaseTables: c,
    activeRecords: Number(a.count),
    activeRecordsByTable: s,
    validationErrors: Number(e.count),
    validationIssues: p,
    recentImports: _,
    lastAccessAt: (R == null ? void 0 : R.lastAccessAt) || null,
    currentPeriodImports: Number(o.count),
    latestOperation: i ? {
      status: i.status,
      operation: i.operation,
      createdAt: i.createdAt,
      errorMessage: i.errorMessage
    } : null
  };
}
const z = $(import.meta.url), M = U(z);
let N = null;
const T = (n) => `replace(replace(replace(replace(${n}, '.', ''), '/', ''), '-', ''), ' ', '')`;
function H(n, a) {
  return String(a || "").split(/\r?\n/).flatMap((e, t) => {
    const r = e.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(.+)$/);
    return r ? [{
      id: -(n * 1e4 + t + 1),
      funil_id: n,
      data: `${r[3]}-${r[2]}-${r[1]}`,
      observacao: r[4].trim()
    }] : [];
  });
}
function D(n, a) {
  if (a.length === 0) return [];
  const e = /* @__PURE__ */ new Map(), t = a.map((s) => s.id), r = t.map(() => "?").join(","), c = n.prepare(
    `SELECT * FROM observacoes WHERE funil_id IN (${r}) ORDER BY data DESC, id DESC`
  ).all(...t);
  for (const s of c) {
    const p = e.get(s.funil_id) || [];
    p.push(s), e.set(s.funil_id, p);
  }
  return a.map((s) => {
    const p = e.get(s.id) || [], m = H(s.id, s.historico).sort((_, i) => i.data.localeCompare(_.data));
    return {
      ...s,
      observacoes: p.length > 0 ? p : m
    };
  });
}
function X() {
  if (N && !N.isDestroyed()) {
    N.focus();
    return;
  }
  N = new v({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: b.join(M, "../electron/preload.cjs"),
      contextIsolation: !0,
      nodeIntegration: !1
    }
  }), !!process.env.VITE_DEV_SERVER_URL ? N.loadURL(process.env.VITE_DEV_SERVER_URL || "http://localhost:5173") : N.loadFile(b.join(M, "../dist/index.html")), N.on("closed", () => {
    N = null;
  });
}
C.whenReady().then(() => {
  F(), X(), E.handle("regionais:getAll", () => d().prepare("SELECT * FROM regionais ORDER BY nome_cliente").all()), E.handle("regionais:getById", (n, a) => d().prepare("SELECT * FROM regionais WHERE id = ?").get(a) || null), E.handle("regionais:insert", (n, a) => d().prepare(`
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
  ).lastInsertRowid), E.handle("regionais:import", (n, a) => {
    if (!Array.isArray(a) || a.length === 0)
      throw O("Importação de regionais", 0, "error", void 0, "Nenhum registro fornecido."), new Error("Nenhum registro de regional foi fornecido para importação.");
    const e = d(), t = e.prepare(`
      INSERT INTO regionais (ent_id_sap, cnpj, raiz, nome_cliente, desc_representante,
        desc_regional_matriz, executivo, email, nome_coordenador)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `), r = e.transaction((c) => {
      e.prepare("DELETE FROM regionais").run();
      for (const s of c)
        t.run(
          s.ent_id_sap,
          s.cnpj,
          s.raiz,
          s.nome_cliente,
          s.desc_representante,
          s.desc_regional_matriz,
          s.executivo,
          s.email,
          s.nome_coordenador
        );
    });
    try {
      r(a);
    } catch (c) {
      throw O("Importação de regionais", 0, "error", void 0, c instanceof Error ? c.message : String(c)), c;
    }
    return O("Importação de regionais", a.length, "success"), a.length;
  }), E.handle("regionais:update", (n, a, e) => (d().prepare(`
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
  ), !0)), E.handle("regionais:delete", (n, a) => (d().prepare("DELETE FROM regionais WHERE id = ?").run(a), !0)), E.handle("regionais:clear", () => (d().prepare("DELETE FROM regionais").run(), !0)), E.handle("funil:getAll", () => {
    const n = d(), a = n.prepare(`
      SELECT f.*, r.nome_cliente, r.desc_representante, r.desc_regional_matriz as regional_cruzada,
             r.executivo as executivo_regional, r.nome_coordenador as coord_regional,
             r.desc_representante as carteira_cruzada
      FROM funil f
      LEFT JOIN regionais r ON r.id = (
        SELECT r2.id
        FROM regionais r2
        WHERE ${T("r2.cnpj")} = ${T("f.cnpj")}
        ORDER BY r2.id
        LIMIT 1
      )
      ORDER BY f.data_criacao DESC
    `).all();
    return D(n, a);
  }), E.handle("funil:getById", (n, a) => {
    const e = d(), t = e.prepare(`
      SELECT f.*, r.nome_cliente, r.desc_representante, r.desc_regional_matriz,
             r.executivo as executivo_regional, r.nome_coordenador as coord_regional,
             COALESCE(r.desc_regional_matriz, f.regional) as regional_cruzada,
             COALESCE(r.desc_representante, f.carteira) as carteira_cruzada
      FROM funil f
      LEFT JOIN regionais r ON r.id = (
        SELECT r2.id
        FROM regionais r2
        WHERE ${T("r2.cnpj")} = ${T("f.cnpj")}
        ORDER BY r2.id
        LIMIT 1
      )
      WHERE f.id = ?
    `).get(a);
    return t ? D(e, [t])[0] : null;
  }), E.handle("funil:updatePhase", (n, a, e) => {
    if (!Number.isInteger(e) || e < 1 || e > 8)
      throw new Error("Fase inválida.");
    return d().prepare("UPDATE funil SET fase = ?, data_atualizacao = CURRENT_TIMESTAMP WHERE id = ?").run(e, a), !0;
  }), E.handle("funil:insert", (n, a) => {
    const e = d(), t = String(a.cnpj || "").replace(/\D/g, ""), r = Number(a.id_cliente), c = Number.isInteger(r) ? r : 0;
    if ((t || Number.isInteger(c) && c > 0) && e.prepare(`
        SELECT id
        FROM funil
        WHERE (${T("cnpj")} = ? AND ? <> '')
           OR (id_cliente = ? AND ? > 0)
        LIMIT 1
      `).get(t, t, c, c))
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
  }), E.handle("funil:import", (n, a) => {
    if (!Array.isArray(a) || a.length === 0)
      throw O("Importação de funil", 0, "error", void 0, "Nenhum registro fornecido."), new Error("Nenhum registro de funil foi fornecido para importação.");
    const e = d(), t = new Set(
      e.prepare("SELECT id FROM regionais").all().map((i) => i.id)
    ), r = (i) => i == null || i === "" ? null : typeof i == "boolean" ? i ? 1 : 0 : i instanceof Date ? i.toISOString() : typeof i == "object" ? String(i) : i, c = e.prepare(`
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
    `), s = new Set(
      e.prepare("SELECT cnpj FROM funil WHERE cnpj IS NOT NULL AND cnpj <> ''").all().map((i) => String(i.cnpj).replace(/\D/g, "")).filter(Boolean)
    ), p = new Set(
      e.prepare("SELECT id_cliente FROM funil WHERE id_cliente IS NOT NULL AND id_cliente > 0").all().map((i) => Number(i.id_cliente))
    ), m = e.transaction((i) => {
      let R = 0;
      for (const o of i) {
        const l = String(o.cnpj || "").replace(/\D/g, ""), I = Number(o.id_cliente), u = Number.isInteger(I) ? I : 0;
        if (l && s.has(l) || Number.isInteger(u) && u > 0 && p.has(u)) continue;
        const h = c.run(
          ...[
            o.lumiax_genomica,
            o.responsavel,
            o.ticket_onboarding,
            t.has(u) ? u : null,
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
          const g = String(o.observacao).match(/^(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(.*)$/), A = g ? `${g[3]}-${g[2]}-${g[1]}` : (/* @__PURE__ */ new Date()).toISOString(), S = g ? g[4] : String(o.observacao);
          e.prepare("INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)").run(h.lastInsertRowid, A, S);
        }
        if (o.historico) {
          const g = e.prepare("INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)");
          for (const A of String(o.historico).split(/\r?\n/)) {
            const S = A.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(.+)$/);
            S && g.run(h.lastInsertRowid, `${S[3]}-${S[2]}-${S[1]}`, S[4].trim());
          }
        }
        l && s.add(l), Number.isInteger(u) && u > 0 && p.add(u), R += 1;
      }
      return R;
    });
    let _;
    try {
      _ = m(a);
    } catch (i) {
      throw O("Importação de funil", 0, "error", void 0, i instanceof Error ? i.message : String(i)), i;
    }
    return O("Importação de funil", _, _ < a.length ? "warning" : "success"), _;
  }), E.handle("funil:update", (n, a, e) => (d().prepare(`
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
  ), !0)), E.handle("funil:delete", (n, a) => (d().prepare("DELETE FROM funil WHERE id = ?").run(a), !0)), E.handle("funil:deleteMany", (n, a) => {
    if (!Array.isArray(a) || a.length === 0) return 0;
    const e = d();
    return e.transaction((r) => {
      const c = e.prepare("DELETE FROM funil WHERE id = ?");
      for (const s of r)
        Number.isInteger(s) && c.run(s);
    })(a), a.length;
  }), E.handle("observacoes:add", (n, a, e, t) => d().prepare("INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)").run(a, t || (/* @__PURE__ */ new Date()).toISOString(), e).lastInsertRowid), E.handle("observacoes:getByFunilId", (n, a) => d().prepare("SELECT * FROM observacoes WHERE funil_id = ? ORDER BY data DESC").all(a)), E.handle("observacoes:import", (n, a) => {
    const e = d(), t = e.prepare("INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)"), r = e.prepare("SELECT id FROM funil WHERE replace(replace(replace(replace(cnpj, '.', ''), '/', ''), '-', ''), ' ', '') = ? LIMIT 1"), c = e.transaction((s) => {
      let p = 0, m = 0;
      for (const _ of s) {
        const i = String(_.cnpj || _.CNPJ || "").replace(/\D/g, ""), R = String(_.observacao || _.Observação || _.Observacoes || "").trim(), o = String(_.data || _.Data || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!i || !R || !o) {
          m += 1;
          continue;
        }
        const l = r.get(i);
        if (!(l != null && l.id)) {
          m += 1;
          continue;
        }
        t.run(l.id, `${o[1]}-${o[2]}-${o[3]}`, R), p += 1;
      }
      return { updated: p, ignored: m };
    })(Array.isArray(a) ? a : []);
    return O("Importação de observações", c.updated, c.ignored > 0 ? "warning" : "success"), c;
  }), E.handle("systemHealth:getMetrics", () => w()), E.handle("dashboard:getStats", (n, a) => {
    const e = d();
    let t = "1=1";
    const r = [];
    a != null && a.negocio && (t += " AND f.lumiax_genomica LIKE ?", r.push(`%${a.negocio}%`)), a != null && a.regional && (t += " AND COALESCE(r.desc_regional_matriz, f.regional) LIKE ?", r.push(`%${a.regional}%`)), a != null && a.fase && (t += " AND f.fase = ?", r.push(a.fase)), a != null && a.responsavel && (t += " AND f.responsavel LIKE ?", r.push(`%${a.responsavel}%`)), a != null && a.executivo && (t += " AND f.ev LIKE ?", r.push(`%${a.executivo}%`)), a != null && a.carteira && (t += " AND f.carteira LIKE ?", r.push(`%${a.carteira}%`));
    const c = e.prepare(`
      SELECT COALESCE(SUM(f.potencial), 0) as total FROM funil f
      LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${T("r2.cnpj")} = ${T("f.cnpj")}
        ORDER BY r2.id LIMIT 1
      ) WHERE ${t}
    `).get(...r), s = e.prepare(`
      SELECT COUNT(*) as count FROM funil f
      LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${T("r2.cnpj")} = ${T("f.cnpj")}
        ORDER BY r2.id LIMIT 1
      ) WHERE ${t}
    `).get(...r), p = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7), m = e.prepare(`
      SELECT COUNT(*) as count FROM funil f
      LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${T("r2.cnpj")} = ${T("f.cnpj")}
        ORDER BY r2.id LIMIT 1
      )
      WHERE strftime('%Y-%m', f.data_criacao) = ? AND ${t}
    `).get(p, ...r), _ = e.prepare(`
      SELECT f.responsavel, SUM(f.potencial) as total, COUNT(*) as count
      FROM funil f LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${T("r2.cnpj")} = ${T("f.cnpj")}
        ORDER BY r2.id LIMIT 1
      )
      WHERE ${t} GROUP BY f.responsavel ORDER BY total DESC
    `).all(...r), i = e.prepare(`
      SELECT f.fase, SUM(f.potencial) as total, COUNT(*) as count
      FROM funil f LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${T("r2.cnpj")} = ${T("f.cnpj")}
        ORDER BY r2.id LIMIT 1
      )
      WHERE ${t} GROUP BY f.fase ORDER BY f.fase
    `).all(...r);
    return {
      totalPotencial: c.total,
      totalCount: s.count,
      newItemsThisMonth: m.count,
      potencialPorResponsavel: _,
      potencialPorFase: i
    };
  });
});
C.on("window-all-closed", () => {
  process.platform !== "darwin" && C.quit();
});
C.on("activate", () => {
  v.getAllWindows().length === 0 && X();
});
