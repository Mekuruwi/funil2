import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let userDataPath = '';
let encryptionAvailable = true;

vi.mock('electron', () => ({
  app: { getPath: () => userDataPath },
  safeStorage: {
    isEncryptionAvailable: () => encryptionAvailable,
    encryptString: (value: string) =>
      Buffer.from(`encrypted:${Buffer.from(value).toString('base64')}`),
    decryptString: (value: Buffer) => {
      const decoded = value.toString();
      if (!decoded.startsWith('encrypted:'))
        throw new Error('Invalid ciphertext');
      return Buffer.from(
        decoded.slice('encrypted:'.length),
        'base64',
      ).toString();
    },
  },
}));

const {
  loadAppConfig,
  loadDatabaseConfig,
  saveAppConfigValue,
  saveDatabaseConfig,
} = await import('../electron/database/configStore');

describe('database configuration secret storage', () => {
  beforeEach(async () => {
    userDataPath = await fs.mkdtemp(
      path.join(os.tmpdir(), 'funil-config-test-'),
    );
    encryptionAvailable = true;
  });

  afterEach(async () => {
    await fs.rm(userDataPath, { recursive: true, force: true });
  });

  it('encrypts credentials and leaves only a vault reference in config.json', async () => {
    const database = {
      provider: 'postgres' as const,
      host: 'db.example.test',
      database: 'funil',
      user: 'app',
      connectionString: 'postgresql://app:secret@db.example.test/funil', // gitleaks:allow -- test fixture
      password: 'secret', // gitleaks:allow -- test fixture
    };

    await saveDatabaseConfig(database);

    const configFile = await fs.readFile(
      path.join(userDataPath, 'config.json'),
      'utf8',
    );
    const encryptedSecrets = await fs.readFile(
      path.join(userDataPath, 'database-secrets.enc'),
      'utf8',
    );
    expect(configFile).not.toContain(
      'postgresql://app:secret@db.example.test/funil',
    );
    expect(configFile).not.toContain('"password":"secret"');
    expect(configFile).toContain('safeStorage-v1');
    expect(encryptedSecrets).not.toContain('secret');
    await expect(loadDatabaseConfig()).resolves.toMatchObject(database);
  });

  it('migrates credentials from an existing plaintext configuration', async () => {
    await fs.mkdir(userDataPath, { recursive: true });
    await fs.writeFile(
      path.join(userDataPath, 'config.json'),
      JSON.stringify({
        database: {
          provider: 'mysql',
          host: 'localhost',
          password: 'legacy-secret', // gitleaks:allow -- legacy migration fixture
        },
      }),
    );

    await expect(loadDatabaseConfig()).resolves.toMatchObject({
      provider: 'mysql',
      host: 'localhost',
      password: 'legacy-secret',
    });

    const configFile = await fs.readFile(
      path.join(userDataPath, 'config.json'),
      'utf8',
    );
    expect(configFile).not.toContain('legacy-secret');
    await expect(
      fs.readFile(path.join(userDataPath, 'database-secrets.enc'), 'utf8'),
    ).resolves.not.toContain('legacy-secret');
  });

  it('refuses to persist credentials when system encryption is unavailable', async () => {
    encryptionAvailable = false;

    await expect(
      saveDatabaseConfig({ provider: 'turso', authToken: 'token' }),
    ).rejects.toThrow('A criptografia segura do sistema não está disponível');
  });

  it('uses the default SQLite config when no config file exists', async () => {
    await expect(loadDatabaseConfig()).resolves.toMatchObject({
      provider: 'sqlite',
      filename: path.join(userDataPath, 'funil_comercial.db'),
    });
  });

  it('preserves non-database settings and rejects invalid setting keys', async () => {
    await saveAppConfigValue('documentSettings', { outputFolder: 'C:\\docs' });
    await expect(loadAppConfig()).resolves.toEqual({
      documentSettings: { outputFolder: 'C:\\docs' },
    });
    await expect(saveAppConfigValue('../database', 'unsafe')).rejects.toThrow(
      'Chave de configuração inválida',
    );
  });

  it('loads the public config when a referenced credential file is missing', async () => {
    await fs.mkdir(userDataPath, { recursive: true });
    await fs.writeFile(
      path.join(userDataPath, 'config.json'),
      JSON.stringify({
        database: { provider: 'turso', secretStore: 'safeStorage-v1' },
      }),
    );

    await expect(loadDatabaseConfig()).resolves.toMatchObject({
      provider: 'turso',
    });
  });

  it('removes the encrypted credential file when saving a config without secrets', async () => {
    await saveDatabaseConfig({ provider: 'postgres', password: 'temporary' });
    await saveDatabaseConfig({ provider: 'sqlite', filename: ':memory:' });

    await expect(
      fs.access(path.join(userDataPath, 'database-secrets.enc')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(loadDatabaseConfig()).resolves.toMatchObject({
      provider: 'sqlite',
      filename: ':memory:',
    });
  });

  it('fails closed if encrypted credentials cannot be decrypted', async () => {
    await fs.mkdir(userDataPath, { recursive: true });
    await fs.writeFile(
      path.join(userDataPath, 'config.json'),
      JSON.stringify({
        database: { provider: 'turso', secretStore: 'safeStorage-v1' },
      }),
    );
    await fs.writeFile(
      path.join(userDataPath, 'database-secrets.enc'),
      'invalid-ciphertext',
    );

    await expect(loadDatabaseConfig()).rejects.toThrow('Invalid ciphertext');
  });

  it('fails closed when the platform encryption facility is unavailable for existing credentials', async () => {
    await fs.mkdir(userDataPath, { recursive: true });
    await fs.writeFile(
      path.join(userDataPath, 'config.json'),
      JSON.stringify({
        database: { provider: 'turso', secretStore: 'safeStorage-v1' },
      }),
    );
    encryptionAvailable = false;

    await expect(loadDatabaseConfig()).rejects.toThrow(
      'criptografia segura do sistema não está disponível',
    );
  });
});
