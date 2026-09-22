import type { DatabaseConfig } from './types';
import { KnexDatabaseAdapter } from './KnexDatabaseAdapter';
import { app } from 'electron';
import path from 'path';

export class SQLiteAdapter extends KnexDatabaseAdapter {
  constructor(config: DatabaseConfig) {
    super(
      { ...config, provider: 'sqlite' },
      'better-sqlite3',
      config.filename || path.join(app.getPath('userData'), 'funil_comercial.db'),
    );
  }
}
