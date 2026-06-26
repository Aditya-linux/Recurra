import { Pool, PoolConfig } from 'pg';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const poolConfig: PoolConfig = {
  connectionString: config.database.url,
  min: config.database.poolMin,
  max: config.database.poolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // 5 seconds (Supabase can be slower)
};

// Auto-detect SSL for Supabase/cloud hosts even if DATABASE_SSL isn't set
const dbHost = config.database.url.match(new RegExp('@([^:/]+)'))?.[1] || '';
const isCloudDb = dbHost.includes('supabase') || dbHost.includes('neon') || dbHost.includes('render') || dbHost.includes('railway');
const needsSsl = config.database.ssl || isCloudDb;

if (needsSsl) {
  poolConfig.ssl = {
    rejectUnauthorized: false, // Required for Supabase pooler connections
  };
  logger.info('Database SSL enabled');
}

export const dbPool = new Pool(poolConfig);

dbPool.on('connect', () => {
  logger.debug('New database connection established');
});

dbPool.on('error', (err: any) => {
  // Don't crash the server on transient connection errors
  // The pool will automatically reconnect on the next query
  logger.error('Database pool error (non-fatal)', { error: err.message, code: err.code });
});

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = await dbPool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('✓ Database connection successful');
    return true;
  } catch (err) {
    logger.error('Database connection failed', { error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}
