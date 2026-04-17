import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { getServerEnv } from '../env';
import * as schema from './schema';

let pool: Pool | null = null;

export function getDb() {
  const { databaseUrl } = getServerEnv();
  if (!databaseUrl) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl,
      max: 5,
      idleTimeoutMillis: 30_000,
    });
  }

  return drizzle({ client: pool, schema });
}
