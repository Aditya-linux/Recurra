import { dbPool } from './index.js';

async function seed() {
  const client = await dbPool.connect();
  try {
    console.log('Wiping database for clean slate...');
    await client.query('TRUNCATE TABLE webhook_deliveries, webhook_endpoints, payments, subscriptions, plans, merchants, users CASCADE');
    console.log('Database wiped successfully.');

    console.log('Seeding demo merchants and plans...');
    const superMerchantId = '00000000-0000-0000-0000-000000000000';
    const superMerchantWallet = 'GB3DJRW7V3NRNLLJU7D3YBEAFFRMXORVC55QRFXBG2E5PD4GPFNYS5BW';
    
    // Insert Super Merchant (Retail Storefront)
    await client.query(`
      INSERT INTO merchants (id, wallet_address, business_name, platform_name, platform_url)
      VALUES ($1, $2, 'Recurra Retail Storefront', 'Recurra Store', 'http://localhost:5173/store')
    `, [superMerchantId, superMerchantWallet]);

    // Insert Netflix Demo Merchant
    const netflixId = '11111111-1111-1111-1111-111111111111';
    await client.query(`
      INSERT INTO merchants (id, wallet_address, business_name, platform_name, platform_url, redirect_url_template)
      VALUES ($1, 'GC7IFMQQX6L4XWCFHMTZ3XD7JXMXVFDJI7CHVTWXYFLN3BZTM5L32DPX', 'Netflix Streaming', 'Netflix', 'https://netflix.com', 'https://netflix.com/activate?wallet={wallet}')
    `, [netflixId]);

    // Insert Top Subscription Brands
    await client.query(`
      INSERT INTO plans (id, plan_id_on_chain, merchant_id, name, amount, interval_seconds, max_payments, token_address, is_active, redirect_url, redirect_label)
      VALUES 
        (gen_random_uuid(), 'netflix_4k', $1, 'Netflix Premium 4K', 229900000, 2592000, 0, 'CD5TE4CUOKX6T5UMHL4JUTX7FTCN2G7CK3XPP7XV35COKJ6RZA6SG7YR', true, 'https://netflix.com/welcome?plan=premium&w={wallet}', 'Watch Netflix'),
        (gen_random_uuid(), 'amazon_prime', $1, 'Amazon Prime', 149900000, 2592000, 0, 'CD5TE4CUOKX6T5UMHL4JUTX7FTCN2G7CK3XPP7XV35COKJ6RZA6SG7YR', true, 'https://amazon.com/prime?w={wallet}', 'Go to Prime Video'),
        (gen_random_uuid(), 'spotify_premium', $1, 'Spotify Premium', 109900000, 2592000, 0, 'CD5TE4CUOKX6T5UMHL4JUTX7FTCN2G7CK3XPP7XV35COKJ6RZA6SG7YR', true, 'https://spotify.com/premium?w={wallet}', 'Listen on Spotify'),
        (gen_random_uuid(), 'jiocinema_premium', $1, 'JioCinema Premium', 99000000, 2592000, 0, 'CD5TE4CUOKX6T5UMHL4JUTX7FTCN2G7CK3XPP7XV35COKJ6RZA6SG7YR', true, 'https://jiocinema.com/premium?w={wallet}', 'Watch JioCinema')
    `, [netflixId]);

    console.log('Demo data seeded successfully!');
  } catch (error) {
    console.error('Database wipe failed:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

seed();
