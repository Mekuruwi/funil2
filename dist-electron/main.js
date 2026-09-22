var V = Object.defineProperty;
var G = (s, e, a) => e in s ? V(s, e, { enumerable: !0, configurable: !0, writable: !0, value: a }) : s[e] = a;
var v = (s, e, a) => G(s, typeof e != "symbol" ? e + "" : e, a);
import { app as C, ipcMain as g, dialog as K, BrowserWindow as H } from "electron";
import y, { dirname as J } from "path";
import Q from "better-sqlite3";
import Z from "fs";
import ee from "knex";
import { createClient as ae } from "@libsql/client";
import A from "fs/promises";
import { fileURLToPath as te } from "url";
const W = y.join(C.getPath("userData"), "funil_comercial.db");
let M = null;
function Y() {
  if (M) return M;
  const s = new Q(W);
  return s.pragma("foreign_keys = ON"), s.exec(`
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
  `), s.exec(`
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
  `), s.exec(`
    CREATE TABLE IF NOT EXISTS observacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      funil_id INTEGER NOT NULL,
      data DATETIME DEFAULT CURRENT_TIMESTAMP,
      observacao TEXT NOT NULL,
      FOREIGN KEY (funil_id) REFERENCES funil(id) ON DELETE CASCADE
    )
  `), s.exec(`
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
  `), s.exec(`
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
  `), s.exec(`
    CREATE TABLE IF NOT EXISTS system_access (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_access_at DATETIME NOT NULL
    );
  `), s.prepare(`
    INSERT INTO system_access (id, last_access_at) VALUES (1, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET last_access_at = excluded.last_access_at
  `).run(), M = s, s;
}
function U() {
  return M || Y();
}
function w(s, e, a, t, n) {
  U().prepare(`
    INSERT INTO import_operations (operation, file_name, records, status, error_message)
    VALUES (?, ?, ?, ?, ?)
  `).run(s, null, e, a, n || null);
}
function ne() {
  const s = U();
  s.prepare(`
    INSERT INTO system_access (id, last_access_at) VALUES (1, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET last_access_at = excluded.last_access_at
  `).run();
  const e = s.prepare(`
    SELECT
      (SELECT COUNT(*) FROM regionais) + (SELECT COUNT(*) FROM funil) AS count
  `).get(), a = s.prepare(`
    SELECT
      (SELECT COUNT(*) FROM regionais
       WHERE COALESCE(TRIM(cnpj), '') = '' OR COALESCE(TRIM(nome_cliente), '') = '')
      + (SELECT COUNT(*) FROM funil
         WHERE id_cliente IS NOT NULL
           AND id_cliente > 0
           AND id_cliente NOT IN (SELECT id FROM regionais)) AS count
  `).get(), t = ["regionais", "funil", "observacoes", "import_operations", "system_access"], n = s.prepare(`
    SELECT name, COALESCE(SUM(pgsize), 0) AS sizeBytes
    FROM dbstat
    WHERE name IN (${t.map(() => "?").join(",")})
    GROUP BY name
  `).all(...t), i = t.map((E) => {
    var N;
    return {
      name: E,
      rows: Number(s.prepare(`SELECT COUNT(*) AS count FROM "${E}"`).get().count),
      sizeBytes: Number(((N = n.find((_) => _.name === E)) == null ? void 0 : N.sizeBytes) || 0)
    };
  }), r = i.filter((E) => E.name === "regionais" || E.name === "funil").map(({ name: E, rows: N }) => ({ name: E, rows: N })), l = [
    {
      code: "regional-cnpj-missing",
      label: "Regionais sem CNPJ",
      table: "regionais",
      count: Number(s.prepare("SELECT COUNT(*) AS count FROM regionais WHERE COALESCE(TRIM(cnpj), '') = ''").get().count)
    },
    {
      code: "regional-name-missing",
      label: "Regionais sem nome do cliente",
      table: "regionais",
      count: Number(s.prepare("SELECT COUNT(*) AS count FROM regionais WHERE COALESCE(TRIM(nome_cliente), '') = ''").get().count)
    },
    {
      code: "funil-regional-not-found",
      label: "Funis com regional não encontrada",
      table: "funil",
      count: Number(s.prepare(`
        SELECT COUNT(*) AS count FROM funil
        WHERE id_cliente IS NOT NULL AND id_cliente > 0
          AND id_cliente NOT IN (SELECT id FROM regionais)
      `).get().count)
    }
  ], u = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7), p = s.prepare(`
    SELECT id, operation, file_name AS fileName, records, status,
           error_message AS errorMessage, created_at AS createdAt
    FROM import_operations
    ORDER BY created_at DESC, id DESC
    LIMIT 10
  `).all(), d = p[0] || null, m = s.prepare(
    "SELECT last_access_at AS lastAccessAt FROM system_access WHERE id = 1"
  ).get(), c = s.prepare(`
    SELECT COUNT(*) AS count FROM import_operations
    WHERE strftime('%Y-%m', created_at) = ?
  `).get(u);
  return {
    databaseSizeBytes: Z.statSync(W).size,
    databaseTables: i,
    activeRecords: Number(e.count),
    activeRecordsByTable: r,
    validationErrors: Number(a.count),
    validationIssues: l,
    recentImports: p,
    lastAccessAt: (m == null ? void 0 : m.lastAccessAt) || null,
    currentPeriodImports: Number(c.count),
    latestOperation: d ? {
      status: d.status,
      operation: d.operation,
      createdAt: d.createdAt,
      errorMessage: d.errorMessage
    } : null
  };
}
const $ = [
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
class X {
  constructor(e, a, t) {
    v(this, "config");
    v(this, "db");
    v(this, "connected", !1);
    this.config = e, this.db = ee({ client: a, connection: t, useNullAsDefault: a === "better-sqlite3" });
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
      databaseName: this.config.filename || this.config.database || this.config.connectionString
    };
  }
  async getSystemHealthMetrics() {
    var c, E, N, _;
    const e = ["regionais", "funil", "observacoes", "import_operations", "system_access"], a = await Promise.all(e.map(async (h) => {
      var T;
      return {
        name: h,
        rows: Number(((T = await this.db(h).count({ count: "*" }).first()) == null ? void 0 : T.count) || 0),
        sizeBytes: 0
      };
    })), t = Number(((c = await this.db("regionais").whereNull("cnpj").orWhere("cnpj", "").count({ count: "*" }).first()) == null ? void 0 : c.count) || 0), n = Number(((E = await this.db("regionais").whereNull("nome_cliente").orWhere("nome_cliente", "").count({ count: "*" }).first()) == null ? void 0 : E.count) || 0), i = Number(((N = await this.db("funil").whereNotNull("id_cliente").whereNot("id_cliente", 0).whereNotIn("id_cliente", this.db("regionais").select("id")).count({ count: "*" }).first()) == null ? void 0 : N.count) || 0), r = await this.db("import_operations").select(
      "id",
      "operation",
      "file_name as fileName",
      "records",
      "status",
      "error_message as errorMessage",
      "created_at as createdAt"
    ).orderBy([{ column: "created_at", order: "desc" }, { column: "id", order: "desc" }]).limit(10), l = await this.db("system_access").where({ id: 1 }).first(), u = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7), p = this.config.provider === "mysql" ? "DATE_FORMAT(created_at, '%Y-%m')" : this.config.provider === "sqlite" ? "strftime('%Y-%m', created_at)" : "to_char(created_at, 'YYYY-MM')", d = Number(((_ = await this.db("import_operations").whereRaw(
      `${p} = ?`,
      [u]
    ).count({ count: "*" }).first()) == null ? void 0 : _.count) || 0), m = [
      { code: "regional-cnpj-missing", label: "Regionais sem CNPJ", table: "regionais", count: t },
      { code: "regional-name-missing", label: "Regionais sem nome do cliente", table: "regionais", count: n },
      { code: "funil-regional-not-found", label: "Funis com regional não encontrada", table: "funil", count: i }
    ];
    return {
      databaseSizeBytes: await this.estimateDatabaseSize(),
      databaseTables: a,
      activeRecords: a.filter(({ name: h }) => h === "regionais" || h === "funil").reduce((h, T) => h + T.rows, 0),
      activeRecordsByTable: a.filter(({ name: h }) => h === "regionais" || h === "funil").map(({ name: h, rows: T }) => ({ name: h, rows: T })),
      validationErrors: m.reduce((h, T) => h + T.count, 0),
      validationIssues: m,
      recentImports: r,
      lastAccessAt: (l == null ? void 0 : l.last_access_at) || null,
      currentPeriodImports: d,
      latestOperation: r[0] || null
    };
  }
  async recordImportOperation(e, a, t, n) {
    await this.db("import_operations").insert({
      operation: e,
      records: a,
      status: t,
      error_message: n || null
    });
  }
  async estimateDatabaseSize() {
    return (await Promise.all(["regionais", "funil", "observacoes", "import_operations", "system_access"].map(async (a) => {
      const t = await this.db(a).select("*");
      return JSON.stringify(t).length;
    }))).reduce((a, t) => a + t, 0);
  }
  async getFunis(e) {
    let a = this.db("funil").select("*").orderBy("data_criacao", "desc");
    return e != null && e.fase && (a = a.where("fase", e.fase)), e != null && e.responsavel && (a = a.where("responsavel", e.responsavel)), e != null && e.regional && (a = a.where("regional", e.regional)), e != null && e.search && (a = a.where((t) => t.whereILike("cnpj", `%${e.search}%`).orWhereILike("razao_social", `%${e.search}%`).orWhereILike("nome_fantasia", `%${e.search}%`))), a;
  }
  async getFunilById(e) {
    return await this.db("funil").where({ id: e }).first() || null;
  }
  async createFunil(e) {
    const a = this.pickFunilColumns(e), t = await this.db("funil").insert(a).returning("id"), n = this.extractId(t), i = await this.getFunilById(n);
    if (!i) throw new Error("Não foi possível recuperar o funil criado.");
    return i;
  }
  async importFunis(e) {
    let a = 0;
    return await this.db.transaction(async (t) => {
      for (const n of e) {
        const i = this.pickFunilColumns(n), [r] = await t("funil").insert(i).returning("id"), l = this.extractId(r), u = n.observacoes;
        u != null && u.length && await t("observacoes").insert(u.map((p) => ({
          funil_id: l,
          data: p.data,
          observacao: p.observacao
        }))), a += 1;
      }
    }), a;
  }
  async updateFunil(e, a) {
    await this.db("funil").where({ id: e }).update(this.pickFunilColumns(a));
    const t = await this.getFunilById(e);
    if (!t) throw new Error("Funil não encontrado após atualização.");
    return t;
  }
  async deleteFunil(e) {
    await this.db("funil").where({ id: e }).delete();
  }
  async updateFunilPhase(e, a) {
    await this.db("funil").where({ id: e }).update({ fase: a });
  }
  async getRegionais() {
    return this.db("regionais").select("*").orderBy("nome_cliente");
  }
  async getRegionalById(e) {
    return await this.db("regionais").where({ id: e }).first() || null;
  }
  async createRegional(e) {
    const [a] = await this.db("regionais").insert(e).returning("id");
    return this.extractId(a);
  }
  async updateRegional(e, a) {
    const { id: t, ...n } = a;
    await this.db("regionais").where({ id: e }).update(n);
  }
  async deleteRegional(e) {
    await this.db("regionais").where({ id: e }).delete();
  }
  async clearRegionais() {
    await this.db("regionais").delete();
  }
  async importRegionais(e) {
    const a = /* @__PURE__ */ new Set();
    let t = e.reduce((i, r) => {
      const l = Number(r.id);
      return Number.isInteger(l) && l > i ? l : i;
    }, 0) + 1;
    const n = e.map((i) => {
      const r = Number(i.id), l = Number.isInteger(r) && r > 0 && !a.has(r) ? r : t++;
      return a.add(l), { ...i, id: l };
    });
    await this.db.transaction(async (i) => {
      await i("regionais").delete(), n.length > 0 && await i("regionais").insert(n);
    });
  }
  async deleteFunis(e) {
    await this.db("funil").whereIn("id", e).delete();
  }
  async getObservacoes(e) {
    return this.db("observacoes").where({ funil_id: e }).orderBy([{ column: "data", order: "desc" }, { column: "id", order: "desc" }]);
  }
  async addObservacao(e, a) {
    const [t] = await this.db("observacoes").insert({ funil_id: e, ...a }).returning("id"), n = await this.db("observacoes").where({ id: this.extractId(t) }).first();
    if (!n) throw new Error("Não foi possível recuperar a observação criada.");
    return n;
  }
  async getSettings() {
    const e = await this.db("settings").select("*");
    return Object.fromEntries(e.map((a) => [a.key, a.value]));
  }
  async updateSettings(e) {
    await this.db.transaction(async (a) => {
      for (const [t, n] of Object.entries(e))
        await a("settings").insert({ key: t, value: JSON.stringify(n) }).onConflict("key").merge({ value: JSON.stringify(n) });
    });
  }
  async ensureSchema() {
    await this.db.schema.hasTable("regionais") || await this.db.schema.createTable("regionais", (e) => {
      e.increments("id").primary(), e.integer("ent_id_sap"), e.text("cnpj"), e.text("raiz"), e.text("nome_cliente"), e.text("desc_representante"), e.text("desc_regional_matriz"), e.text("executivo"), e.text("email"), e.text("nome_coordenador");
    }), await this.db.schema.hasTable("funil") || await this.db.schema.createTable("funil", (e) => {
      e.increments("id").primary();
      for (const a of $) e.text(a);
      e.timestamp("data_criacao").defaultTo(this.db.fn.now()), e.timestamp("data_atualizacao").defaultTo(this.db.fn.now());
    }), await this.db.schema.hasTable("observacoes") || await this.db.schema.createTable("observacoes", (e) => {
      e.increments("id").primary(), e.integer("funil_id").notNullable(), e.timestamp("data").defaultTo(this.db.fn.now()), e.text("observacao").notNullable();
    }), await this.db.schema.hasTable("settings") || await this.db.schema.createTable("settings", (e) => {
      e.string("key").primary(), e.text("value").notNullable();
    }), await this.db.schema.hasTable("import_operations") || await this.db.schema.createTable("import_operations", (e) => {
      e.increments("id").primary(), e.text("operation").notNullable(), e.text("file_name"), e.integer("records").notNullable().defaultTo(0), e.text("status").notNullable(), e.text("error_message"), e.timestamp("created_at").notNullable().defaultTo(this.db.fn.now());
    }), await this.db.schema.hasTable("system_access") || await this.db.schema.createTable("system_access", (e) => {
      e.integer("id").primary(), e.timestamp("last_access_at").notNullable();
    }), await this.db("system_access").insert({ id: 1, last_access_at: this.db.fn.now() }).onConflict("id").merge({ last_access_at: this.db.fn.now() });
  }
  pickFunilColumns(e) {
    return Object.fromEntries(Object.entries(e).filter(([a]) => $.includes(a)));
  }
  extractId(e) {
    if (typeof e == "number") return e;
    if (typeof e == "bigint") return Number(e);
    if (e && typeof e == "object" && "id" in e) return this.extractId(e.id);
    throw new Error("O banco não retornou o identificador gerado.");
  }
}
class oe extends X {
  constructor(e) {
    super(e, "mysql2", {
      host: e.host,
      port: e.port || 3306,
      user: e.user,
      password: e.password,
      database: e.database,
      ssl: e.ssl ? { rejectUnauthorized: !1 } : void 0
    });
  }
}
class se extends X {
  constructor(e) {
    super(e, "pg", e.connectionString || {
      host: e.host,
      port: e.port || 5432,
      user: e.user,
      password: e.password,
      database: e.database,
      ssl: e.ssl ? { rejectUnauthorized: !1 } : void 0
    });
  }
}
class ie extends X {
  constructor(e) {
    super(
      { ...e, provider: "sqlite" },
      "better-sqlite3",
      e.filename || y.join(C.getPath("userData"), "funil_comercial.db")
    );
  }
}
const D = ["lumiax_genomica", "responsavel", "ticket_onboarding", "id_cliente", "cnpj", "razao_social", "nome_fantasia", "uf", "regional", "ev", "carteira", "coordenador", "gerente", "potencial", "fase", "entrada_mapeamento", "saida_mapeamento", "sla_mapeamento", "entrada_proposta", "saida_proposta", "sla_proposta", "entrada_negociacao", "saida_negociacao", "sla_negociacao", "entrada_contrato", "saida_contrato", "sla_contrato", "entrada_implantacao", "saida_implantacao", "sla_implantacao", "entrada_acompanhamento", "saida_acompanhamento", "sla_acompanhamento", "entrada_declinou", "saida_declinou", "sla_declinou", "entrada_concluido", "saida_concluido", "sla_concluido", "observacao", "historico", "selecionados"];
class re {
  constructor(e) {
    v(this, "config");
    v(this, "client");
    v(this, "connected", !1);
    if (!e.connectionString || !e.authToken) throw new Error("Turso exige a URL do banco e um token de autenticação.");
    this.config = e, this.client = ae({ url: e.connectionString, authToken: e.authToken });
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
  async getSystemHealthMetrics() {
    var d, m, c;
    const e = ["regionais", "funil", "observacoes", "import_operations", "system_access"], a = await Promise.all(e.map(async (E) => ({ name: E, rows: Number((await this.client.execute(`SELECT COUNT(*) AS count FROM ${E}`)).rows[0].count || 0), sizeBytes: 0 }))), t = [
      { code: "regional-cnpj-missing", label: "Regionais sem CNPJ", table: "regionais", count: Number((await this.client.execute("SELECT COUNT(*) AS count FROM regionais WHERE cnpj IS NULL OR TRIM(cnpj) = ''")).rows[0].count || 0) },
      { code: "regional-name-missing", label: "Regionais sem nome do cliente", table: "regionais", count: Number((await this.client.execute("SELECT COUNT(*) AS count FROM regionais WHERE nome_cliente IS NULL OR TRIM(nome_cliente) = ''")).rows[0].count || 0) },
      { code: "funil-regional-not-found", label: "Funis com regional não encontrada", table: "funil", count: Number((await this.client.execute("SELECT COUNT(*) AS count FROM funil WHERE id_cliente IS NOT NULL AND id_cliente > 0 AND id_cliente NOT IN (SELECT id FROM regionais)")).rows[0].count || 0) }
    ], n = (await this.client.execute("SELECT id, operation, file_name as fileName, records, status, error_message as errorMessage, created_at as createdAt FROM import_operations ORDER BY created_at DESC, id DESC LIMIT 10")).rows, i = (await this.client.execute("SELECT last_access_at as lastAccessAt FROM system_access WHERE id = 1")).rows[0], r = Number(((d = (await this.client.execute("PRAGMA page_count")).rows[0]) == null ? void 0 : d.page_count) || 0), l = Number(((m = (await this.client.execute("PRAGMA page_size")).rows[0]) == null ? void 0 : m.page_size) || 0), u = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7), p = Number(((c = (await this.client.execute({ sql: "SELECT COUNT(*) AS count FROM import_operations WHERE substr(created_at, 1, 7) = ?", args: [u] })).rows[0]) == null ? void 0 : c.count) || 0);
    return { databaseSizeBytes: r * l, databaseTables: a, activeRecords: a.filter((E) => E.name === "regionais" || E.name === "funil").reduce((E, N) => E + N.rows, 0), activeRecordsByTable: a.filter((E) => E.name === "regionais" || E.name === "funil").map(({ name: E, rows: N }) => ({ name: E, rows: N })), validationErrors: t.reduce((E, N) => E + N.count, 0), validationIssues: t, recentImports: n, lastAccessAt: (i == null ? void 0 : i.lastAccessAt) || null, currentPeriodImports: p, latestOperation: n[0] || null };
  }
  async recordImportOperation(e, a, t, n) {
    await this.client.execute({ sql: "INSERT INTO import_operations (operation, records, status, error_message) VALUES (?, ?, ?, ?)", args: [e, a, t, n || null] });
  }
  async getFunis(e) {
    const a = [], t = [];
    for (const [i, r] of [["fase", e == null ? void 0 : e.fase], ["responsavel", e == null ? void 0 : e.responsavel], ["regional", e == null ? void 0 : e.regional]])
      r && (a.push(`${i} = ?`), t.push(r));
    return e != null && e.search && (a.push("(cnpj LIKE ? OR razao_social LIKE ? OR nome_fantasia LIKE ?)"), t.push(`%${e.search}%`, `%${e.search}%`, `%${e.search}%`)), (await this.client.execute({ sql: `SELECT * FROM funil ${a.length ? `WHERE ${a.join(" AND ")}` : ""} ORDER BY data_criacao DESC`, args: t })).rows;
  }
  async getFunilById(e) {
    return (await this.client.execute({ sql: "SELECT * FROM funil WHERE id = ?", args: [e] })).rows[0] || null;
  }
  async createFunil(e) {
    return this.insertFunil(e);
  }
  async importFunis(e) {
    const a = e.map((n) => {
      const i = Object.entries(n).filter(([r]) => D.includes(r));
      return { sql: `INSERT INTO funil (${i.map(([r]) => r).join(", ")}) VALUES (${i.map(() => "?").join(", ")})`, args: i.map(([, r]) => this.toValue(r)) };
    });
    for (let n = 0; n < a.length; n += 500)
      await this.client.batch(a.slice(n, n + 500));
    const t = e.map((n) => String(n.cnpj || "").replace(/\D/g, "")).filter(Boolean);
    if (t.length) {
      const n = t.map(() => "?").join(","), i = await this.client.execute({ sql: `SELECT id, cnpj FROM funil WHERE cnpj IN (${n})`, args: t }), r = new Map(i.rows.map((u) => [String(u.cnpj).replace(/\D/g, ""), Number(u.id)])), l = e.flatMap((u) => {
        const p = r.get(String(u.cnpj || "").replace(/\D/g, "")), d = u.observacoes;
        return p && d ? d.map((m) => ({ sql: "INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)", args: [p, m.data ?? (/* @__PURE__ */ new Date()).toISOString(), m.observacao] })) : [];
      });
      for (let u = 0; u < l.length; u += 500)
        await this.client.batch(l.slice(u, u + 500));
    }
    return e.length;
  }
  async updateFunil(e, a) {
    const t = Object.entries(a).filter(([i]) => D.includes(i));
    await this.client.execute({ sql: `UPDATE funil SET ${t.map(([i]) => `${i} = ?`).join(", ")} WHERE id = ?`, args: [...t.map(([, i]) => this.toValue(i)), e] });
    const n = await this.getFunilById(e);
    if (!n) throw new Error("Funil não encontrado após atualização.");
    return n;
  }
  async deleteFunil(e) {
    await this.client.execute({ sql: "DELETE FROM funil WHERE id = ?", args: [e] });
  }
  async updateFunilPhase(e, a) {
    await this.client.execute({ sql: "UPDATE funil SET fase = ? WHERE id = ?", args: [a, e] });
  }
  async getRegionais() {
    return (await this.client.execute("SELECT * FROM regionais ORDER BY nome_cliente")).rows;
  }
  async getRegionalById(e) {
    return (await this.client.execute({ sql: "SELECT * FROM regionais WHERE id = ?", args: [e] })).rows[0] || null;
  }
  async createRegional(e) {
    const a = await this.client.execute({ sql: "INSERT INTO regionais (ent_id_sap, cnpj, raiz, nome_cliente, desc_representante, desc_regional_matriz, executivo, email, nome_coordenador) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", args: [e.ent_id_sap, e.cnpj, e.raiz, e.nome_cliente, e.desc_representante, e.desc_regional_matriz, e.executivo, e.email, e.nome_coordenador].map((t) => this.toValue(t)) });
    return Number(a.lastInsertRowid);
  }
  async updateRegional(e, a) {
    await this.client.execute({ sql: "UPDATE regionais SET ent_id_sap = ?, cnpj = ?, raiz = ?, nome_cliente = ?, desc_representante = ?, desc_regional_matriz = ?, executivo = ?, email = ?, nome_coordenador = ? WHERE id = ?", args: [a.ent_id_sap, a.cnpj, a.raiz, a.nome_cliente, a.desc_representante, a.desc_regional_matriz, a.executivo, a.email, a.nome_coordenador, e].map((t) => this.toValue(t)) });
  }
  async deleteRegional(e) {
    await this.client.execute({ sql: "DELETE FROM regionais WHERE id = ?", args: [e] });
  }
  async clearRegionais() {
    await this.client.execute("DELETE FROM regionais");
  }
  async importRegionais(e) {
    const a = /* @__PURE__ */ new Set();
    let t = e.reduce((i, r) => {
      const l = Number(r.id);
      return Number.isInteger(l) && l > i ? l : i;
    }, 0) + 1;
    const n = e.map((i) => {
      const r = Number(i.id), l = Number.isInteger(r) && r > 0 && !a.has(r) ? r : t++;
      return a.add(l), {
        sql: "INSERT INTO regionais (id, ent_id_sap, cnpj, raiz, nome_cliente, desc_representante, desc_regional_matriz, executivo, email, nome_coordenador) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [l, i.ent_id_sap, i.cnpj, i.raiz, i.nome_cliente, i.desc_representante, i.desc_regional_matriz, i.executivo, i.email, i.nome_coordenador].map((p) => this.toValue(p))
      };
    });
    await this.client.batch([{ sql: "DELETE FROM regionais", args: [] }, ...n]);
  }
  async deleteFunis(e) {
    e.length && await this.client.execute({ sql: `DELETE FROM funil WHERE id IN (${e.map(() => "?").join(",")})`, args: e });
  }
  async getObservacoes(e) {
    return (await this.client.execute({ sql: "SELECT * FROM observacoes WHERE funil_id = ? ORDER BY data DESC, id DESC", args: [e] })).rows;
  }
  async addObservacao(e, a) {
    const t = a.data ?? (/* @__PURE__ */ new Date()).toISOString(), n = await this.client.execute({ sql: "INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)", args: [e, t, a.observacao] });
    return { id: Number(n.lastInsertRowid), funil_id: e, data: t, observacao: a.observacao };
  }
  async getSettings() {
    const e = await this.client.execute("SELECT key, value FROM settings");
    return Object.fromEntries(e.rows.map((a) => [String(a.key), a.value]));
  }
  async updateSettings(e) {
    await this.client.batch(Object.entries(e).map(([a, t]) => ({ sql: "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [a, JSON.stringify(t)] })));
  }
  async ensureSchema() {
    await this.client.batch([
      { sql: "CREATE TABLE IF NOT EXISTS regionais (id INTEGER PRIMARY KEY, ent_id_sap INTEGER, cnpj TEXT, raiz TEXT, nome_cliente TEXT, desc_representante TEXT, desc_regional_matriz TEXT, executivo TEXT, email TEXT, nome_coordenador TEXT)", args: [] },
      { sql: `CREATE TABLE IF NOT EXISTS funil (id INTEGER PRIMARY KEY AUTOINCREMENT, ${D.map((e) => `${e} TEXT`).join(", ")}, data_criacao TEXT DEFAULT CURRENT_TIMESTAMP, data_atualizacao TEXT DEFAULT CURRENT_TIMESTAMP)`, args: [] },
      { sql: "CREATE TABLE IF NOT EXISTS observacoes (id INTEGER PRIMARY KEY AUTOINCREMENT, funil_id INTEGER NOT NULL, data TEXT DEFAULT CURRENT_TIMESTAMP, observacao TEXT NOT NULL)", args: [] },
      { sql: "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)", args: [] },
      { sql: "CREATE TABLE IF NOT EXISTS import_operations (id INTEGER PRIMARY KEY AUTOINCREMENT, operation TEXT NOT NULL, file_name TEXT, records INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, error_message TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)", args: [] },
      { sql: "CREATE TABLE IF NOT EXISTS system_access (id INTEGER PRIMARY KEY, last_access_at TEXT NOT NULL)", args: [] },
      { sql: "INSERT INTO system_access (id, last_access_at) VALUES (1, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET last_access_at = excluded.last_access_at", args: [] }
    ]);
  }
  async insertFunil(e) {
    const a = Object.entries(e).filter(([i]) => D.includes(i)), t = await this.client.execute({ sql: `INSERT INTO funil (${a.map(([i]) => i).join(", ")}) VALUES (${a.map(() => "?").join(", ")})`, args: a.map(([, i]) => this.toValue(i)) }), n = await this.getFunilById(Number(t.lastInsertRowid));
    if (!n) throw new Error("Não foi possível recuperar o funil criado.");
    return n;
  }
  toValue(e) {
    return e == null ? null : typeof e == "string" || typeof e == "number" || typeof e == "bigint" || typeof e == "boolean" ? e : String(e);
  }
}
class F {
  static create(e) {
    switch (e.provider) {
      case "sqlite":
        return new ie(e);
      case "postgres":
      case "supabase":
        return new se(e);
      case "mysql":
        return new oe(e);
      case "turso":
        return new re(e);
      default:
        throw new Error(`Provider não suportado: ${String(e.provider)}`);
    }
  }
}
const z = () => ({
  provider: "sqlite",
  filename: y.join(C.getPath("userData"), "funil_comercial.db")
});
function x() {
  return y.join(C.getPath("userData"), "config.json");
}
async function ce() {
  try {
    const s = await A.readFile(x(), "utf8");
    return { ...z(), ...JSON.parse(s).database };
  } catch (s) {
    if (s.code !== "ENOENT") throw s;
    return z();
  }
}
async function de(s) {
  await A.mkdir(y.dirname(x()), { recursive: !0 });
  const e = await le();
  await A.writeFile(x(), JSON.stringify({ ...e, database: s }, null, 2), "utf8");
}
async function le() {
  try {
    return JSON.parse(await A.readFile(x(), "utf8"));
  } catch (s) {
    if (s.code !== "ENOENT") throw s;
    return {};
  }
}
const ue = te(import.meta.url), P = J(ue);
let O = null, o = null, I = null;
function R() {
  if (!(o != null && o.isConnected()))
    throw new Error(`O banco configurado (${(I == null ? void 0 : I.provider) || "desconhecido"}) não está conectado.`);
  return U();
}
async function j(s, e, a, t) {
  if (o != null && o.isConnected()) {
    await o.recordImportOperation(s, e, a, t);
    return;
  }
  w(s, e, a, void 0, t);
}
const b = (s) => `replace(replace(replace(replace(${s}, '.', ''), '/', ''), '-', ''), ' ', '')`;
function k(s, e) {
  return String(e || "").split(/\r?\n/).flatMap((a, t) => {
    const n = a.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(.+)$/);
    return n ? [{
      id: -(s * 1e4 + t + 1),
      funil_id: s,
      data: `${n[3]}-${n[2]}-${n[1]}`,
      observacao: n[4].trim()
    }] : [];
  });
}
function B(s, e) {
  if (e.length === 0) return [];
  const a = /* @__PURE__ */ new Map(), t = e.map((r) => r.id), n = t.map(() => "?").join(","), i = s.prepare(
    `SELECT * FROM observacoes WHERE funil_id IN (${n}) ORDER BY data DESC, id DESC`
  ).all(...t);
  for (const r of i) {
    const l = a.get(r.funil_id) || [];
    l.push(r), a.set(r.funil_id, l);
  }
  return e.map((r) => {
    const l = a.get(r.id) || [], u = k(r.id, r.historico).sort((p, d) => d.data.localeCompare(p.data));
    return {
      ...r,
      observacoes: l.length > 0 ? l : u
    };
  });
}
function q() {
  if (O && !O.isDestroyed()) {
    O.focus();
    return;
  }
  O = new H({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: y.join(P, "../electron/preload.cjs"),
      contextIsolation: !0,
      nodeIntegration: !1
    }
  }), !!process.env.VITE_DEV_SERVER_URL ? O.loadURL(process.env.VITE_DEV_SERVER_URL || "http://localhost:5173") : O.loadFile(y.join(P, "../dist/index.html")), O.on("closed", () => {
    O = null;
  });
}
C.whenReady().then(async () => {
  Y(), I = await ce();
  try {
    const s = F.create(I);
    await s.connect(), o = s;
  } catch (s) {
    console.error("Não foi possível conectar ao provider configurado.", s), o = null;
  }
  q(), g.handle("database:testConnection", async (s, e) => {
    const a = F.create(e);
    try {
      return await a.connect(), { success: !0, info: await a.getDatabaseInfo() };
    } catch (t) {
      return {
        success: !1,
        error: t instanceof Error ? t.message : String(t)
      };
    } finally {
      a.isConnected() && await a.disconnect();
    }
  }), g.handle("database:getCurrentProvider", () => ({
    provider: (I == null ? void 0 : I.provider) || "sqlite",
    connected: (o == null ? void 0 : o.isConnected()) || !1
  })), g.handle("database:getCurrentConfig", () => I), g.handle("database:switchProvider", async (s, e) => {
    const a = F.create(e);
    return await a.connect(), o != null && o.isConnected() && await o.disconnect(), o = a, I = e, await de(e), await a.getDatabaseInfo();
  }), g.handle("database:migrateData", async (s, e, a) => {
    const t = F.create(e), n = F.create(a);
    let i = !1, r = !1;
    try {
      await t.connect(), i = !0, await n.connect(), r = !0;
      const l = await t.getRegionais(), u = await t.getFunis();
      await n.importRegionais(l);
      for (const p of u) {
        const d = await n.createFunil(p), m = await t.getObservacoes(p.id);
        for (const c of m)
          await n.addObservacao(d.id, {
            data: c.data,
            observacao: c.observacao
          });
      }
      return { success: !0, regionais: l.length, funis: u.length };
    } catch (l) {
      return {
        success: !1,
        error: l instanceof Error ? l.message : String(l)
      };
    } finally {
      i && await t.disconnect(), r && await n.disconnect();
    }
  }), g.handle("settings:selectFolder", async () => {
    const s = await K.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
    return s.canceled ? null : s.filePaths[0] || null;
  }), g.handle("regionais:getAll", () => o != null && o.isConnected() ? o.getRegionais() : R().prepare("SELECT * FROM regionais ORDER BY nome_cliente").all()), g.handle("regionais:getById", async (s, e) => o != null && o.isConnected() ? o.getRegionalById(e) : R().prepare("SELECT * FROM regionais WHERE id = ?").get(e) || null), g.handle("regionais:insert", async (s, e) => o != null && o.isConnected() ? o.createRegional(e) : R().prepare(`
      INSERT INTO regionais (ent_id_sap, cnpj, raiz, nome_cliente, desc_representante, 
        desc_regional_matriz, executivo, email, nome_coordenador)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
    e.ent_id_sap,
    e.cnpj,
    e.raiz,
    e.nome_cliente,
    e.desc_representante,
    e.desc_regional_matriz,
    e.executivo,
    e.email,
    e.nome_coordenador
  ).lastInsertRowid), g.handle("regionais:import", async (s, e) => {
    if (!Array.isArray(e) || e.length === 0)
      throw w("Importação de regionais", 0, "error", void 0, "Nenhum registro fornecido."), new Error("Nenhum registro de regional foi fornecido para importação.");
    if (o != null && o.isConnected())
      return await o.importRegionais(e), await j("Importação de regionais", e.length, "success"), e.length;
    const a = R(), t = a.prepare(`
      INSERT INTO regionais (ent_id_sap, cnpj, raiz, nome_cliente, desc_representante,
        desc_regional_matriz, executivo, email, nome_coordenador)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `), n = a.transaction((i) => {
      a.prepare("DELETE FROM regionais").run();
      for (const r of i)
        t.run(
          r.ent_id_sap,
          r.cnpj,
          r.raiz,
          r.nome_cliente,
          r.desc_representante,
          r.desc_regional_matriz,
          r.executivo,
          r.email,
          r.nome_coordenador
        );
    });
    try {
      n(e);
    } catch (i) {
      throw w("Importação de regionais", 0, "error", void 0, i instanceof Error ? i.message : String(i)), i;
    }
    return w("Importação de regionais", e.length, "success"), e.length;
  }), g.handle("regionais:update", async (s, e, a) => o != null && o.isConnected() ? (await o.updateRegional(e, a), !0) : (R().prepare(`
      UPDATE regionais SET
        ent_id_sap = ?, cnpj = ?, raiz = ?, nome_cliente = ?,
        desc_representante = ?, desc_regional_matriz = ?, executivo = ?,
        email = ?, nome_coordenador = ?
      WHERE id = ?
    `).run(
    a.ent_id_sap,
    a.cnpj,
    a.raiz,
    a.nome_cliente,
    a.desc_representante,
    a.desc_regional_matriz,
    a.executivo,
    a.email,
    a.nome_coordenador,
    e
  ), !0)), g.handle("regionais:delete", async (s, e) => o != null && o.isConnected() ? (await o.deleteRegional(e), !0) : (R().prepare("DELETE FROM regionais WHERE id = ?").run(e), !0)), g.handle("regionais:clear", async () => o != null && o.isConnected() ? (await o.clearRegionais(), !0) : (R().prepare("DELETE FROM regionais").run(), !0)), g.handle("funil:getAll", async () => {
    if (o != null && o.isConnected()) {
      const a = await o.getFunis();
      return await Promise.all(a.map(async (n) => ({
        ...n,
        observacoes: await (o == null ? void 0 : o.getObservacoes(n.id)) || k(n.id, n.historico)
      })));
    }
    const s = R(), e = s.prepare(`
      SELECT f.*, r.nome_cliente, r.desc_representante, r.desc_regional_matriz as regional_cruzada,
             r.executivo as executivo_regional, r.nome_coordenador as coord_regional,
             r.desc_representante as carteira_cruzada
      FROM funil f
      LEFT JOIN regionais r ON r.id = (
        SELECT r2.id
        FROM regionais r2
        WHERE ${b("r2.cnpj")} = ${b("f.cnpj")}
        ORDER BY r2.id
        LIMIT 1
      )
      ORDER BY f.data_criacao DESC
    `).all();
    return B(s, e);
  }), g.handle("funil:getById", async (s, e) => {
    if (o != null && o.isConnected()) {
      const n = await o.getFunilById(e);
      return n ? { ...n, observacoes: await o.getObservacoes(e) } : null;
    }
    const a = R(), t = a.prepare(`
      SELECT f.*, r.nome_cliente, r.desc_representante, r.desc_regional_matriz,
             r.executivo as executivo_regional, r.nome_coordenador as coord_regional,
             COALESCE(r.desc_regional_matriz, f.regional) as regional_cruzada,
             COALESCE(r.desc_representante, f.carteira) as carteira_cruzada
      FROM funil f
      LEFT JOIN regionais r ON r.id = (
        SELECT r2.id
        FROM regionais r2
        WHERE ${b("r2.cnpj")} = ${b("f.cnpj")}
        ORDER BY r2.id
        LIMIT 1
      )
      WHERE f.id = ?
    `).get(e);
    return t ? B(a, [t])[0] : null;
  }), g.handle("funil:updatePhase", async (s, e, a) => {
    if (!Number.isInteger(a) || a < 1 || a > 8)
      throw new Error("Fase inválida.");
    return o != null && o.isConnected() ? (await o.updateFunilPhase(e, a), !0) : (R().prepare("UPDATE funil SET fase = ?, data_atualizacao = CURRENT_TIMESTAMP WHERE id = ?").run(a, e), !0);
  }), g.handle("funil:insert", async (s, e) => {
    if (o != null && o.isConnected()) {
      const u = { ...e, ticket_onboarding: e.ticket_onboarding || e.ticket || "", ev: e.executivo || e.ev };
      if ((await o.getFunis({ search: String(e.cnpj || "") })).some((m) => String(m.cnpj || "").replace(/\D/g, "") === String(e.cnpj || "").replace(/\D/g, "")))
        throw new Error("Já existe um registro do funil com este CNPJ ou cliente.");
      const d = await o.createFunil(u);
      return e.observacao && await o.addObservacao(d.id, { observacao: String(e.observacao) }), d.id;
    }
    const a = R(), t = String(e.cnpj || "").replace(/\D/g, ""), n = Number(e.id_cliente), i = Number.isInteger(n) ? n : 0;
    if ((t || Number.isInteger(i) && i > 0) && a.prepare(`
        SELECT id
        FROM funil
        WHERE (${b("cnpj")} = ? AND ? <> '')
           OR (id_cliente = ? AND ? > 0)
        LIMIT 1
      `).get(t, t, i, i))
      throw new Error("Já existe um registro do funil com este CNPJ ou cliente.");
    return a.prepare(`
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
      e.lumiax_genomica,
      e.responsavel,
      e.ticket_onboarding || e.ticket || "",
      e.id_cliente || null,
      e.cnpj,
      e.razao_social,
      e.nome_fantasia,
      e.uf,
      e.regional || "",
      e.executivo || e.ev,
      e.carteira || "",
      e.coordenador || "",
      e.gerente || "",
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
      e.selecionados
    ).lastInsertRowid;
  }), g.handle("funil:import", (s, e) => {
    if (!Array.isArray(e) || e.length === 0)
      throw w("Importação de funil", 0, "error", void 0, "Nenhum registro fornecido."), new Error("Nenhum registro de funil foi fornecido para importação.");
    if (o != null && o.isConnected())
      return (async () => {
        const d = await o.getFunis(), m = new Set(d.map((_) => String(_.cnpj || "").replace(/\D/g, "")).filter(Boolean)), c = new Set(d.map((_) => Number(_.id_cliente)).filter((_) => Number.isInteger(_) && _ > 0)), E = [];
        for (const _ of e) {
          const h = String(_.cnpj || "").replace(/\D/g, ""), T = Number(_.id_cliente);
          if (h && m.has(h) || Number.isInteger(T) && T > 0 && c.has(T)) continue;
          const f = [];
          if (_.observacao && f.push({ observacao: String(_.observacao) }), _.historico)
            for (const S of String(_.historico).split(/\r?\n/)) {
              const L = S.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(.+)$/);
              L && f.push({ data: `${L[3]}-${L[2]}-${L[1]}`, observacao: L[4].trim() });
            }
          E.push({
            ..._,
            ticket_onboarding: _.ticket_onboarding || _.ticket || "",
            id_cliente: Number.isInteger(T) && T > 0 ? T : null,
            ev: _.ev || _.executivo,
            observacoes: f
          }), h && m.add(h), Number.isInteger(T) && T > 0 && c.add(T);
        }
        const N = await o.importFunis(E);
        return await j("Importação de funil", N, N < e.length ? "warning" : "success"), N;
      })();
    const a = R(), t = new Set(
      a.prepare("SELECT id FROM regionais").all().map((d) => d.id)
    ), n = (d) => d == null || d === "" ? null : typeof d == "boolean" ? d ? 1 : 0 : d instanceof Date ? d.toISOString() : typeof d == "object" ? String(d) : d, i = a.prepare(`
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
    `), r = new Set(
      a.prepare("SELECT cnpj FROM funil WHERE cnpj IS NOT NULL AND cnpj <> ''").all().map((d) => String(d.cnpj).replace(/\D/g, "")).filter(Boolean)
    ), l = new Set(
      a.prepare("SELECT id_cliente FROM funil WHERE id_cliente IS NOT NULL AND id_cliente > 0").all().map((d) => Number(d.id_cliente))
    ), u = a.transaction((d) => {
      let m = 0;
      for (const c of d) {
        const E = String(c.cnpj || "").replace(/\D/g, ""), N = Number(c.id_cliente), _ = Number.isInteger(N) ? N : 0;
        if (E && r.has(E) || Number.isInteger(_) && _ > 0 && l.has(_)) continue;
        const h = i.run(
          ...[
            c.lumiax_genomica,
            c.responsavel,
            c.ticket_onboarding,
            t.has(_) ? _ : null,
            c.cnpj,
            c.razao_social,
            c.nome_fantasia,
            c.uf,
            c.regional,
            c.ev,
            c.carteira,
            c.coordenador,
            c.gerente,
            c.potencial,
            c.fase,
            c.entrada_mapeamento,
            c.saida_mapeamento,
            c.sla_mapeamento,
            c.entrada_proposta,
            c.saida_proposta,
            c.sla_proposta,
            c.entrada_negociacao,
            c.saida_negociacao,
            c.sla_negociacao,
            c.entrada_contrato,
            c.saida_contrato,
            c.sla_contrato,
            c.entrada_implantacao,
            c.saida_implantacao,
            c.sla_implantacao,
            c.entrada_acompanhamento,
            c.saida_acompanhamento,
            c.sla_acompanhamento,
            c.entrada_declinou,
            c.saida_declinou,
            c.sla_declinou,
            c.entrada_concluido,
            c.saida_concluido,
            c.sla_concluido,
            c.observacao,
            c.historico,
            c.selecionados
          ].map(n)
        );
        if (c.observacao) {
          const T = String(c.observacao).match(/^(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(.*)$/), f = T ? `${T[3]}-${T[2]}-${T[1]}` : (/* @__PURE__ */ new Date()).toISOString(), S = T ? T[4] : String(c.observacao);
          a.prepare("INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)").run(h.lastInsertRowid, f, S);
        }
        if (c.historico) {
          const T = a.prepare("INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)");
          for (const f of String(c.historico).split(/\r?\n/)) {
            const S = f.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(.+)$/);
            S && T.run(h.lastInsertRowid, `${S[3]}-${S[2]}-${S[1]}`, S[4].trim());
          }
        }
        E && r.add(E), Number.isInteger(_) && _ > 0 && l.add(_), m += 1;
      }
      return m;
    });
    let p;
    try {
      p = u(e);
    } catch (d) {
      throw w("Importação de funil", 0, "error", void 0, d instanceof Error ? d.message : String(d)), d;
    }
    return w("Importação de funil", p, p < e.length ? "warning" : "success"), p;
  }), g.handle("funil:update", async (s, e, a) => o != null && o.isConnected() ? (await o.updateFunil(e, { ...a, ticket_onboarding: a.ticket_onboarding || a.ticket || "", ev: a.executivo || a.ev }), !0) : (R().prepare(`
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
    a.lumiax_genomica,
    a.responsavel,
    a.ticket_onboarding,
    a.id_cliente,
    a.cnpj,
    a.razao_social,
    a.nome_fantasia,
    a.uf,
    a.regional,
    a.executivo || a.ev,
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
    a.selecionados,
    e
  ), !0)), g.handle("funil:delete", async (s, e) => o != null && o.isConnected() ? (await o.deleteFunil(e), !0) : (R().prepare("DELETE FROM funil WHERE id = ?").run(e), !0)), g.handle("funil:deleteMany", async (s, e) => {
    if (!Array.isArray(e) || e.length === 0) return 0;
    if (o != null && o.isConnected())
      return await o.deleteFunis(e.filter((n) => Number.isInteger(n))), e.length;
    const a = R();
    return a.transaction((n) => {
      const i = a.prepare("DELETE FROM funil WHERE id = ?");
      for (const r of n)
        Number.isInteger(r) && i.run(r);
    })(e), e.length;
  }), g.handle("observacoes:add", async (s, e, a, t) => o != null && o.isConnected() ? (await o.addObservacao(e, { observacao: a, data: t })).id : R().prepare("INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)").run(e, t || (/* @__PURE__ */ new Date()).toISOString(), a).lastInsertRowid), g.handle("observacoes:getByFunilId", async (s, e) => o != null && o.isConnected() ? o.getObservacoes(e) : R().prepare("SELECT * FROM observacoes WHERE funil_id = ? ORDER BY data DESC").all(e)), g.handle("observacoes:import", (s, e) => {
    if (o != null && o.isConnected())
      return (async () => {
        let r = 0, l = 0;
        for (const u of Array.isArray(e) ? e : []) {
          const p = String(u.cnpj || u.CNPJ || "").replace(/\D/g, ""), d = String(u.observacao || u.Observação || u.Observacoes || "").trim(), m = String(u.data || u.Data || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (!p || !d || !m) {
            l += 1;
            continue;
          }
          const c = (await o.getFunis({ search: p })).find((E) => String(E.cnpj || "").replace(/\D/g, "") === p);
          if (!c) {
            l += 1;
            continue;
          }
          await o.addObservacao(c.id, { data: `${m[1]}-${m[2]}-${m[3]}`, observacao: d }), r += 1;
        }
        return await j("Importação de observações", r, l > 0 ? "warning" : "success"), { updated: r, ignored: l };
      })();
    const a = R(), t = a.prepare("INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)"), n = a.prepare("SELECT id FROM funil WHERE replace(replace(replace(replace(cnpj, '.', ''), '/', ''), '-', ''), ' ', '') = ? LIMIT 1"), i = a.transaction((r) => {
      let l = 0, u = 0;
      for (const p of r) {
        const d = String(p.cnpj || p.CNPJ || "").replace(/\D/g, ""), m = String(p.observacao || p.Observação || p.Observacoes || "").trim(), c = String(p.data || p.Data || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!d || !m || !c) {
          u += 1;
          continue;
        }
        const E = n.get(d);
        if (!(E != null && E.id)) {
          u += 1;
          continue;
        }
        t.run(E.id, `${c[1]}-${c[2]}-${c[3]}`, m), l += 1;
      }
      return { updated: l, ignored: u };
    })(Array.isArray(e) ? e : []);
    return w("Importação de observações", i.updated, i.ignored > 0 ? "warning" : "success"), i;
  }), g.handle("systemHealth:getMetrics", () => o != null && o.isConnected() ? o.getSystemHealthMetrics() : ne()), g.handle("dashboard:getStats", (s, e) => {
    const a = R();
    let t = "1=1";
    const n = [];
    e != null && e.negocio && (t += " AND f.lumiax_genomica LIKE ?", n.push(`%${e.negocio}%`)), e != null && e.regional && (t += " AND COALESCE(r.desc_regional_matriz, f.regional) LIKE ?", n.push(`%${e.regional}%`)), e != null && e.fase && (t += " AND f.fase = ?", n.push(e.fase)), e != null && e.responsavel && (t += " AND f.responsavel LIKE ?", n.push(`%${e.responsavel}%`)), e != null && e.executivo && (t += " AND f.ev LIKE ?", n.push(`%${e.executivo}%`)), e != null && e.carteira && (t += " AND f.carteira LIKE ?", n.push(`%${e.carteira}%`));
    const i = a.prepare(`
      SELECT COALESCE(SUM(f.potencial), 0) as total FROM funil f
      LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${b("r2.cnpj")} = ${b("f.cnpj")}
        ORDER BY r2.id LIMIT 1
      ) WHERE ${t}
    `).get(...n), r = a.prepare(`
      SELECT COUNT(*) as count FROM funil f
      LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${b("r2.cnpj")} = ${b("f.cnpj")}
        ORDER BY r2.id LIMIT 1
      ) WHERE ${t}
    `).get(...n), l = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7), u = a.prepare(`
      SELECT COUNT(*) as count FROM funil f
      LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${b("r2.cnpj")} = ${b("f.cnpj")}
        ORDER BY r2.id LIMIT 1
      )
      WHERE strftime('%Y-%m', f.data_criacao) = ? AND ${t}
    `).get(l, ...n), p = a.prepare(`
      SELECT f.responsavel, SUM(f.potencial) as total, COUNT(*) as count
      FROM funil f LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${b("r2.cnpj")} = ${b("f.cnpj")}
        ORDER BY r2.id LIMIT 1
      )
      WHERE ${t} GROUP BY f.responsavel ORDER BY total DESC
    `).all(...n), d = a.prepare(`
      SELECT f.fase, SUM(f.potencial) as total, COUNT(*) as count
      FROM funil f LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${b("r2.cnpj")} = ${b("f.cnpj")}
        ORDER BY r2.id LIMIT 1
      )
      WHERE ${t} GROUP BY f.fase ORDER BY f.fase
    `).all(...n);
    return {
      totalPotencial: i.total,
      totalCount: r.count,
      newItemsThisMonth: u.count,
      potencialPorResponsavel: p,
      potencialPorFase: d
    };
  });
});
C.on("window-all-closed", () => {
  process.platform !== "darwin" && C.quit();
});
C.on("activate", () => {
  H.getAllWindows().length === 0 && q();
});
