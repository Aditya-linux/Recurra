import { dbPool } from '../index.js';
import { PoolClient } from 'pg';

export interface DiscountCode {
  id: string;
  merchant_id: string;
  code: string;
  description: string | null;
  discount_percent: number | null;
  discount_amount: string | number | null; // BIGINT
  max_uses: number;
  used_count: number;
  valid_from: Date;
  valid_until: Date | null;
  is_active: boolean;
  applies_to_first_payment_only: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DiscountRedemption {
  id: string;
  discount_code_id: string;
  subscription_id: string;
  user_id: string;
  original_amount: string | number;
  discounted_amount: string | number;
  savings: string | number;
  redeemed_at: Date;
}

export class DiscountCodeRepository {
  static async findById(id: string, client?: PoolClient): Promise<DiscountCode | null> {
    const db = client || dbPool;
    const result = await db.query<DiscountCode>('SELECT * FROM discount_codes WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async findByCode(code: string, merchantId: string, client?: PoolClient): Promise<DiscountCode | null> {
    const db = client || dbPool;
    const result = await db.query<DiscountCode>(
      'SELECT * FROM discount_codes WHERE UPPER(code) = UPPER($1) AND merchant_id = $2',
      [code, merchantId]
    );
    return result.rows[0] || null;
  }

  static async findByMerchantId(merchantId: string, client?: PoolClient): Promise<DiscountCode[]> {
    const db = client || dbPool;
    const result = await db.query<DiscountCode>(
      'SELECT * FROM discount_codes WHERE merchant_id = $1 ORDER BY created_at DESC',
      [merchantId]
    );
    return result.rows;
  }

  static async create(code: Partial<DiscountCode>, client?: PoolClient): Promise<DiscountCode> {
    const db = client || dbPool;
    const query = `
      INSERT INTO discount_codes (
        merchant_id, code, description, discount_percent, discount_amount,
        max_uses, valid_from, valid_until, is_active, applies_to_first_payment_only
      )
      VALUES ($1, UPPER($2), $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const values = [
      code.merchant_id, code.code, code.description || null,
      code.discount_percent || null, code.discount_amount || null,
      code.max_uses || 0, code.valid_from || new Date(),
      code.valid_until || null, code.is_active ?? true,
      code.applies_to_first_payment_only ?? true
    ];
    const result = await db.query<DiscountCode>(query, values);
    return result.rows[0] as DiscountCode;
  }

  static async update(id: string, updates: Partial<DiscountCode>, client?: PoolClient): Promise<DiscountCode | null> {
    const db = client || dbPool;

    const setClauses: string[] = [];
    const values: any[] = [];
    let argCounter = 1;

    const allowedFields = [
      'description', 'discount_percent', 'discount_amount', 'max_uses',
      'valid_from', 'valid_until', 'is_active', 'applies_to_first_payment_only'
    ];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = $${argCounter}`);
        values.push(value);
        argCounter++;
      }
    }

    if (setClauses.length === 0) return this.findById(id, client);

    values.push(id);
    const query = `
      UPDATE discount_codes SET ${setClauses.join(', ')}
      WHERE id = $${argCounter}
      RETURNING *
    `;
    const result = await db.query<DiscountCode>(query, values);
    return result.rows[0] || null;
  }

  static async deactivate(id: string, merchantId: string, client?: PoolClient): Promise<boolean> {
    const db = client || dbPool;
    const result = await db.query(
      'UPDATE discount_codes SET is_active = false WHERE id = $1 AND merchant_id = $2',
      [id, merchantId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  static async incrementUsage(id: string, client?: PoolClient): Promise<void> {
    const db = client || dbPool;
    await db.query(
      'UPDATE discount_codes SET used_count = used_count + 1 WHERE id = $1',
      [id]
    );
  }

  /**
   * Validate a discount code: check active, not expired, not maxed out
   */
  static async isValid(code: string, merchantId: string, client?: PoolClient): Promise<{ valid: boolean; reason?: string; discountCode?: DiscountCode }> {
    const discountCode = await this.findByCode(code, merchantId, client);

    if (!discountCode) {
      return { valid: false, reason: 'Discount code not found' };
    }
    if (!discountCode.is_active) {
      return { valid: false, reason: 'Discount code is no longer active' };
    }
    if (discountCode.valid_until && new Date(discountCode.valid_until) < new Date()) {
      return { valid: false, reason: 'Discount code has expired' };
    }
    if (discountCode.valid_from && new Date(discountCode.valid_from) > new Date()) {
      return { valid: false, reason: 'Discount code is not yet valid' };
    }
    if (discountCode.max_uses > 0 && discountCode.used_count >= discountCode.max_uses) {
      return { valid: false, reason: 'Discount code has reached its maximum uses' };
    }

    return { valid: true, discountCode };
  }

  /**
   * Record a discount redemption
   */
  static async recordRedemption(
    discountCodeId: string,
    subscriptionId: string,
    userId: string,
    originalAmount: number,
    discountedAmount: number,
    client?: PoolClient
  ): Promise<DiscountRedemption> {
    const db = client || dbPool;
    const savings = originalAmount - discountedAmount;
    const query = `
      INSERT INTO discount_redemptions (discount_code_id, subscription_id, user_id, original_amount, discounted_amount, savings)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await db.query<DiscountRedemption>(query, [
      discountCodeId, subscriptionId, userId, originalAmount, discountedAmount, savings
    ]);

    // Increment the usage counter
    await this.incrementUsage(discountCodeId, client);

    return result.rows[0] as DiscountRedemption;
  }

  /**
   * Check if a user has already redeemed a specific code
   */
  static async hasUserRedeemed(userId: string, discountCodeId: string, client?: PoolClient): Promise<boolean> {
    const db = client || dbPool;
    const result = await db.query(
      'SELECT 1 FROM discount_redemptions WHERE user_id = $1 AND discount_code_id = $2 LIMIT 1',
      [userId, discountCodeId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get redemption stats for a merchant's discount codes
   */
  static async getRedemptionStats(merchantId: string, client?: PoolClient): Promise<any[]> {
    const db = client || dbPool;
    const result = await db.query(
      `SELECT 
        dc.id, dc.code, dc.discount_percent, dc.discount_amount,
        dc.max_uses, dc.used_count, dc.is_active, dc.valid_until,
        COALESCE(SUM(dr.savings), 0)::bigint AS total_savings,
        COUNT(dr.id)::int AS total_redemptions
      FROM discount_codes dc
      LEFT JOIN discount_redemptions dr ON dr.discount_code_id = dc.id
      WHERE dc.merchant_id = $1
      GROUP BY dc.id
      ORDER BY dc.created_at DESC`,
      [merchantId]
    );
    return result.rows;
  }
}
