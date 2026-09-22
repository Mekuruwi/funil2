import type { DatabaseAdapter } from './DatabaseAdapter';
import type { DatabaseConfig } from './types';
import { MySQLAdapter } from './MySQLAdapter';
import { PostgresAdapter } from './PostgresAdapter';
import { SQLiteAdapter } from './SQLiteAdapter';
import { TursoAdapter } from './TursoAdapter';

export class DatabaseFactory {
  static create(config: DatabaseConfig): DatabaseAdapter {
    switch (config.provider) {
      case 'sqlite':
        return new SQLiteAdapter(config);
      case 'postgres':
      case 'supabase':
        return new PostgresAdapter(config);
      case 'mysql':
        return new MySQLAdapter(config);
      case 'turso':
        return new TursoAdapter(config);
      default:
        throw new Error(`Provider não suportado: ${String(config.provider)}`);
    }
  }
}
