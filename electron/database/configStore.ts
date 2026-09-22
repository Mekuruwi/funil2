import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import type { DatabaseConfig } from './types';

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
    return { ...defaultConfig(), ...JSON.parse(content).database };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return defaultConfig();
  }
}

export async function saveDatabaseConfig(database: DatabaseConfig): Promise<void> {
  await fs.mkdir(path.dirname(configPath()), { recursive: true });
  const current = await loadConfigFile();
  await fs.writeFile(configPath(), JSON.stringify({ ...current, database }, null, 2), 'utf8');
}

async function loadConfigFile(): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await fs.readFile(configPath(), 'utf8')) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return {};
  }
}
