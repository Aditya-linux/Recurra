/**
 * Recurra — User Routes
 * GET /api/v1/user/subscriptions — List user subscriptions
 * GET /api/v1/user/payments — Payment history
 * GET /api/v1/user/profile — User profile
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { subscriptionFilterSchema, paymentFilterSchema } from '../../utils/validation.js';

export const userRoutes = Router();

// All user routes require authentication
userRoutes.use(authenticate);

/**
 * GET /api/v1/user/subscriptions
 */
userRoutes.get('/subscriptions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = subscriptionFilterSchema.parse(req.query);
    const { dbPool } = await import('../../database/index.js');

    // Build dynamic WHERE clauses
    const conditions: string[] = ['s.user_id = $1'];
    const values: any[] = [req.user!.userId];
    let paramIndex = 2;

    if (filters.status) {
      conditions.push(`s.status = $${paramIndex}`);
      values.push(filters.status);
      paramIndex++;
    }

    if (filters.merchantId) {
      conditions.push(`s.merchant_id = $${paramIndex}`);
      values.push(filters.merchantId);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Count total for pagination
    const countResult = await dbPool.query(
      `SELECT COUNT(*)::int AS total FROM subscriptions s WHERE ${whereClause}`,
      values
    );
    const total = countResult.rows[0].total;

    // Fetch subscriptions with plan + merchant details
    const offset = (filters.page - 1) * filters.limit;
    const subsResult = await dbPool.query(
      `SELECT
         s.id, s.subscription_id_on_chain, s.status, s.start_time,
         s.next_payment_time, s.payments_made, s.grace_period_end,
         s.cancellation_reason, s.created_at,
         pl.name AS name, pl.amount, pl.token_address,
         pl.interval_seconds, pl.max_payments,
         m.business_name AS merchant_name, m.wallet_address AS merchant_wallet
       FROM subscriptions s
       JOIN plans pl ON s.plan_id = pl.id
       JOIN merchants m ON s.merchant_id = m.id
       WHERE ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, filters.limit, offset]
    );

    res.json({
      data: subsResult.rows,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/user/payments
 */
userRoutes.get('/payments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = paymentFilterSchema.parse(req.query);
    const { dbPool } = await import('../../database/index.js');

    // Build dynamic WHERE clauses
    const conditions: string[] = ['s.user_id = $1'];
    const values: any[] = [req.user!.userId];
    let paramIndex = 2;

    if (filters.status) {
      conditions.push(`p.status = $${paramIndex}`);
      values.push(filters.status);
      paramIndex++;
    }

    if (filters.subscriptionId) {
      conditions.push(`p.subscription_id = $${paramIndex}`);
      values.push(filters.subscriptionId);
      paramIndex++;
    }

    if (filters.fromDate) {
      conditions.push(`p.executed_at >= $${paramIndex}`);
      values.push(filters.fromDate);
      paramIndex++;
    }

    if (filters.toDate) {
      conditions.push(`p.executed_at <= $${paramIndex}`);
      values.push(filters.toDate);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Count total for pagination
    const countResult = await dbPool.query(
      `SELECT COUNT(*)::int AS total
       FROM payments p
       JOIN subscriptions s ON p.subscription_id = s.id
       WHERE ${whereClause}`,
      values
    );
    const total = countResult.rows[0].total;

    // Fetch payments with subscription + plan details
    const offset = (filters.page - 1) * filters.limit;
    const paymentsResult = await dbPool.query(
      `SELECT
         p.id, p.transaction_hash, p.amount, p.fee_amount, p.token_address,
         p.from_address, p.to_address, p.payment_number, p.status,
         p.failure_reason, p.executed_at, p.created_at,
         pl.name AS plan_name,
         m.business_name AS merchant_name
       FROM payments p
       JOIN subscriptions s ON p.subscription_id = s.id
       JOIN plans pl ON s.plan_id = pl.id
       JOIN merchants m ON s.merchant_id = m.id
       WHERE ${whereClause}
       ORDER BY p.executed_at DESC NULLS LAST, p.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, filters.limit, offset]
    );

    res.json({
      data: paymentsResult.rows,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/user/profile
 */
userRoutes.get('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dbPool } = await import('../../database/index.js');

    // Fetch full user profile from database
    const userResult = await dbPool.query(
      `SELECT id, wallet_address, email, name, c_address, is_active, created_at, last_login
       FROM users WHERE id = $1`,
      [req.user!.userId]
    );

    if (userResult.rowCount === 0) {
      // Fallback to JWT data if user not found (shouldn't happen)
      res.json({
        id: req.user!.userId,
        walletAddress: req.user!.walletAddress,
        role: req.user!.role,
      });
      return;
    }

    const user = userResult.rows[0];

    // Check if merchant for role
    const merchantResult = await dbPool.query(
      'SELECT id, business_name FROM merchants WHERE wallet_address = $1',
      [req.user!.walletAddress]
    );
    const isMerchant = merchantResult.rowCount! > 0;

    res.json({
      id: user.id,
      walletAddress: user.wallet_address,
      email: user.email,
      name: user.name,
      cAddress: user.c_address,
      role: req.user!.role,
      isActive: user.is_active,
      createdAt: user.created_at,
      lastLogin: user.last_login,
      ...(isMerchant && {
        merchant: {
          id: merchantResult.rows[0].id,
          businessName: merchantResult.rows[0].business_name,
        },
      }),
    });
  } catch (err) {
    next(err);
  }
});
