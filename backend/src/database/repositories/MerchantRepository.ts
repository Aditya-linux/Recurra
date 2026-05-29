import { dbPool } from '../index.js';
import { PoolClient } from 'pg';

export interface Merchant {
  id: string;
  wallet_address: string;
  business_name: string;
  business_email: string | null;
  business_url: string | null;
  logo_url: string | null;
  kyc_status: 'pending' | 'submitted' | 'approved' | 'rejected';
  country_code: string | null;
  gst_number: string | null;
  webhook_url: string | null;
  webhook_secret: string | null;
  api_key_hash: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export class MerchantRepository {
  static async findById(id: string, client?: PoolClient): Promise<Merchant | null> {
    const db = client || dbPool;
    const result = await db.query<Merchant>('SELECT * FROM merchants WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async findByWallet(walletAddress: string, client?: PoolClient): Promise<Merchant | null> {
    const db = client || dbPool;
    const result = await db.query<Merchant>('SELECT * FROM merchants WHERE wallet_address = $1', [walletAddress]);
    return result.rows[0] || null;
  }

  static async create(merchant: Partial<Merchant>, client?: PoolClient): Promise<Merchant> {
    const db = client || dbPool;
    const query = `
      INSERT INTO merchants (
        wallet_address, business_name, business_email, business_url, 
        logo_url, country_code, gst_number
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [
      merchant.wallet_address, merchant.business_name, merchant.business_email || null,
      merchant.business_url || null, merchant.logo_url || null, merchant.country_code || null,
      merchant.gst_number || null
    ];
    const result = await db.query<Merchant>(query, values);
    return result.rows[0] as Merchant;
  }

  static async update(id: string, updates: Partial<Merchant>, client?: PoolClient): Promise<Merchant | null> {
    const db = client || dbPool;
    
    const setClauses: string[] = [];
    const values: any[] = [];
    let argCounter = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (['business_name', 'business_email', 'business_url', 'logo_url', 'kyc_status', 'country_code', 'gst_number', 'webhook_url', 'webhook_secret', 'api_key_hash', 'is_active'].includes(key)) {
        setClauses.push(`${key} = $${argCounter}`);
        values.push(value);
        argCounter++;
      }
    }

    if (setClauses.length === 0) return this.findById(id, client);

    values.push(id);
    const query = `
      UPDATE merchants
      SET ${setClauses.join(', ')}
      WHERE id = $${argCounter}
      RETURNING *
    `;

    const result = await db.query<Merchant>(query, values);
    return result.rows[0] || null;
  }
}
