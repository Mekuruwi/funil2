var W = Object.defineProperty;
var Y = (n, a, e) => a in n ? W(n, a, { enumerable: !0, configurable: !0, writable: !0, value: e }) : n[a] = e;
var b = (n, a, e) => Y(n, typeof a != "symbol" ? a + "" : a, e);
import { app as I, ipcMain as d, dialog as k, BrowserWindow as z } from "electron";
import C, { dirname as q } from "path";
import G from "better-sqlite3";
import V from "fs";
import K from "knex";
import { createClient as J } from "@libsql/client";
import A from "fs/promises";
import { fileURLToPath as Q } from "url";
const P = C.join(I.getPath("userData"), "funil_comercial.db");
let v = null;
function B() {
  if (v) return v;
  const n = new G(P);
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
  `).run(), v = n, n;
}
function p() {
  return v || B();
}
function f(n, a, e, t, o) {
  p().prepare(`
    INSERT INTO import_operations (operation, file_name, records, status, error_message)
    VALUES (?, ?, ?, ?, ?)
  `).run(n, null, a, e, o || null);
}
function Z() {
  const n = p();
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
  `).get(), t = ["regionais", "funil", "observacoes", "import_operations", "system_access"], o = n.prepare(`
    SELECT name, COALESCE(SUM(pgsize), 0) AS sizeBytes
    FROM dbstat
    WHERE name IN (${t.map(() => "?").join(",")})
    GROUP BY name
  `).all(...t), s = t.map((_) => {
    var S;
    return {
      name: _,
      rows: Number(n.prepare(`SELECT COUNT(*) AS count FROM "${_}"`).get().count),
      sizeBytes: Number(((S = o.find((g) => g.name === _)) == null ? void 0 : S.sizeBytes) || 0)
    };
  }), i = s.filter((_) => _.name === "regionais" || _.name === "funil").map(({ name: _, rows: S }) => ({ name: _, rows: S })), l = [
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
  ], u = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7), E = n.prepare(`
    SELECT id, operation, file_name AS fileName, records, status,
           error_message AS errorMessage, created_at AS createdAt
    FROM import_operations
    ORDER BY created_at DESC, id DESC
    LIMIT 10
  `).all(), c = E[0] || null, m = n.prepare(
    "SELECT last_access_at AS lastAccessAt FROM system_access WHERE id = 1"
  ).get(), r = n.prepare(`
    SELECT COUNT(*) AS count FROM import_operations
    WHERE strftime('%Y-%m', created_at) = ?
  `).get(u);
  return {
    databaseSizeBytes: V.statSync(P).size,
    databaseTables: s,
    activeRecords: Number(a.count),
    activeRecordsByTable: i,
    validationErrors: Number(e.count),
    validationIssues: l,
    recentImports: E,
    lastAccessAt: (m == null ? void 0 : m.lastAccessAt) || null,
    currentPeriodImports: Number(r.count),
    latestOperation: c ? {
      status: c.status,
      operation: c.operation,
      createdAt: c.createdAt,
      errorMessage: c.errorMessage
    } : null
  };
}
const X = [
  "lumiax_genomica",
  "responsavel",
  "ticket_onboarding",
  "id_cliente",
  "cnpj",
  "razao_social",
  "nome_fantasia",
  "uf",
  "regional",
  "ev",
  "carteira",
  "coordenador",
  "gerente",
  "potencial",
  "fase",
  "entrada_mapeamento",
  "saida_mapeamento",
  "sla_mapeamento",
  "entrada_proposta",
  "saida_proposta",
  "sla_proposta",
  "entrada_negociacao",
  "saida_negociacao",
  "sla_negociacao",
  "entrada_contrato",
  "saida_contrato",
  "sla_contrato",
  "entrada_implantacao",
  "saida_implantacao",
  "sla_implantacao",
  "entrada_acompanhamento",
  "saida_acompanhamento",
  "sla_acompanhamento",
  "entrada_declinou",
  "saida_declinou",
  "sla_declinou",
  "entrada_concluido",
  "saida_concluido",
  "sla_concluido",
  "observacao",
  "historico",
  "selecionados"
];
class M {
  constructor(a, e, t) {
    b(this, "config");
    b(this, "db");
    b(this, "connected", !1);
    this.config = a, this.db = K({ client: e, connection: t, useNullAsDefault: e === "better-sqlite3" });
  }
  async connect() {
    await this.db.raw((this.config.provider === "sqlite", "select 1")), await this.ensureSchema(), this.connected = !0;
  }
  async disconnect() {
    await this.db.destroy(), this.connected = !1;
  }
  isConnected() {
    return this.connected;
  }
  async testConnection() {
    return await this.db.raw("select 1"), this.getDatabaseInfo();
  }
  async getDatabaseInfo() {
    return {
      provider: this.config.provider,
      connected: this.connected,
      databaseName: this.config.database
    };
  }
  async getFunis(a) {
    let e = this.db("funil").select("*").orderBy("data_criacao", "desc");
    return a != null && a.fase && (e = e.where("fase", a.fase)), a != null && a.responsavel && (e = e.where("responsavel", a.responsavel)), a != null && a.regional && (e = e.where("regional", a.regional)), a != null && a.search && (e = e.where((t) => t.whereILike("cnpj", `%${a.search}%`).orWhereILike("razao_social", `%${a.search}%`).orWhereILike("nome_fantasia", `%${a.search}%`))), e;
  }
  async getFunilById(a) {
    return await this.db("funil").where({ id: a }).first() || null;
  }
  async createFunil(a) {
    const e = this.pickFunilColumns(a), t = await this.db("funil").insert(e).returning("id"), o = this.extractId(t), s = await this.getFunilById(o);
    if (!s) throw new Error("Não foi possível recuperar o funil criado.");
    return s;
  }
  async updateFunil(a, e) {
    await this.db("funil").where({ id: a }).update(this.pickFunilColumns(e));
    const t = await this.getFunilById(a);
    if (!t) throw new Error("Funil não encontrado após atualização.");
    return t;
  }
  async deleteFunil(a) {
    await this.db("funil").where({ id: a }).delete();
  }
  async updateFunilPhase(a, e) {
    await this.db("funil").where({ id: a }).update({ fase: e });
  }
  async getRegionais() {
    return this.db("regionais").select("*").orderBy("nome_cliente");
  }
  async importRegionais(a) {
    await this.db.transaction(async (e) => {
      await e("regionais").delete(), a.length > 0 && await e("regionais").insert(a);
    });
  }
  async getObservacoes(a) {
    return this.db("observacoes").where({ funil_id: a }).orderBy([{ column: "data", order: "desc" }, { column: "id", order: "desc" }]);
  }
  async addObservacao(a, e) {
    const [t] = await this.db("observacoes").insert({ funil_id: a, ...e }).returning("id"), o = await this.db("observacoes").where({ id: this.extractId(t) }).first();
    if (!o) throw new Error("Não foi possível recuperar a observação criada.");
    return o;
  }
  async getSettings() {
    const a = await this.db("settings").select("*");
    return Object.fromEntries(a.map((e) => [e.key, e.value]));
  }
  async updateSettings(a) {
    await this.db.transaction(async (e) => {
      for (const [t, o] of Object.entries(a))
        await e("settings").insert({ key: t, value: JSON.stringify(o) }).onConflict("key").merge({ value: JSON.stringify(o) });
    });
  }
  async ensureSchema() {
    await this.db.schema.hasTable("regionais") || await this.db.schema.createTable("regionais", (a) => {
      a.increments("id").primary(), a.integer("ent_id_sap"), a.text("cnpj"), a.text("raiz"), a.text("nome_cliente"), a.text("desc_representante"), a.text("desc_regional_matriz"), a.text("executivo"), a.text("email"), a.text("nome_coordenador");
    }), await this.db.schema.hasTable("funil") || await this.db.schema.createTable("funil", (a) => {
      a.increments("id").primary();
      for (const e of X) a.text(e);
      a.timestamp("data_criacao").defaultTo(this.db.fn.now()), a.timestamp("data_atualizacao").defaultTo(this.db.fn.now());
    }), await this.db.schema.hasTable("observacoes") || await this.db.schema.createTable("observacoes", (a) => {
      a.increments("id").primary(), a.integer("funil_id").notNullable(), a.timestamp("data").defaultTo(this.db.fn.now()), a.text("observacao").notNullable();
    }), await this.db.schema.hasTable("settings") || await this.db.schema.createTable("settings", (a) => {
      a.string("key").primary(), a.text("value").notNullable();
    });
  }
  pickFunilColumns(a) {
    return Object.fromEntries(Object.entries(a).filter(([e]) => X.includes(e)));
  }
  extractId(a) {
    if (typeof a == "number") return a;
    if (typeof a == "bigint") return Number(a);
    if (a && typeof a == "object" && "id" in a) return this.extractId(a.id);
    throw new Error("O banco não retornou o identificador gerado.");
  }
}
class aa extends M {
  constructor(a) {
    super(a, "mysql2", {
      host: a.host,
      port: a.port || 3306,
      user: a.user,
      password: a.password,
      database: a.database,
      ssl: a.ssl ? { rejectUnauthorized: !1 } : void 0
    });
  }
}
class ea extends M {
  constructor(a) {
    super(a, "pg", a.connectionString || {
      host: a.host,
      port: a.port || 5432,
      user: a.user,
      password: a.password,
      database: a.database,
      ssl: a.ssl ? { rejectUnauthorized: !1 } : void 0
    });
  }
}
class ta extends M {
  constructor(a) {
    super(
      { ...a, provider: "sqlite" },
      "better-sqlite3",
      a.filename || C.join(I.getPath("userData"), "funil_comercial.db")
    );
  }
}
const y = ["lumiax_genomica", "responsavel", "ticket_onboarding", "id_cliente", "cnpj", "razao_social", "nome_fantasia", "uf", "regional", "ev", "carteira", "coordenador", "gerente", "potencial", "fase", "entrada_mapeamento", "saida_mapeamento", "sla_mapeamento", "entrada_proposta", "saida_proposta", "sla_proposta", "entrada_negociacao", "saida_negociacao", "sla_negociacao", "entrada_contrato", "saida_contrato", "sla_contrato", "entrada_implantacao", "saida_implantacao", "sla_implantacao", "entrada_acompanhamento", "saida_acompanhamento", "sla_acompanhamento", "entrada_declinou", "saida_declinou", "sla_declinou", "entrada_concluido", "saida_concluido", "sla_concluido", "observacao", "historico", "selecionados"];
class na {
  constructor(a) {
    b(this, "config");
    b(this, "client");
    b(this, "connected", !1);
    if (!a.connectionString || !a.authToken) throw new Error("Turso exige a URL do banco e um token de autenticação.");
    this.config = a, this.client = J({ url: a.connectionString, authToken: a.authToken });
  }
  async connect() {
    await this.client.execute("SELECT 1"), await this.ensureSchema(), this.connected = !0;
  }
  async disconnect() {
    this.client.close(), this.connected = !1;
  }
  isConnected() {
    return this.connected;
  }
  async testConnection() {
    return await this.client.execute("SELECT 1"), this.getDatabaseInfo();
  }
  async getDatabaseInfo() {
    return { provider: "turso", connected: this.connected, databaseName: this.config.connectionString };
  }
  async getFunis(a) {
    const e = [], t = [];
    for (const [s, i] of [["fase", a == null ? void 0 : a.fase], ["responsavel", a == null ? void 0 : a.responsavel], ["regional", a == null ? void 0 : a.regional]])
      i && (e.push(`${s} = ?`), t.push(i));
    return a != null && a.search && (e.push("(cnpj LIKE ? OR razao_social LIKE ? OR nome_fantasia LIKE ?)"), t.push(`%${a.search}%`, `%${a.search}%`, `%${a.search}%`)), (await this.client.execute({ sql: `SELECT * FROM funil ${e.length ? `WHERE ${e.join(" AND ")}` : ""} ORDER BY data_criacao DESC`, args: t })).rows;
  }
  async getFunilById(a) {
    return (await this.client.execute({ sql: "SELECT * FROM funil WHERE id = ?", args: [a] })).rows[0] || null;
  }
  async createFunil(a) {
    return this.insertFunil(a);
  }
  async updateFunil(a, e) {
    const t = Object.entries(e).filter(([s]) => y.includes(s));
    await this.client.execute({ sql: `UPDATE funil SET ${t.map(([s]) => `${s} = ?`).join(", ")} WHERE id = ?`, args: [...t.map(([, s]) => this.toValue(s)), a] });
    const o = await this.getFunilById(a);
    if (!o) throw new Error("Funil não encontrado após atualização.");
    return o;
  }
  async deleteFunil(a) {
    await this.client.execute({ sql: "DELETE FROM funil WHERE id = ?", args: [a] });
  }
  async updateFunilPhase(a, e) {
    await this.client.execute({ sql: "UPDATE funil SET fase = ? WHERE id = ?", args: [e, a] });
  }
  async getRegionais() {
    return (await this.client.execute("SELECT * FROM regionais ORDER BY nome_cliente")).rows;
  }
  async importRegionais(a) {
    await this.client.batch([{ sql: "DELETE FROM regionais", args: [] }, ...a.map((e) => ({ sql: "INSERT INTO regionais (id, ent_id_sap, cnpj, raiz, nome_cliente, desc_representante, desc_regional_matriz, executivo, email, nome_coordenador) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", args: [e.id, e.ent_id_sap, e.cnpj, e.raiz, e.nome_cliente, e.desc_representante, e.desc_regional_matriz, e.executivo, e.email, e.nome_coordenador].map((t) => this.toValue(t)) }))]);
  }
  async getObservacoes(a) {
    return (await this.client.execute({ sql: "SELECT * FROM observacoes WHERE funil_id = ? ORDER BY data DESC, id DESC", args: [a] })).rows;
  }
  async addObservacao(a, e) {
    const t = e.data ?? (/* @__PURE__ */ new Date()).toISOString(), o = await this.client.execute({ sql: "INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)", args: [a, t, e.observacao] });
    return { id: Number(o.lastInsertRowid), funil_id: a, data: t, observacao: e.observacao };
  }
  async getSettings() {
    const a = await this.client.execute("SELECT key, value FROM settings");
    return Object.fromEntries(a.rows.map((e) => [String(e.key), e.value]));
  }
  async updateSettings(a) {
    await this.client.batch(Object.entries(a).map(([e, t]) => ({ sql: "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [e, JSON.stringify(t)] })));
  }
  async ensureSchema() {
    await this.client.batch([
      { sql: "CREATE TABLE IF NOT EXISTS regionais (id INTEGER PRIMARY KEY, ent_id_sap INTEGER, cnpj TEXT, raiz TEXT, nome_cliente TEXT, desc_representante TEXT, desc_regional_matriz TEXT, executivo TEXT, email TEXT, nome_coordenador TEXT)", args: [] },
      { sql: `CREATE TABLE IF NOT EXISTS funil (id INTEGER PRIMARY KEY AUTOINCREMENT, ${y.map((a) => `${a} TEXT`).join(", ")}, data_criacao TEXT DEFAULT CURRENT_TIMESTAMP, data_atualizacao TEXT DEFAULT CURRENT_TIMESTAMP)`, args: [] },
      { sql: "CREATE TABLE IF NOT EXISTS observacoes (id INTEGER PRIMARY KEY AUTOINCREMENT, funil_id INTEGER NOT NULL, data TEXT DEFAULT CURRENT_TIMESTAMP, observacao TEXT NOT NULL)", args: [] },
      { sql: "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)", args: [] }
    ]);
  }
  async insertFunil(a) {
    const e = Object.entries(a).filter(([s]) => y.includes(s)), t = await this.client.execute({ sql: `INSERT INTO funil (${e.map(([s]) => s).join(", ")}) VALUES (${e.map(() => "?").join(", ")})`, args: e.map(([, s]) => this.toValue(s)) }), o = await this.getFunilById(Number(t.lastInsertRowid));
    if (!o) throw new Error("Não foi possível recuperar o funil criado.");
    return o;
  }
  toValue(a) {
    return a == null ? null : typeof a == "string" || typeof a == "number" || typeof a == "bigint" || typeof a == "boolean" ? a : String(a);
  }
}
class w {
  static create(a) {
    switch (a.provider) {
      case "sqlite":
        return new ta(a);
      case "postgres":
      case "supabase":
        return new ea(a);
      case "mysql":
        return new aa(a);
      case "turso":
        return new na(a);
      default:
        throw new Error(`Provider não suportado: ${String(a.provider)}`);
    }
  }
}
const U = () => ({
  provider: "sqlite",
  filename: C.join(I.getPath("userData"), "funil_comercial.db")
});
function D() {
  return C.join(I.getPath("userData"), "config.json");
}
async function oa() {
  try {
    const n = await A.readFile(D(), "utf8");
    return { ...U(), ...JSON.parse(n).database };
  } catch (n) {
    if (n.code !== "ENOENT") throw n;
    return U();
  }
}
async function ra(n) {
  await A.mkdir(C.dirname(D()), { recursive: !0 });
  const a = await sa();
  await A.writeFile(D(), JSON.stringify({ ...a, database: n }, null, 2), "utf8");
}
async function sa() {
  try {
    return JSON.parse(await A.readFile(D(), "utf8"));
  } catch (n) {
    if (n.code !== "ENOENT") throw n;
    return {};
  }
}
const ia = Q(import.meta.url), j = q(ia);
let R = null, N = null, L = null;
const T = (n) => `replace(replace(replace(replace(${n}, '.', ''), '/', ''), '-', ''), ' ', '')`;
function ca(n, a) {
  return String(a || "").split(/\r?\n/).flatMap((e, t) => {
    const o = e.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(.+)$/);
    return o ? [{
      id: -(n * 1e4 + t + 1),
      funil_id: n,
      data: `${o[3]}-${o[2]}-${o[1]}`,
      observacao: o[4].trim()
    }] : [];
  });
}
function $(n, a) {
  if (a.length === 0) return [];
  const e = /* @__PURE__ */ new Map(), t = a.map((i) => i.id), o = t.map(() => "?").join(","), s = n.prepare(
    `SELECT * FROM observacoes WHERE funil_id IN (${o}) ORDER BY data DESC, id DESC`
  ).all(...t);
  for (const i of s) {
    const l = e.get(i.funil_id) || [];
    l.push(i), e.set(i.funil_id, l);
  }
  return a.map((i) => {
    const l = e.get(i.id) || [], u = ca(i.id, i.historico).sort((E, c) => c.data.localeCompare(E.data));
    return {
      ...i,
      observacoes: l.length > 0 ? l : u
    };
  });
}
function H() {
  if (R && !R.isDestroyed()) {
    R.focus();
    return;
  }
  R = new z({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: C.join(j, "../electron/preload.cjs"),
      contextIsolation: !0,
      nodeIntegration: !1
    }
  }), !!process.env.VITE_DEV_SERVER_URL ? R.loadURL(process.env.VITE_DEV_SERVER_URL || "http://localhost:5173") : R.loadFile(C.join(j, "../dist/index.html")), R.on("closed", () => {
    R = null;
  });
}
I.whenReady().then(async () => {
  B(), L = await oa(), H(), d.handle("database:testConnection", async (n, a) => {
    const e = w.create(a);
    try {
      return await e.connect(), { success: !0, info: await e.getDatabaseInfo() };
    } catch (t) {
      return {
        success: !1,
        error: t instanceof Error ? t.message : String(t)
      };
    } finally {
      e.isConnected() && await e.disconnect();
    }
  }), d.handle("database:getCurrentProvider", () => ({
    provider: (L == null ? void 0 : L.provider) || "sqlite",
    connected: (N == null ? void 0 : N.isConnected()) || !1
  })), d.handle("database:switchProvider", async (n, a) => {
    const e = w.create(a);
    return await e.connect(), N != null && N.isConnected() && await N.disconnect(), N = e, L = a, await ra(a), await e.getDatabaseInfo();
  }), d.handle("database:migrateData", async (n, a, e) => {
    const t = w.create(a), o = w.create(e);
    let s = !1, i = !1;
    try {
      await t.connect(), s = !0, await o.connect(), i = !0;
      const l = await t.getRegionais(), u = await t.getFunis();
      await o.importRegionais(l);
      for (const E of u) {
        const c = await o.createFunil(E), m = await t.getObservacoes(E.id);
        for (const r of m)
          await o.addObservacao(c.id, {
            data: r.data,
            observacao: r.observacao
          });
      }
      return { success: !0, regionais: l.length, funis: u.length };
    } catch (l) {
      return {
        success: !1,
        error: l instanceof Error ? l.message : String(l)
      };
    } finally {
      s && await t.disconnect(), i && await o.disconnect();
    }
  }), d.handle("settings:selectFolder", async () => {
    const n = await k.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
    return n.canceled ? null : n.filePaths[0] || null;
  }), d.handle("regionais:getAll", () => p().prepare("SELECT * FROM regionais ORDER BY nome_cliente").all()), d.handle("regionais:getById", (n, a) => p().prepare("SELECT * FROM regionais WHERE id = ?").get(a) || null), d.handle("regionais:insert", (n, a) => p().prepare(`
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
  ).lastInsertRowid), d.handle("regionais:import", (n, a) => {
    if (!Array.isArray(a) || a.length === 0)
      throw f("Importação de regionais", 0, "error", void 0, "Nenhum registro fornecido."), new Error("Nenhum registro de regional foi fornecido para importação.");
    const e = p(), t = e.prepare(`
      INSERT INTO regionais (ent_id_sap, cnpj, raiz, nome_cliente, desc_representante,
        desc_regional_matriz, executivo, email, nome_coordenador)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `), o = e.transaction((s) => {
      e.prepare("DELETE FROM regionais").run();
      for (const i of s)
        t.run(
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
    });
    try {
      o(a);
    } catch (s) {
      throw f("Importação de regionais", 0, "error", void 0, s instanceof Error ? s.message : String(s)), s;
    }
    return f("Importação de regionais", a.length, "success"), a.length;
  }), d.handle("regionais:update", (n, a, e) => (p().prepare(`
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
  ), !0)), d.handle("regionais:delete", (n, a) => (p().prepare("DELETE FROM regionais WHERE id = ?").run(a), !0)), d.handle("regionais:clear", () => (p().prepare("DELETE FROM regionais").run(), !0)), d.handle("funil:getAll", () => {
    const n = p(), a = n.prepare(`
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
    return $(n, a);
  }), d.handle("funil:getById", (n, a) => {
    const e = p(), t = e.prepare(`
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
    return t ? $(e, [t])[0] : null;
  }), d.handle("funil:updatePhase", (n, a, e) => {
    if (!Number.isInteger(e) || e < 1 || e > 8)
      throw new Error("Fase inválida.");
    return p().prepare("UPDATE funil SET fase = ?, data_atualizacao = CURRENT_TIMESTAMP WHERE id = ?").run(e, a), !0;
  }), d.handle("funil:insert", (n, a) => {
    const e = p(), t = String(a.cnpj || "").replace(/\D/g, ""), o = Number(a.id_cliente), s = Number.isInteger(o) ? o : 0;
    if ((t || Number.isInteger(s) && s > 0) && e.prepare(`
        SELECT id
        FROM funil
        WHERE (${T("cnpj")} = ? AND ? <> '')
           OR (id_cliente = ? AND ? > 0)
        LIMIT 1
      `).get(t, t, s, s))
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
  }), d.handle("funil:import", (n, a) => {
    if (!Array.isArray(a) || a.length === 0)
      throw f("Importação de funil", 0, "error", void 0, "Nenhum registro fornecido."), new Error("Nenhum registro de funil foi fornecido para importação.");
    const e = p(), t = new Set(
      e.prepare("SELECT id FROM regionais").all().map((c) => c.id)
    ), o = (c) => c == null || c === "" ? null : typeof c == "boolean" ? c ? 1 : 0 : c instanceof Date ? c.toISOString() : typeof c == "object" ? String(c) : c, s = e.prepare(`
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
    ), l = new Set(
      e.prepare("SELECT id_cliente FROM funil WHERE id_cliente IS NOT NULL AND id_cliente > 0").all().map((c) => Number(c.id_cliente))
    ), u = e.transaction((c) => {
      let m = 0;
      for (const r of c) {
        const _ = String(r.cnpj || "").replace(/\D/g, ""), S = Number(r.id_cliente), g = Number.isInteger(S) ? S : 0;
        if (_ && i.has(_) || Number.isInteger(g) && g > 0 && l.has(g)) continue;
        const x = s.run(
          ...[
            r.lumiax_genomica,
            r.responsavel,
            r.ticket_onboarding,
            t.has(g) ? g : null,
            r.cnpj,
            r.razao_social,
            r.nome_fantasia,
            r.uf,
            r.regional,
            r.ev,
            r.carteira,
            r.coordenador,
            r.gerente,
            r.potencial,
            r.fase,
            r.entrada_mapeamento,
            r.saida_mapeamento,
            r.sla_mapeamento,
            r.entrada_proposta,
            r.saida_proposta,
            r.sla_proposta,
            r.entrada_negociacao,
            r.saida_negociacao,
            r.sla_negociacao,
            r.entrada_contrato,
            r.saida_contrato,
            r.sla_contrato,
            r.entrada_implantacao,
            r.saida_implantacao,
            r.sla_implantacao,
            r.entrada_acompanhamento,
            r.saida_acompanhamento,
            r.sla_acompanhamento,
            r.entrada_declinou,
            r.saida_declinou,
            r.sla_declinou,
            r.entrada_concluido,
            r.saida_concluido,
            r.sla_concluido,
            r.observacao,
            r.historico,
            r.selecionados
          ].map(o)
        );
        if (r.observacao) {
          const h = String(r.observacao).match(/^(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(.*)$/), F = h ? `${h[3]}-${h[2]}-${h[1]}` : (/* @__PURE__ */ new Date()).toISOString(), O = h ? h[4] : String(r.observacao);
          e.prepare("INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)").run(x.lastInsertRowid, F, O);
        }
        if (r.historico) {
          const h = e.prepare("INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)");
          for (const F of String(r.historico).split(/\r?\n/)) {
            const O = F.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(.+)$/);
            O && h.run(x.lastInsertRowid, `${O[3]}-${O[2]}-${O[1]}`, O[4].trim());
          }
        }
        _ && i.add(_), Number.isInteger(g) && g > 0 && l.add(g), m += 1;
      }
      return m;
    });
    let E;
    try {
      E = u(a);
    } catch (c) {
      throw f("Importação de funil", 0, "error", void 0, c instanceof Error ? c.message : String(c)), c;
    }
    return f("Importação de funil", E, E < a.length ? "warning" : "success"), E;
  }), d.handle("funil:update", (n, a, e) => (p().prepare(`
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
  ), !0)), d.handle("funil:delete", (n, a) => (p().prepare("DELETE FROM funil WHERE id = ?").run(a), !0)), d.handle("funil:deleteMany", (n, a) => {
    if (!Array.isArray(a) || a.length === 0) return 0;
    const e = p();
    return e.transaction((o) => {
      const s = e.prepare("DELETE FROM funil WHERE id = ?");
      for (const i of o)
        Number.isInteger(i) && s.run(i);
    })(a), a.length;
  }), d.handle("observacoes:add", (n, a, e, t) => p().prepare("INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)").run(a, t || (/* @__PURE__ */ new Date()).toISOString(), e).lastInsertRowid), d.handle("observacoes:getByFunilId", (n, a) => p().prepare("SELECT * FROM observacoes WHERE funil_id = ? ORDER BY data DESC").all(a)), d.handle("observacoes:import", (n, a) => {
    const e = p(), t = e.prepare("INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)"), o = e.prepare("SELECT id FROM funil WHERE replace(replace(replace(replace(cnpj, '.', ''), '/', ''), '-', ''), ' ', '') = ? LIMIT 1"), s = e.transaction((i) => {
      let l = 0, u = 0;
      for (const E of i) {
        const c = String(E.cnpj || E.CNPJ || "").replace(/\D/g, ""), m = String(E.observacao || E.Observação || E.Observacoes || "").trim(), r = String(E.data || E.Data || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!c || !m || !r) {
          u += 1;
          continue;
        }
        const _ = o.get(c);
        if (!(_ != null && _.id)) {
          u += 1;
          continue;
        }
        t.run(_.id, `${r[1]}-${r[2]}-${r[3]}`, m), l += 1;
      }
      return { updated: l, ignored: u };
    })(Array.isArray(a) ? a : []);
    return f("Importação de observações", s.updated, s.ignored > 0 ? "warning" : "success"), s;
  }), d.handle("systemHealth:getMetrics", () => Z()), d.handle("dashboard:getStats", (n, a) => {
    const e = p();
    let t = "1=1";
    const o = [];
    a != null && a.negocio && (t += " AND f.lumiax_genomica LIKE ?", o.push(`%${a.negocio}%`)), a != null && a.regional && (t += " AND COALESCE(r.desc_regional_matriz, f.regional) LIKE ?", o.push(`%${a.regional}%`)), a != null && a.fase && (t += " AND f.fase = ?", o.push(a.fase)), a != null && a.responsavel && (t += " AND f.responsavel LIKE ?", o.push(`%${a.responsavel}%`)), a != null && a.executivo && (t += " AND f.ev LIKE ?", o.push(`%${a.executivo}%`)), a != null && a.carteira && (t += " AND f.carteira LIKE ?", o.push(`%${a.carteira}%`));
    const s = e.prepare(`
      SELECT COALESCE(SUM(f.potencial), 0) as total FROM funil f
      LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${T("r2.cnpj")} = ${T("f.cnpj")}
        ORDER BY r2.id LIMIT 1
      ) WHERE ${t}
    `).get(...o), i = e.prepare(`
      SELECT COUNT(*) as count FROM funil f
      LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${T("r2.cnpj")} = ${T("f.cnpj")}
        ORDER BY r2.id LIMIT 1
      ) WHERE ${t}
    `).get(...o), l = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7), u = e.prepare(`
      SELECT COUNT(*) as count FROM funil f
      LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${T("r2.cnpj")} = ${T("f.cnpj")}
        ORDER BY r2.id LIMIT 1
      )
      WHERE strftime('%Y-%m', f.data_criacao) = ? AND ${t}
    `).get(l, ...o), E = e.prepare(`
      SELECT f.responsavel, SUM(f.potencial) as total, COUNT(*) as count
      FROM funil f LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${T("r2.cnpj")} = ${T("f.cnpj")}
        ORDER BY r2.id LIMIT 1
      )
      WHERE ${t} GROUP BY f.responsavel ORDER BY total DESC
    `).all(...o), c = e.prepare(`
      SELECT f.fase, SUM(f.potencial) as total, COUNT(*) as count
      FROM funil f LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${T("r2.cnpj")} = ${T("f.cnpj")}
        ORDER BY r2.id LIMIT 1
      )
      WHERE ${t} GROUP BY f.fase ORDER BY f.fase
    `).all(...o);
    return {
      totalPotencial: s.total,
      totalCount: i.count,
      newItemsThisMonth: u.count,
      potencialPorResponsavel: E,
      potencialPorFase: c
    };
  });
});
I.on("window-all-closed", () => {
  process.platform !== "darwin" && I.quit();
});
I.on("activate", () => {
  z.getAllWindows().length === 0 && H();
});
