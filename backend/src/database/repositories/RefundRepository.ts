import { dbPool } from '../index.js';
import { PoolClient } from 'pg';

export interface Refund {
  id: string;
  subscription_id: string;
  payment_id: string | null;
  user_id: string;
  merchant_id: string;
  refund_amount: string | number;
  token_address: string;
  refund_tx_hash: string | null;
  reason: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  days_used: number | null;
  days_total: number | null;
  processed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export class RefundRepository {
  static async findById(id: string, client?: PoolClient): Promise<Refund | null> {
    const db = client || dbPool;
    const result = await db.query<Refund>('SELECT * FROM refunds WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async findBySubscriptionId(subscriptionId: string, client?: PoolClient): Promise<Refund[]> {
    const db = client || dbPool;
    const result = await db.query<Refund>(
      'SELECT * FROM refunds WHERE subscription_id = $1 ORDER BY created_at DESC',
      [subscriptionId]
    );
    return result.rows;
  }

  static async findByUserId(userId: string, client?: PoolClient): Promise<Refund[]> {
    const db = client || dbPool;
    const result = await db.query<Refund>(
      'SELECT * FROM refunds WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }

  static async findByMerchantId(merchantId: string, client?: PoolClient): Promise<Refund[]> {
    const db = client || dbPool;
    const result = await db.query<Refund>(
      'SELECT * FROM refunds WHERE merchant_id = $1 ORDER BY created_at DESC',
      [merchantId]
    );
    return result.rows;
  }

  static async create(refund: Partial<Refund>, client?: PoolClient): Promise<Refund> {
    const db = client || dbPool;
    const query = `
      INSERT INTO refunds (
        subscription_id, payment_id, user_id, merchant_id, refund_amount,
        token_address, reason, status, days_used, days_total
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const values = [
      refund.subscription_id, refund.payment_id || null, refund.user_id,
      refund.merchant_id, refund.refund_amount, refund.token_address,
      refund.reason || null, refund.status || 'pending',
      refund.days_used || null, refund.days_total || null
    ];
    const result = await db.query<Refund>(query, values);
    return result.rows[0] as Refund;
  }

  static async updateStatus(
    id: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    refundTxHash?: string,
    client?: PoolClient
  ): Promise<Refund | null> {
    const db = client || dbPool;
    const processedAt = status === 'completed' ? new Date() : null;
    
    let query = `
      UPDATE refunds
      SET status = $1, updated_at = NOW()
    `;
    const values: any[] = [status];
    let argCounter = 2;

    if (processedAt) {
      query += `, processed_at = $${argCounter}`;
      values.push(processedAt);
      argCounter++;
    }

    if (refundTxHash !== undefined) {
      query += `, refund_tx_hash = $${argCounter}`;
      values.push(refundTxHash);
      argCounter++;
    }

    query += ` WHERE id = $${argCounter} RETURNING *`;
    values.push(id);

    const result = await db.query<Refund>(query, values);
    return result.rows[0] || null;
  }
}
