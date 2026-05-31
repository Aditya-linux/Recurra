import { Pool, PoolConfig } from 'pg';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const poolConfig: PoolConfig = {
  connectionString: config.database.url,
  min: config.database.poolMin,
  max: config.database.poolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

if (config.database.ssl) {
  poolConfig.ssl = {
    rejectUnauthorized: false, // Depending on the provider, this might be needed
  };
}

export const dbPool = new Pool(poolConfig);

dbPool.on('connect', () => {
  logger.debug('New database connection established');
});

dbPool.on('error', (err: any) => {
  logger.error('Unexpected error on idle database client', { error: err.message });
  process.exit(-1);
});

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = await dbPool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('Database connection successful');
    return true;
  } catch (err) {
    logger.error('Database connection failed', { error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}
