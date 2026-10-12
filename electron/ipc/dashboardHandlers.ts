import type { DatabaseAdapter } from '../database/DatabaseAdapter';
import {
  getDatabase as getLegacyDatabase,
  getSystemHealthMetrics,
} from '../database';
import {
  calculateDashboardStats,
  type DashboardFilters,
} from '../domain/dashboardStats';
import { normalizedCnpjSql } from '../domain/funnelHistory';
import type { IpcRegistrar } from './types';

type LegacyDatabase = ReturnType<typeof getLegacyDatabase>;

interface DashboardHandlerDependencies {
  getAdapter: () => DatabaseAdapter | null;
  getDatabase: () => LegacyDatabase;
}

export function registerDashboardIpcHandlers(
  handleIpc: IpcRegistrar,
  dependencies: DashboardHandlerDependencies,
) {
  handleIpc('systemHealth:getMetrics', () => {
    const adapter = dependencies.getAdapter();
    if (adapter?.isConnected()) return adapter.getSystemHealthMetrics();
    return getSystemHealthMetrics();
  });

  handleIpc(
    'dashboard:getStats',
    async (_event, filters: DashboardFilters = {}) => {
      const adapter = dependencies.getAdapter();
      if (adapter?.isConnected()) {
        const [funis, regionais] = await Promise.all([
          adapter.getFunis(),
          adapter.getRegionais(),
        ]);
        return calculateDashboardStats(funis, regionais, filters);
      }

      const db = dependencies.getDatabase();
      let whereClause = '1=1';
      const params: string[] = [];

      if (filters.negocio) {
        whereClause += ` AND f.lumiax_genomica LIKE ?`;
        params.push(`%${filters.negocio}%`);
      }
      if (filters.regional) {
        whereClause += ` AND COALESCE(r.desc_regional_matriz, f.regional) LIKE ?`;
        params.push(`%${filters.regional}%`);
      }
      if (filters.fase) {
        whereClause += ` AND f.fase = ?`;
        params.push(filters.fase);
      }
      if (filters.responsavel) {
        whereClause += ` AND f.responsavel LIKE ?`;
        params.push(`%${filters.responsavel}%`);
      }
      if (filters.executivo) {
        whereClause += ` AND f.ev LIKE ?`;
        params.push(`%${filters.executivo}%`);
      }
      if (filters.carteira) {
        whereClause += ` AND f.carteira LIKE ?`;
        params.push(`%${filters.carteira}%`);
      }

      const totalPotencial = db
        .prepare(
          `
      SELECT COALESCE(SUM(f.potencial), 0) as total FROM funil f
      LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${normalizedCnpjSql('r2.cnpj')} = ${normalizedCnpjSql('f.cnpj')}
        ORDER BY r2.id LIMIT 1
      ) WHERE ${whereClause}
    `,
        )
        .get(...params) as { total: number };

      const totalCount = db
        .prepare(
          `
      SELECT COUNT(*) as count FROM funil f
      LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${normalizedCnpjSql('r2.cnpj')} = ${normalizedCnpjSql('f.cnpj')}
        ORDER BY r2.id LIMIT 1
      ) WHERE ${whereClause}
    `,
        )
        .get(...params) as { count: number };

      const currentMonth = new Date().toISOString().slice(0, 7);
      const newItemsThisMonth = db
        .prepare(
          `
      SELECT COUNT(*) as count FROM funil f
      LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${normalizedCnpjSql('r2.cnpj')} = ${normalizedCnpjSql('f.cnpj')}
        ORDER BY r2.id LIMIT 1
      )
      WHERE strftime('%Y-%m', f.data_criacao) = ? AND ${whereClause}
    `,
        )
        .get(currentMonth, ...params) as { count: number };

      const potencialPorResponsavel = db
        .prepare(
          `
      SELECT f.responsavel, SUM(f.potencial) as total, COUNT(*) as count
      FROM funil f LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${normalizedCnpjSql('r2.cnpj')} = ${normalizedCnpjSql('f.cnpj')}
        ORDER BY r2.id LIMIT 1
      )
      WHERE ${whereClause} GROUP BY f.responsavel ORDER BY total DESC
    `,
        )
        .all(...params);

      const potencialPorFase = db
        .prepare(
          `
      SELECT f.fase, SUM(f.potencial) as total, COUNT(*) as count
      FROM funil f LEFT JOIN regionais r ON r.id = (
        SELECT r2.id FROM regionais r2
        WHERE ${normalizedCnpjSql('r2.cnpj')} = ${normalizedCnpjSql('f.cnpj')}
        ORDER BY r2.id LIMIT 1
      )
      WHERE ${whereClause} GROUP BY f.fase ORDER BY f.fase
    `,
        )
        .all(...params) as Array<{
        fase: string;
        total: number;
        count: number;
      }>;

      return {
        totalPotencial: totalPotencial.total,
        totalCount: totalCount.count,
        newItemsThisMonth: newItemsThisMonth.count,
        potencialPorResponsavel,
        potencialPorFase,
      };
    },
  );
}
