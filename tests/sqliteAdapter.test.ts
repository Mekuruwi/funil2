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

  it('applies bulk updates only to records matching every condition', async () => {
    const first = await adapter.createFunil({
      responsavel: 'Ana',
      regional: 'Sul',
      fase: 1,
    });
    const second = await adapter.createFunil({
      responsavel: 'Ana',
      regional: 'Norte',
      fase: 1,
    });

    const updated = await adapter.bulkUpdateFunil('responsavel', 'Beatriz', [
      { field: 'responsavel', operator: 'contains', value: 'Ana' },
      { field: 'regional', operator: 'equals', value: 'Sul' },
    ]);

    expect(updated).toBe(1);
    await expect(adapter.getFunilById(first.id)).resolves.toMatchObject({
      responsavel: 'Beatriz',
    });
    await expect(adapter.getFunilById(second.id)).resolves.toMatchObject({
      responsavel: 'Ana',
    });
  });

  it('rolls back a batch import when one record cannot be inserted', async () => {
    await expect(
      adapter.importFunis([
        { cnpj: '111', razao_social: 'Válido' },
        { cnpj: '222', observacoes: [{ observacao: null }] },
      ]),
    ).rejects.toThrow();

    await expect(adapter.getFunis()).resolves.toHaveLength(0);
  });

  it('filters funnel records and deletes multiple records', async () => {
    const matching = await adapter.createFunil({
      cnpj: '123',
      razao_social: 'Empresa A',
      fase: 2,
    });
    await adapter.createFunil({
      cnpj: '456',
      razao_social: 'Empresa B',
      fase: 3,
    });

    await expect(
      adapter.getFunis({ fase: '2', search: 'Empresa A' }),
    ).resolves.toHaveLength(1);
    await adapter.deleteFunis([matching.id]);
    await expect(adapter.getFunis()).resolves.toHaveLength(1);
  });
});
