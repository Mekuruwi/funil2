import type { DatabaseConfig } from './types';
import { KnexDatabaseAdapter } from './KnexDatabaseAdapter';

export class PostgresAdapter extends KnexDatabaseAdapter {
  constructor(config: DatabaseConfig) {
    super(config, 'pg', config.connectionString || {
      host: config.host,
      port: config.port || 5432,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    });
  }
}
