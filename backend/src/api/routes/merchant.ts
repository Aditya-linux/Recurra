/**
 * Recurra — Merchant Routes
 * POST /api/v1/merchant/register — Merchant onboarding
 * POST /api/v1/merchant/plans — Create plan
 * GET  /api/v1/merchant/plans — List merchant plans
 * GET  /api/v1/merchant/analytics — Revenue dashboard
 * GET  /api/v1/merchant/subscribers — Subscriber list
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import {
  registerMerchantSchema,
  createPlanSchema,
  analyticsSchema,
  paginationSchema,
  updateMerchantSettingsSchema,
} from '../../utils/validation.js';
import { logger } from '../../utils/logger.js';

export const merchantRoutes = Router();

/**
 * POST /api/v1/merchant/register — Public (auth required)
 */
merchantRoutes.post('/register', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = registerMerchantSchema.parse(req.body);
    const { dbPool } = await import('../../database/index.js');
    
    // Check if merchant already exists
    const existing = await dbPool.query('SELECT id FROM merchants WHERE wallet_address = $1', [input.walletAddress]);
    if (existing.rowCount && existing.rowCount > 0) {
      res.status(400).json({ error: 'Wallet address already registered as merchant' });
      return;
    }

    // Create merchant record in database
    const result = await dbPool.query(
      `INSERT INTO merchants (wallet_address, business_name, business_url, kyc_status, platform_url, platform_name, platform_logo_url, redirect_url_template) 
       VALUES ($1, $2, $3, 'approved', $4, $5, $6, $7) RETURNING *`,
      [input.walletAddress, input.businessName, input.businessUrl || null,
       input.platformUrl || null, input.platformName || null,
       input.platformLogoUrl || null, input.redirectUrlTemplate || null]
    );

    const merchant = result.rows[0];

    // Generate upgraded API Token with merchant role
    const { generateAccessToken, generateRefreshToken } = await import('../../middleware/auth.js');
    const accessToken = generateAccessToken({
      userId: req.user!.userId,
      walletAddress: input.walletAddress,
      role: 'merchant',
    });

    const refreshToken = generateRefreshToken({
      userId: req.user!.userId,
      walletAddress: input.walletAddress,
    });

    logger.info('Merchant registered', { walletAddress: input.walletAddress });

    res.status(201).json({
      message: 'Merchant registered successfully',
      accessToken,
      refreshToken,
      merchant,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/merchant/plans — Create subscription plan
 */
merchantRoutes.post('/plans', authenticate, requireRole('merchant', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createPlanSchema.parse(req.body);
    const { dbPool } = await import('../../database/index.js');

    // Get merchant ID
    const merchantResult = await dbPool.query('SELECT id FROM merchants WHERE wallet_address = $1', [req.user!.walletAddress]);
    if (merchantResult.rowCount === 0) {
      res.status(403).json({ error: 'Merchant not found' });
      return;
    }
    const merchantId = merchantResult.rows[0].id;

    // Generate a mock plan_id_on_chain for now until smart contract deployment is integrated
    const planIdOnChain = `PLAN_${Date.now()}`;

    // Insert plan in database
    const result = await dbPool.query(
      `INSERT INTO plans (plan_id_on_chain, merchant_id, name, description, amount, token_address, interval_seconds, max_payments, redirect_url, redirect_label)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [planIdOnChain, merchantId, input.name, input.description || null, input.amount, input.tokenAddress, input.intervalSeconds, input.maxPayments || 0,
       input.redirectUrl || null, input.redirectLabel || 'Go to Platform']
    );

    const plan = result.rows[0];

    logger.info('Plan created', { name: input.name, amount: input.amount });

    res.status(201).json({
      message: 'Plan created successfully',
      plan,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/merchant/plans — List merchant's plans
 */
merchantRoutes.get('/plans', authenticate, requireRole('merchant', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = paginationSchema.parse(req.query);
    const { dbPool } = await import('../../database/index.js');

    // Get merchant ID from wallet
    const merchantResult = await dbPool.query('SELECT id FROM merchants WHERE wallet_address = $1', [req.user!.walletAddress]);
    if (merchantResult.rowCount === 0) {
      res.status(403).json({ error: 'Merchant not found' });
      return;
    }
    const merchantId = merchantResult.rows[0].id;

    // Count total plans for pagination
    const countResult = await dbPool.query(
      'SELECT COUNT(*)::int AS total FROM plans WHERE merchant_id = $1',
      [merchantId]
    );
    const total = countResult.rows[0].total;

    // Fetch plans with pagination
    const offset = (pagination.page - 1) * pagination.limit;
    const plansResult = await dbPool.query(
      `SELECT id, plan_id_on_chain, name, description, amount, token_address,
              interval_seconds, max_payments, is_active, subscriber_count,
              created_at, updated_at
       FROM plans
       WHERE merchant_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [merchantId, pagination.limit, offset]
    );

    res.json({
      data: plansResult.rows,
      pagination: { ...pagination, total },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/merchant/settings — Update merchant platform settings
 */
merchantRoutes.put('/settings', authenticate, requireRole('merchant', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateMerchantSettingsSchema.parse(req.body);
    const { dbPool } = await import('../../database/index.js');

    // Get merchant ID
    const merchantResult = await dbPool.query('SELECT id FROM merchants WHERE wallet_address = $1', [req.user!.walletAddress]);
    if (merchantResult.rowCount === 0) {
      res.status(403).json({ error: 'Merchant not found' });
      return;
    }
    const merchantId = merchantResult.rows[0].id;

    // Build dynamic update query
    const fieldMap: Record<string, string> = {
      businessName: 'business_name',
      businessUrl: 'business_url',
      platformUrl: 'platform_url',
      platformName: 'platform_name',
      platformLogoUrl: 'platform_logo_url',
      redirectUrlTemplate: 'redirect_url_template',
    };

    const setClauses: string[] = [];
    const values: any[] = [];
    let argCounter = 1;

    for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
      if ((input as any)[jsKey] !== undefined) {
        setClauses.push(`${dbCol} = $${argCounter}`);
        values.push((input as any)[jsKey]);
        argCounter++;
      }
    }

    if (setClauses.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    values.push(merchantId);
    const result = await dbPool.query(
      `UPDATE merchants SET ${setClauses.join(', ')} WHERE id = $${argCounter} RETURNING *`,
      values
    );

    logger.info('Merchant settings updated', { merchantId });

    res.json({
      message: 'Settings updated successfully',
      merchant: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/merchant/analytics — Revenue dashboard
 */
merchantRoutes.get('/analytics', authenticate, requireRole('merchant', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = analyticsSchema.parse(req.query);
    const { dbPool } = await import('../../database/index.js');

    // Get merchant ID
    const merchantResult = await dbPool.query('SELECT id FROM merchants WHERE wallet_address = $1', [req.user!.walletAddress]);
    if (merchantResult.rowCount === 0) {
      res.status(403).json({ error: 'Merchant not found' });
      return;
    }
    const merchantId = merchantResult.rows[0].id;

    // Calculate the date range based on period
    const periodMap: Record<string, string> = {
      day: '1 day',
      week: '7 days',
      month: '30 days',
      quarter: '90 days',
      year: '365 days',
    };
    const interval = periodMap[input.period] || '30 days';

    // Active subscribers count
    const activeSubsResult = await dbPool.query(
      `SELECT COUNT(*)::int AS count FROM subscriptions
       WHERE merchant_id = $1 AND status = 'active'`,
      [merchantId]
    );
    const activeSubscribers = activeSubsResult.rows[0].count;

    // New subscribers in the period
    const newSubsResult = await dbPool.query(
      `SELECT COUNT(*)::int AS count FROM subscriptions
       WHERE merchant_id = $1 AND created_at >= NOW() - $2::interval`,
      [merchantId, interval]
    );
    const newSubscribers = newSubsResult.rows[0].count;

    // Cancelled subscriptions in the period
    const cancelledResult = await dbPool.query(
      `SELECT COUNT(*)::int AS count FROM subscriptions
       WHERE merchant_id = $1 AND status IN ('cancelled', 'inactive')
       AND updated_at >= NOW() - $2::interval`,
      [merchantId, interval]
    );
    const cancelledSubscriptions = cancelledResult.rows[0].count;

    // Total revenue from completed payments in the period
    const revenueResult = await dbPool.query(
      `SELECT COALESCE(SUM(p.amount), 0)::bigint AS total
       FROM payments p
       JOIN subscriptions s ON p.subscription_id = s.id
       WHERE s.merchant_id = $1
         AND p.status = 'completed'
         AND p.executed_at >= NOW() - $2::interval`,
      [merchantId, interval]
    );
    const totalRevenue = Number(revenueResult.rows[0].total);

    // MRR = sum of (amount / interval_seconds * seconds_in_month) for active subscriptions
    const mrrResult = await dbPool.query(
      `SELECT COALESCE(SUM(
         (pl.amount::numeric / pl.interval_seconds) * 2592000
       ), 0)::bigint AS mrr
       FROM subscriptions s
       JOIN plans pl ON s.plan_id = pl.id
       WHERE s.merchant_id = $1 AND s.status = 'active'`,
      [merchantId]
    );
    const mrr = Number(mrrResult.rows[0].mrr);

    // Churn rate = cancelled / (active + cancelled) * 100 in the period
    const totalInPeriod = activeSubscribers + cancelledSubscriptions;
    const churnRate = totalInPeriod > 0
      ? parseFloat(((cancelledSubscriptions / totalInPeriod) * 100).toFixed(2))
      : 0;

    res.json({
      period: input.period,
      mrr,
      totalRevenue,
      activeSubscribers,
      churnRate,
      newSubscribers,
      cancelledSubscriptions,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/merchant/subscribers — List subscribers
 */
merchantRoutes.get('/subscribers', authenticate, requireRole('merchant', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = paginationSchema.parse(req.query);
    const { dbPool } = await import('../../database/index.js');

    // Get merchant ID
    const merchantResult = await dbPool.query('SELECT id FROM merchants WHERE wallet_address = $1', [req.user!.walletAddress]);
    if (merchantResult.rowCount === 0) {
      res.status(403).json({ error: 'Merchant not found' });
      return;
    }
    const merchantId = merchantResult.rows[0].id;

    // Count total subscribers
    const countResult = await dbPool.query(
      `SELECT COUNT(DISTINCT s.user_id)::int AS total
       FROM subscriptions s
       WHERE s.merchant_id = $1`,
      [merchantId]
    );
    const total = countResult.rows[0].total;

    // Fetch subscribers with subscription + plan details
    const offset = (pagination.page - 1) * pagination.limit;
    const subsResult = await dbPool.query(
      `SELECT
         u.id AS user_id, u.wallet_address, u.email, u.name,
         s.id AS subscription_id, s.status, s.start_time, s.next_payment_time,
         s.payments_made,
         pl.name AS plan_name, pl.amount AS plan_amount, pl.token_address
       FROM subscriptions s
       JOIN users u ON s.user_id = u.id
       JOIN plans pl ON s.plan_id = pl.id
       WHERE s.merchant_id = $1
       ORDER BY s.created_at DESC
       LIMIT $2 OFFSET $3`,
      [merchantId, pagination.limit, offset]
    );

    res.json({
      data: subsResult.rows,
      pagination: { ...pagination, total },
    });
  } catch (err) {
    next(err);
  }
});
