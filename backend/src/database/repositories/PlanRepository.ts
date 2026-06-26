import { dbPool } from '../index.js';
import { PoolClient } from 'pg';

export interface Plan {
  id: string;
  plan_id_on_chain: string;
  merchant_id: string;
  name: string;
  description: string | null;
  amount: string | number; // BIGINT mapping in pg is string
  token_address: string;
  interval_seconds: number;
  max_payments: number;
  is_active: boolean;
  metadata_uri: string | null;
  redirect_url: string | null;
  redirect_label: string | null;
  subscriber_count: number;
  tier: string;
  trial_days: number;
  features: string[];
  accepted_tokens: string[];
  created_at: Date;
  updated_at: Date;
}

export class PlanRepository {
  static async findById(id: string, client?: PoolClient): Promise<Plan | null> {
    const db = client || dbPool;
    const result = await db.query<Plan>('SELECT * FROM plans WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async findByOnChainId(planIdOnChain: string, client?: PoolClient): Promise<Plan | null> {
    const db = client || dbPool;
    const result = await db.query<Plan>('SELECT * FROM plans WHERE plan_id_on_chain = $1', [planIdOnChain]);
    return result.rows[0] || null;
  }

  static async findByMerchantId(merchantId: string, client?: PoolClient): Promise<Plan[]> {
    const db = client || dbPool;
    const result = await db.query<Plan>('SELECT * FROM plans WHERE merchant_id = $1 ORDER BY created_at DESC', [merchantId]);
    return result.rows;
  }

  static async findByTier(merchantId: string, tier: string, client?: PoolClient): Promise<Plan[]> {
    const db = client || dbPool;
    const result = await db.query<Plan>('SELECT * FROM plans WHERE merchant_id = $1 AND tier = $2 ORDER BY created_at DESC', [merchantId, tier]);
    return result.rows;
  }

  static async create(plan: Partial<Plan>, client?: PoolClient): Promise<Plan> {
    const db = client || dbPool;
    const query = `
      INSERT INTO plans (
        plan_id_on_chain, merchant_id, name, description, 
        amount, token_address, interval_seconds, max_payments, metadata_uri,
        redirect_url, redirect_label, tier, trial_days, features, accepted_tokens
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;
    const values = [
      plan.plan_id_on_chain, plan.merchant_id, plan.name, plan.description || null,
      plan.amount, plan.token_address, plan.interval_seconds, plan.max_payments || 0,
      plan.metadata_uri || null, plan.redirect_url || null, plan.redirect_label || 'Go to Platform',
      plan.tier || 'standard', plan.trial_days || 0, plan.features ? JSON.stringify(plan.features) : '[]',
      plan.accepted_tokens || '{}'
    ];
    const result = await db.query<Plan>(query, values);
    return result.rows[0] as Plan;
  }

  static async update(id: string, updates: Partial<Plan>, client?: PoolClient): Promise<Plan | null> {
    const db = client || dbPool;
    
    const setClauses: string[] = [];
    const values: any[] = [];
    let argCounter = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (['name', 'description', 'is_active', 'metadata_uri', 'subscriber_count', 'redirect_url', 'redirect_label', 'tier', 'trial_days', 'features', 'accepted_tokens'].includes(key)) {
        setClauses.push(`${key} = $${argCounter}`);
        if (key === 'features') {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
        argCounter++;
      }
    }

    if (setClauses.length === 0) return this.findById(id, client);

    values.push(id);
    const query = `
      UPDATE plans
      SET ${setClauses.join(', ')}
      WHERE id = $${argCounter}
      RETURNING *
    `;

    const result = await db.query<Plan>(query, values);
    return result.rows[0] || null;
  }
}
