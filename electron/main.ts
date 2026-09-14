import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { initializeDatabase, getDatabase } from './database';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;
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
    },
  });

  const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173');
    
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

  ipcMain.handle('regionais:import', (_, regionais: any[]) => {
    if (!Array.isArray(regionais) || regionais.length === 0) {
      throw new Error('Nenhum registro de regional foi fornecido para importação.');
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

    importTransaction(regionais);
    return regionais.length;
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

  ipcMain.handle('funil:getById', (_, id: number) => {
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

  ipcMain.handle('funil:updatePhase', (_, id: number, fase: number) => {
    if (!Number.isInteger(fase) || fase < 1 || fase > 8) {
      throw new Error('Fase inválida.');
    }
    const db = getDatabase();
    db.prepare('UPDATE funil SET fase = ?, data_atualizacao = CURRENT_TIMESTAMP WHERE id = ?')
      .run(fase, id);
    return true;
  });

  ipcMain.handle('funil:insert', (_, funil) => {
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

  ipcMain.handle('funil:import', (_, funis: any[]) => {
    if (!Array.isArray(funis) || funis.length === 0) {
      throw new Error('Nenhum registro de funil foi fornecido para importação.');
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

    return importTransaction(funis);
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

  ipcMain.handle('funil:delete', (_, id: number) => {
    const db = getDatabase();
    db.prepare('DELETE FROM funil WHERE id = ?').run(id);
    return true;
  });

  ipcMain.handle('funil:deleteMany', (_, ids: number[]) => {
    if (!Array.isArray(ids) || ids.length === 0) return 0;
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
  ipcMain.handle('observacoes:add', (_, funilId, observacao, data) => {
    const db = getDatabase();
    const stmt = db.prepare('INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)');
    const result = stmt.run(funilId, data || new Date().toISOString(), observacao);
    return result.lastInsertRowid;
  });

  ipcMain.handle('observacoes:getByFunilId', (_, funilId: number) => {
    const db = getDatabase();
    const result = db.prepare('SELECT * FROM observacoes WHERE funil_id = ? ORDER BY data DESC').all(funilId);
    return result;
  });

  ipcMain.handle('observacoes:import', (_, rows: any[]) => {
    const db = getDatabase();
    const insert = db.prepare('INSERT INTO observacoes (funil_id, data, observacao) VALUES (?, ?, ?)');
    const findFunil = db.prepare("SELECT id FROM funil WHERE replace(replace(replace(replace(cnpj, '.', ''), '/', ''), '-', ''), ' ', '') = ? LIMIT 1");
    return db.transaction((items: any[]) => {
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
  });

  // IPC Handlers for Dashboard stats
  ipcMain.handle('dashboard:getStats', (_, filters) => {
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
