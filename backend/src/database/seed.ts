import { Keypair } from '@stellar/stellar-sdk';
import { dbPool } from './index.js';

import fs from 'fs';
import path from 'path';
const KEYS_FILE = path.join(__dirname, 'demo_merchants_keys.json');

async function fundAccount(publicKey: string) {
  try {
    const response = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`);
    const responseJSON = await response.json() as any;
    console.log(`Funded ${publicKey}:`, responseJSON.successful ? 'SUCCESS' : 'FAILED');
  } catch (e) {
    console.error(`Failed to fund ${publicKey}`, e);
  }
}

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

    // Helper to generate UUIDs locally for the seed script
    const gen_random_uuid = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    let demoKeys: Record<string, { publicKey: string, secretKey: string }> = {};
    if (fs.existsSync(KEYS_FILE)) {
      console.log('Loading existing funded merchant keys from demo_merchants_keys.json');
      demoKeys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf-8'));
    } else {
      console.log('Generating and funding new merchant keys via Friendbot (this will take 10-20 seconds)...');
      const brandNames = ['Netflix', 'Amazon', 'Spotify', 'JioHotstar', 'Canva', 'Apple TV+', 'Adobe', 'YouTube'];
      for (const name of brandNames) {
        const keypair = Keypair.random();
        demoKeys[name] = { publicKey: keypair.publicKey(), secretKey: keypair.secret() };
        await fundAccount(keypair.publicKey());
      }
      fs.writeFileSync(KEYS_FILE, JSON.stringify(demoKeys, null, 2));
      console.log('Saved funded keys to demo_merchants_keys.json');
    }

    console.log('\\n=== DEMO MERCHANT E2E KEYS ===');
    console.table(demoKeys);
    console.log('==============================\\n');

    const brands = [
      { id: gen_random_uuid(), name: 'Netflix', logo: 'https://cdn.simpleicons.org/netflix/white', url: 'https://netflix.com', wallet: demoKeys['Netflix']!.publicKey },
      { id: gen_random_uuid(), name: 'Amazon', logo: '/logos/amazon.jpg', url: 'https://amazon.com', wallet: demoKeys['Amazon']!.publicKey },
      { id: gen_random_uuid(), name: 'Spotify', logo: '/logos/spotify.jpg', url: 'https://spotify.com', wallet: demoKeys['Spotify']!.publicKey },
      { id: gen_random_uuid(), name: 'JioHotstar', logo: '/logos/jiohotstar.jpg', url: 'https://jiocinema.com', wallet: demoKeys['JioHotstar']!.publicKey },
      { id: gen_random_uuid(), name: 'Canva', logo: '/logos/canva.jpg', url: 'https://canva.com', wallet: demoKeys['Canva']!.publicKey },
      { id: gen_random_uuid(), name: 'Apple TV+', logo: '/logos/apple-tv-plus.jpg', url: 'https://tv.apple.com', wallet: demoKeys['Apple TV+']!.publicKey },
      { id: gen_random_uuid(), name: 'Adobe', logo: '/logos/adobe.jpg', url: 'https://adobe.com', wallet: demoKeys['Adobe']!.publicKey },
      { id: gen_random_uuid(), name: 'YouTube', logo: '/logos/youtube.jpg', url: 'https://youtube.com', wallet: demoKeys['YouTube']!.publicKey }
    ];

    // Insert all brand merchants
    for (const brand of brands) {
        await client.query(`
          INSERT INTO merchants (id, wallet_address, business_name, platform_name, platform_url, redirect_url_template)
          VALUES ($1, $2, $3, $3, $4, $5)
        `, [brand.id, brand.wallet, brand.name, brand.url, brand.url + '?activate={wallet}']);
    }

    const usdcToken = 'CD5TE4CUOKX6T5UMHL4JUTX7FTCN2G7CK3XPP7XV35COKJ6RZA6SG7YR';

    // Insert Plans for each brand
    // Netflix Plans
    const netflixId = brands.find(b => b.name === 'Netflix')!.id;
    await client.query(`
      INSERT INTO plans (id, plan_id_on_chain, merchant_id, name, amount, interval_seconds, max_payments, token_address, is_active, redirect_url, redirect_label)
      VALUES 
        (gen_random_uuid(), 'netflix_basic', $1, 'Netflix Basic', 99900000, 2592000, 0, $2, true, 'https://netflix.com/welcome?plan=basic&w={wallet}', 'Watch Netflix'),
        (gen_random_uuid(), 'netflix_standard', $1, 'Netflix Standard', 154900000, 2592000, 0, $2, true, 'https://netflix.com/welcome?plan=standard&w={wallet}', 'Watch Netflix'),
        (gen_random_uuid(), 'netflix_4k', $1, 'Netflix Premium 4K', 229900000, 2592000, 0, $2, true, 'https://netflix.com/welcome?plan=premium&w={wallet}', 'Watch Netflix')
    `, [netflixId, usdcToken]);

    // Spotify Plans
    const spotifyId = brands.find(b => b.name === 'Spotify')!.id;
    await client.query(`
      INSERT INTO plans (id, plan_id_on_chain, merchant_id, name, amount, interval_seconds, max_payments, token_address, is_active, redirect_url, redirect_label)
      VALUES 
        (gen_random_uuid(), 'spotify_premium', $1, 'Spotify Premium', 109900000, 2592000, 0, $2, true, 'https://spotify.com/premium?w={wallet}', 'Listen on Spotify'),
        (gen_random_uuid(), 'spotify_duo', $1, 'Spotify Duo', 149900000, 2592000, 0, $2, true, 'https://spotify.com/duo?w={wallet}', 'Listen on Spotify'),
        (gen_random_uuid(), 'spotify_family', $1, 'Spotify Family', 169900000, 2592000, 0, $2, true, 'https://spotify.com/family?w={wallet}', 'Listen on Spotify')
    `, [spotifyId, usdcToken]);

    // Amazon Plans
    const amazonId = brands.find(b => b.name === 'Amazon')!.id;
    await client.query(`
      INSERT INTO plans (id, plan_id_on_chain, merchant_id, name, amount, interval_seconds, max_payments, token_address, is_active, redirect_url, redirect_label)
      VALUES 
        (gen_random_uuid(), 'amazon_prime', $1, 'Amazon Prime', 149900000, 2592000, 0, $2, true, 'https://amazon.com/prime?w={wallet}', 'Go to Prime Video')
    `, [amazonId, usdcToken]);

    // Canva Plans
    const canvaId = brands.find(b => b.name === 'Canva')!.id;
    await client.query(`
      INSERT INTO plans (id, plan_id_on_chain, merchant_id, name, amount, interval_seconds, max_payments, token_address, is_active, redirect_url, redirect_label)
      VALUES 
        (gen_random_uuid(), 'canva_pro', $1, 'Canva Pro', 129900000, 2592000, 0, $2, true, 'https://canva.com/pro?w={wallet}', 'Design on Canva')
    `, [canvaId, usdcToken]);

    // JioHotstar Plans
    const jioId = brands.find(b => b.name === 'JioHotstar')!.id;
    await client.query(`
      INSERT INTO plans (id, plan_id_on_chain, merchant_id, name, amount, interval_seconds, max_payments, token_address, is_active, redirect_url, redirect_label)
      VALUES 
        (gen_random_uuid(), 'jiocinema_premium', $1, 'JioCinema Premium', 99000000, 2592000, 0, $2, true, 'https://jiocinema.com/premium?w={wallet}', 'Watch JioCinema')
    `, [jioId, usdcToken]);

    // Apple TV+ Plans
    const appleId = brands.find(b => b.name === 'Apple TV+')!.id;
    await client.query(`
      INSERT INTO plans (id, plan_id_on_chain, merchant_id, name, amount, interval_seconds, max_payments, token_address, is_active, redirect_url, redirect_label)
      VALUES 
        (gen_random_uuid(), 'apple_tv', $1, 'Apple TV+ Standard', 99900000, 2592000, 0, $2, true, 'https://tv.apple.com?w={wallet}', 'Watch Apple TV+')
    `, [appleId, usdcToken]);

    // Adobe Plans
    const adobeId = brands.find(b => b.name === 'Adobe')!.id;
    await client.query(`
      INSERT INTO plans (id, plan_id_on_chain, merchant_id, name, amount, interval_seconds, max_payments, token_address, is_active, redirect_url, redirect_label)
      VALUES 
        (gen_random_uuid(), 'adobe_cc', $1, 'Adobe Creative Cloud', 549900000, 2592000, 0, $2, true, 'https://adobe.com/cc?w={wallet}', 'Use Adobe Apps')
    `, [adobeId, usdcToken]);

    // YouTube Plans
    const youtubeId = brands.find(b => b.name === 'YouTube')!.id;
    await client.query(`
      INSERT INTO plans (id, plan_id_on_chain, merchant_id, name, amount, interval_seconds, max_payments, token_address, is_active, redirect_url, redirect_label)
      VALUES 
        (gen_random_uuid(), 'youtube_premium', $1, 'YouTube Premium', 139900000, 2592000, 0, $2, true, 'https://youtube.com/premium?w={wallet}', 'Watch Ad-Free')
    `, [youtubeId, usdcToken]);

    console.log('Demo data seeded successfully!');
  } catch (error) {
    console.error('Database wipe failed:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

seed();
