import { dbPool } from '../index.js';
import { PoolClient } from 'pg';

export interface Subscription {
  id: string;
  subscription_id_on_chain: string | null;
  user_id: string;
  plan_id: string;
  status: 'active' | 'inactive' | 'paused' | 'cancelled';
  created_at: Date;
  updated_at: Date;
}

export class SubscriptionRepository {
  static async findById(id: string, client?: PoolClient): Promise<Subscription | null> {
    const db = client || dbPool;
    const result = await db.query<Subscription>('SELECT * FROM subscriptions WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async findByUserId(userId: string, client?: PoolClient): Promise<any[]> {
    const db = client || dbPool;
    const query = `
      SELECT 
        s.id, s.status, s.subscription_id_on_chain, s.next_payment_time,
        p.name, p.amount, p.token_address, p.interval_seconds
      FROM subscriptions s
      JOIN plans p ON s.plan_id = p.id
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC
    `;
    const result = await db.query(query, [userId]);
    return result.rows;
  }

  static async create(subscription: Partial<Subscription> & { merchant_id: string, start_time: Date, next_payment_time: Date }, client?: PoolClient): Promise<Subscription> {
    const db = client || dbPool;
    const query = `
      INSERT INTO subscriptions (
        subscription_id_on_chain, user_id, plan_id, merchant_id, status, start_time, next_payment_time
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [
      subscription.subscription_id_on_chain || null,
      subscription.user_id,
      subscription.plan_id,
      subscription.merchant_id,
      subscription.status || 'active',
      subscription.start_time,
      subscription.next_payment_time
    ];
    const result = await db.query<Subscription>(query, values);
    return result.rows[0] as Subscription;
  }

  static async updateStatus(id: string, status: string, client?: PoolClient): Promise<Subscription | null> {
    const db = client || dbPool;
    const query = `
      UPDATE subscriptions
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await db.query<Subscription>(query, [status, id]);
    return result.rows[0] || null;
  }
}
