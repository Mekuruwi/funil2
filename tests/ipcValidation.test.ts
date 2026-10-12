import { describe, expect, it } from 'vitest';
import {
  assertDatabaseConfig,
  assertRecordList,
} from '../electron/ipc/validation';

describe('IPC input validation', () => {
  it('accepts supported providers and bounded scalar record lists', () => {
    expect(() =>
      assertDatabaseConfig({ provider: 'sqlite', filename: ':memory:' }),
    ).not.toThrow();
    expect(() =>
      assertDatabaseConfig({
        provider: 'turso',
        connectionString: 'libsql://db',
        authToken: 'token',
      }),
    ).not.toThrow();
    expect(() =>
      assertRecordList(
        [{ id: 1, name: 'Empresa', enabled: true, extra: null }],
        'funis',
      ),
    ).not.toThrow();
  });

  it('rejects unsupported providers, oversized fields, and invalid ports', () => {
    expect(() => assertDatabaseConfig({ provider: 'oracle' })).toThrow(
      'Configuração de banco inválida',
    );
    expect(() =>
      assertDatabaseConfig({ provider: 'sqlite', filename: 'x'.repeat(4097) }),
    ).toThrow('Campo inválido');
    expect(() =>
      assertDatabaseConfig({ provider: 'postgres', port: 65536 }),
    ).toThrow('Porta inválida');
  });

  it('rejects empty, oversized, nested, and oversized-text record lists', () => {
    expect(() => assertRecordList([], 'funis')).toThrow(
      'Lista de funis inválida',
    );
    expect(() =>
      assertRecordList([{ nested: { unsafe: true } }], 'funis'),
    ).toThrow('Valor inválido');
    expect(() =>
      assertRecordList([{ notes: 'x'.repeat(2000001) }], 'funis'),
    ).toThrow('Texto acima do limite');
    expect(() =>
      assertRecordList(
        Array.from({ length: 50001 }, () => ({})),
        'funis',
      ),
    ).toThrow('Lista de funis inválida');
  });
});
