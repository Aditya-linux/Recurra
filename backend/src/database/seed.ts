/**
 * Recurra Database Seed — Clean Slate
 * 
 * No hardcoded merchants or plans. The platform is fully self-service:
 * merchants register through the UI and create their own plans.
 * 
 * This seed only ensures the database is in a clean state for development.
 */

import { dbPool } from './index.js';

async function seed() {
  const client = await dbPool.connect();
  try {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║       Recurra — Self-Service Platform Seed              ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');

    console.log('Wiping database for clean slate...');
    await client.query(`
      TRUNCATE TABLE 
        notification_log,
        discount_redemptions,
        refunds,
        webhook_deliveries, 
        webhook_endpoints, 
        payments, 
        subscriptions, 
        discount_codes,
        plans, 
        merchants, 
        users 
      CASCADE
    `);
    console.log('✓ Database wiped successfully.');
    console.log('');

    console.log('┌──────────────────────────────────────────────────────────┐');
    console.log('│  No demo merchants or plans seeded.                     │');
    console.log('│                                                         │');
    console.log('│  To get started:                                        │');
    console.log('│  1. Connect your wallet on the frontend                 │');
    console.log('│  2. Register as a merchant                              │');
    console.log('│  3. Create subscription plans                           │');
    console.log('│  4. Users can then browse and subscribe                 │');
    console.log('└──────────────────────────────────────────────────────────┘');
    console.log('');
    console.log('✓ Seed complete — platform ready for self-service usage.');

  } catch (error) {
    console.error('Seed failed:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

seed();
