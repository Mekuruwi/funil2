import { describe, expect, it } from 'vitest';
import {
  attachObservations,
  normalizedCnpjSql,
  parseLegacyHistory,
} from '../electron/domain/funnelHistory';

describe('funnel history domain helpers', () => {
  it('parses valid legacy entries, trims text, and skips malformed lines', () => {
    expect(
      parseLegacyHistory(
        7,
        '03/02/2025 - Primeiro contato\nlinha inválida\n01/02/2025 -  Retorno  ',
      ),
    ).toEqual([
      {
        id: -70001,
        funil_id: 7,
        data: '2025-02-03',
        observacao: 'Primeiro contato',
      },
      { id: -70003, funil_id: 7, data: '2025-02-01', observacao: 'Retorno' },
    ]);
    expect(parseLegacyHistory(7, null)).toEqual([]);
  });

  it('prefers persisted observations and falls back to legacy history per funnel', () => {
    const result = attachObservations(
      [
        { id: 1, historico: '01/01/2025 - legado' },
        { id: 2, historico: '02/01/2025 - antigo' },
      ],
      [{ id: 12, funil_id: 2, data: '2025-01-03', observacao: 'persistido' }],
    );

    expect(result[0].observacoes).toEqual([
      { id: -10001, funil_id: 1, data: '2025-01-01', observacao: 'legado' },
    ]);
    expect(result[1].observacoes).toEqual([
      { id: 12, funil_id: 2, data: '2025-01-03', observacao: 'persistido' },
    ]);
  });

  it('builds the SQL expression for CNPJ punctuation normalization', () => {
    expect(normalizedCnpjSql('f.cnpj')).toBe(
      "replace(replace(replace(replace(f.cnpj, '.', ''), '/', ''), '-', ''), ' ', '')",
    );
  });
});
