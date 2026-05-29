import { dbPool } from './index.js';

async function seed() {
  const client = await dbPool.connect();
  try {
    console.log('Wiping database for clean slate...');
    await client.query('TRUNCATE TABLE webhook_deliveries, webhook_endpoints, payments, subscriptions, plans, merchants, users CASCADE');
    console.log('Database wiped successfully.');
  } catch (error) {
    console.error('Database wipe failed:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

seed();
