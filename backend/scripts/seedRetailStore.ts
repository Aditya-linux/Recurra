import { dbPool } from '../src/database/index.js';
import { logger } from '../src/utils/logger.js';
import crypto from 'crypto';

const SUPER_MERCHANT_ID = '11111111-1111-1111-1111-111111111111';
const TREASURY_WALLET = 'GB3DJRW7V3NRNLLJU7D3YBEAFFRMXORVC55QRFXBG2E5PD4GPFNYS5BW';
const USDC_TOKEN = 'CD5TE4CUOKX6T5UMHL4JUTX7FTCN2G7CK3XPP7XV35COKJ6RZA6SG7YR';

async function seed() {
  logger.info('Starting retail storefront seed...');
  
  try {
    // 1. Create the Super Merchant (Platform Treasury)
    logger.info('Creating Super Merchant...');
    await dbPool.query(`
      INSERT INTO merchants (id, wallet_address, business_name, kyc_status)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET business_name = $3, wallet_address = $2
    `, [SUPER_MERCHANT_ID, TREASURY_WALLET, 'Recurra Retail Store', 'approved']);

    // 2. Define predefined plans
    const predefinedPlans = [
      { name: 'Spotify Premium', amount: 15.00 },
      { name: 'Netflix Standard', amount: 23.00 },
      { name: 'Amazon Prime', amount: 14.00 },
      { name: 'Claude Pro', amount: 20.00 },
    ];

    logger.info('Injecting predefined retail plans...');
    for (const plan of predefinedPlans) {
      const planIdOnChain = `plan_${crypto.randomBytes(4).toString('hex')}`;
      const amountStroops = Math.floor(plan.amount * 10000000);
      
      // Check if it exists by name and merchant
      const existing = await dbPool.query(
        'SELECT id FROM plans WHERE merchant_id = $1 AND name = $2', 
        [SUPER_MERCHANT_ID, plan.name]
      );

      if (existing.rowCount === 0) {
        await dbPool.query(`
          INSERT INTO plans (merchant_id, plan_id_on_chain, name, amount, interval_seconds, token_address, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          SUPER_MERCHANT_ID,
          planIdOnChain,
          plan.name,
          amountStroops,
          2592000, // Monthly
          USDC_TOKEN,
          true
        ]);
        logger.info(`Inserted plan: ${plan.name}`);
      } else {
        logger.info(`Plan ${plan.name} already exists. Skipping.`);
      }
    }

    logger.info('Retail storefront seed completed successfully!');
  } catch (error) {
    logger.error('Error seeding retail storefront', { error });
  } finally {
    process.exit(0);
  }
}

seed();
