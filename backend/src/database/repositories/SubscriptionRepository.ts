import { dbPool } from '../index.js';
import { PoolClient } from 'pg';

export interface Subscription {
  id: string;
  subscription_id_on_chain: string | null;
  user_id: string;
  plan_id: string;
  status: 'active' | 'inactive' | 'paused' | 'cancelled' | 'trialing' | 'expired' | 'past_due';
  trial_end_time: Date | null;
  discount_code_id: string | null;
  next_payment_time: Date;
  merchant_id: string;
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
        s.id, s.status, s.subscription_id_on_chain, s.next_payment_time, s.trial_end_time, s.discount_code_id,
        p.name, p.amount, p.token_address, p.interval_seconds, p.tier, p.trial_days,
        p.redirect_url, p.redirect_label,
        m.platform_url, m.platform_name, m.platform_logo_url, m.redirect_url_template,
        m.business_name as merchant_name, m.logo_url
      FROM subscriptions s
      JOIN plans p ON s.plan_id = p.id
      JOIN merchants m ON s.merchant_id = m.id
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
        subscription_id_on_chain, user_id, plan_id, merchant_id, status, start_time, next_payment_time, trial_end_time, discount_code_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const values = [
      subscription.subscription_id_on_chain || null,
      subscription.user_id,
      subscription.plan_id,
      subscription.merchant_id,
      subscription.status || 'active',
      subscription.start_time,
      subscription.next_payment_time,
      subscription.trial_end_time || null,
      subscription.discount_code_id || null
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

  static async findTrialsEndingSoon(daysAhead: number, client?: PoolClient): Promise<any[]> {
    const db = client || dbPool;
    const query = `
      SELECT s.*, p.name as plan_name, u.email as user_email
      FROM subscriptions s
      JOIN plans p ON s.plan_id = p.id
      JOIN users u ON s.user_id = u.id
      WHERE s.status = 'trialing'
      AND s.trial_end_time IS NOT NULL
      AND s.trial_end_time <= NOW() + interval '1 day' * $1
      AND s.trial_end_time > NOW()
    `;
    const result = await db.query(query, [daysAhead]);
    return result.rows;
  }

  static async findDueForRenewalReminder(daysAhead: number, client?: PoolClient): Promise<any[]> {
    const db = client || dbPool;
    const query = `
      SELECT s.*, p.name as plan_name, p.amount, u.email as user_email
      FROM subscriptions s
      JOIN plans p ON s.plan_id = p.id
      JOIN users u ON s.user_id = u.id
      WHERE s.status = 'active'
      AND s.next_payment_time IS NOT NULL
      AND s.next_payment_time <= NOW() + interval '1 day' * $1
      AND s.next_payment_time > NOW()
    `;
    const result = await db.query(query, [daysAhead]);
    return result.rows;
  }

  static async transitionTrialToActive(id: string, nextPaymentTime: Date, client?: PoolClient): Promise<Subscription | null> {
    const db = client || dbPool;
    const query = `
      UPDATE subscriptions
      SET status = 'active', next_payment_time = $1, updated_at = NOW()
      WHERE id = $2 AND status = 'trialing'
      RETURNING *
    `;
    const result = await db.query<Subscription>(query, [nextPaymentTime, id]);
    return result.rows[0] || null;
  }
}
