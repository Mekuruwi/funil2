import type { DatabaseConfig } from './types';
import { KnexDatabaseAdapter } from './KnexDatabaseAdapter';

export class MySQLAdapter extends KnexDatabaseAdapter {
  constructor(config: DatabaseConfig) {
    super(config, 'mysql2', {
      host: config.host,
      port: config.port || 3306,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    });
  }
}
