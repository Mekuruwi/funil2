import fs from 'fs/promises';
import path from 'path';
import { app, safeStorage } from 'electron';
import type { DatabaseConfig } from './types';

const SECRET_FIELDS = ['connectionString', 'authToken', 'password'] as const;
const SECRET_STORE_REFERENCE = 'safeStorage-v1';

const defaultConfig = (): DatabaseConfig => ({
  provider: 'sqlite',
  filename: path.join(app.getPath('userData'), 'funil_comercial.db'),
});

function configPath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

export async function loadDatabaseConfig(): Promise<DatabaseConfig> {
  try {
    const content = await fs.readFile(configPath(), 'utf8');
    const storedConfig = JSON.parse(content).database as
      (Partial<DatabaseConfig> & { secretStore?: string }) | undefined;
    if (!storedConfig) return defaultConfig();

    const legacySecrets = pickSecrets(storedConfig);
    const config = { ...defaultConfig(), ...storedConfig } as DatabaseConfig & {
      secretStore?: string;
    };
    delete config.secretStore;

    if (Object.keys(legacySecrets).length > 0) {
      await persistDatabaseConfig(config);
      return config;
    }

    if (storedConfig.secretStore === SECRET_STORE_REFERENCE) {
      return { ...config, ...(await loadSecrets()) };
    }

    return config;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return defaultConfig();
  }
}

export async function saveDatabaseConfig(
  database: DatabaseConfig,
): Promise<void> {
  await persistDatabaseConfig(database);
}

async function persistDatabaseConfig(database: DatabaseConfig): Promise<void> {
  await fs.mkdir(path.dirname(configPath()), { recursive: true });
  const current = await loadConfigFile();
  const secrets = pickSecrets(database);
  if (Object.keys(secrets).length > 0 && !safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'A criptografia segura do sistema não está disponível. As credenciais do banco não foram salvas.',
    );
  }

  if (Object.keys(secrets).length > 0) {
    const encrypted = safeStorage.encryptString(JSON.stringify(secrets));
    await writeAtomically(secretPath(), encrypted);
  } else {
    await fs.rm(secretPath(), { force: true });
  }

  const publicConfig = { ...database };
  for (const field of SECRET_FIELDS) delete publicConfig[field];
  const persistedDatabase = {
    ...publicConfig,
    ...(Object.keys(secrets).length > 0
      ? { secretStore: SECRET_STORE_REFERENCE }
      : {}),
  };
  await writeAtomically(
    configPath(),
    JSON.stringify({ ...current, database: persistedDatabase }, null, 2),
  );
}

function secretPath(): string {
  return path.join(app.getPath('userData'), 'database-secrets.enc');
}

function pickSecrets(
  value: Partial<DatabaseConfig>,
): Partial<Pick<DatabaseConfig, (typeof SECRET_FIELDS)[number]>> {
  return Object.fromEntries(
    SECRET_FIELDS.flatMap((field) =>
      typeof value[field] === 'string' && value[field] !== ''
        ? [[field, value[field]]]
        : [],
    ),
  ) as Partial<Pick<DatabaseConfig, (typeof SECRET_FIELDS)[number]>>;
}

async function loadSecrets(): Promise<Partial<DatabaseConfig>> {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error(
        'A criptografia segura do sistema não está disponível para ler as credenciais do banco.',
      );
    }
    const encrypted = await fs.readFile(secretPath());
    return JSON.parse(
      safeStorage.decryptString(encrypted),
    ) as Partial<DatabaseConfig>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}

async function writeAtomically(
  filePath: string,
  content: string | Buffer,
): Promise<void> {
  const temporaryPath = `${filePath}.tmp`;
  await fs.writeFile(temporaryPath, content, { mode: 0o600 });
  await fs.rename(temporaryPath, filePath);
}

export async function loadAppConfig(): Promise<Record<string, unknown>> {
  return loadConfigFile();
}

export async function saveAppConfigValue(
  key: string,
  value: unknown,
): Promise<void> {
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(key))
    throw new Error('Chave de configuração inválida.');
  await fs.mkdir(path.dirname(configPath()), { recursive: true });
  const current = await loadConfigFile();
  await fs.writeFile(
    configPath(),
    JSON.stringify({ ...current, [key]: value }, null, 2),
    'utf8',
  );
}

async function loadConfigFile(): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await fs.readFile(configPath(), 'utf8')) as Record<
      string,
      unknown
    >;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return {};
  }
}
