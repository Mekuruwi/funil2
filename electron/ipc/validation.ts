import type { DatabaseConfig } from '../database/types';

export function assertDatabaseConfig(
  value: unknown,
): asserts value is DatabaseConfig {
  const config = value as Partial<DatabaseConfig> | null;
  const providers = ['sqlite', 'postgres', 'mysql', 'supabase', 'turso'];
  if (
    !config ||
    typeof config !== 'object' ||
    !providers.includes(String(config.provider))
  ) {
    throw new Error('Configuração de banco inválida.');
  }
  for (const field of [
    'filename',
    'connectionString',
    'authToken',
    'host',
    'user',
    'password',
    'database',
  ] as const) {
    const fieldValue = config[field];
    if (
      fieldValue !== undefined &&
      (typeof fieldValue !== 'string' || fieldValue.length > 4096)
    ) {
      throw new Error(`Campo inválido na configuração: ${field}.`);
    }
  }
  if (
    config.port !== undefined &&
    (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535)
  ) {
    throw new Error('Porta inválida na configuração do banco.');
  }
}

export function assertRecordList(
  value: unknown,
  label: string,
): asserts value is Array<Record<string, unknown>> {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50000) {
    throw new Error(
      `Lista de ${label} inválida ou acima do limite de 50.000 registros.`,
    );
  }
  for (const row of value) {
    if (!row || typeof row !== 'object' || Array.isArray(row))
      throw new Error(`Registro inválido em ${label}.`);
    for (const fieldValue of Object.values(row)) {
      if (
        fieldValue !== null &&
        !['string', 'number', 'boolean'].includes(typeof fieldValue)
      ) {
        throw new Error(`Valor inválido em um registro de ${label}.`);
      }
      if (typeof fieldValue === 'string' && fieldValue.length > 2000000) {
        throw new Error(`Texto acima do limite permitido em ${label}.`);
      }
    }
  }
}
