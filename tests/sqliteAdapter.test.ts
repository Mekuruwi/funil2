import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getPath: () => ':memory:' } }));

const { SQLiteAdapter } = await import('../electron/database/SQLiteAdapter');

describe('SQLiteDatabaseAdapter', () => {
  let adapter: InstanceType<typeof SQLiteAdapter>;

  beforeEach(async () => {
    adapter = new SQLiteAdapter({ provider: 'sqlite', filename: ':memory:' });
    await adapter.connect();
  });

  afterEach(async () => {
    if (adapter.isConnected()) await adapter.disconnect();
  });

  it('creates schema and persists funnel records and observations', async () => {
    const created = await adapter.createFunil({
      cnpj: '12345678000199',
      razao_social: 'Empresa',
      fase: 2,
    });
    const observation = await adapter.addObservacao(created.id, {
      data: '2025-02-03',
      observacao: 'Primeiro contato',
    });

    await expect(adapter.getFunilById(created.id)).resolves.toMatchObject({
      cnpj: '12345678000199',
      razao_social: 'Empresa',
    });
    await expect(adapter.getObservacoes(created.id)).resolves.toMatchObject([
      {
        id: observation.id,
        funil_id: created.id,
        observacao: 'Primeiro contato',
      },
    ]);
  });

  it('replaces regional data atomically and assigns duplicate identifiers', async () => {
    await adapter.importRegionais([
      { id: 7, cnpj: '111', nome_cliente: 'Primeiro' },
      { id: 7, cnpj: '222', nome_cliente: 'Segundo' },
    ]);

    const regionais = await adapter.getRegionais();
    expect(regionais).toHaveLength(2);
    expect(new Set(regionais.map((regional) => regional.id)).size).toBe(2);
    expect(regionais.map((regional) => regional.nome_cliente)).toEqual([
      'Primeiro',
      'Segundo',
    ]);
  });
});
