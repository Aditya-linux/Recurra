/**
 * Recurra — Analytics Routes (Dedicated)
 * GET /api/v1/analytics/revenue-chart — Revenue data points over time
 * GET /api/v1/analytics/subscriber-growth — Subscriber count over time
 * GET /api/v1/analytics/payment-breakdown — Success/fail/pending counts
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { analyticsSchema } from '../../utils/validation.js';
import { dbPool } from '../../database/index.js';
import fs from 'fs';
import path from 'path';

export const analyticsRoutes = Router();

// All analytics routes require merchant authentication
analyticsRoutes.use(authenticate, requireRole('merchant', 'admin'));

/**
 * Helper to get the merchant ID from the authenticated user
 */
async function getMerchantId(req: Request, res: Response): Promise<string | null> {
  const result = await dbPool.query('SELECT id FROM merchants WHERE wallet_address = $1', [req.user!.walletAddress]);
  if (result.rowCount === 0) {
    res.status(403).json({ error: 'Merchant not found' });
    return null;
  }
  return result.rows[0].id;
}

/**
 * GET /api/v1/analytics/revenue-chart — Daily revenue data points
 */
analyticsRoutes.get('/revenue-chart', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = analyticsSchema.parse(req.query);
    const merchantId = await getMerchantId(req, res);
    if (!merchantId) return;



    const periodMap: Record<string, { interval: string; trunc: string; points: number }> = {
      day: { interval: '24 hours', trunc: 'hour', points: 24 },
      week: { interval: '7 days', trunc: 'day', points: 7 },
      month: { interval: '30 days', trunc: 'day', points: 30 },
      quarter: { interval: '90 days', trunc: 'week', points: 13 },
      year: { interval: '365 days', trunc: 'month', points: 12 },
    };
    const config = periodMap[input.period] || periodMap.month;
    if (!config) return;

    const result = await dbPool.query(
      `SELECT 
        DATE_TRUNC($1, p.executed_at) AS period_start,
        COALESCE(SUM(p.amount), 0)::bigint AS revenue,
        COUNT(*)::int AS payment_count
      FROM payments p
      JOIN subscriptions s ON p.subscription_id = s.id
      WHERE s.merchant_id = $2
        AND p.status = 'completed'
        AND p.executed_at >= NOW() - $3::interval
      GROUP BY period_start
      ORDER BY period_start ASC`,
      [config.trunc, merchantId, config.interval]
    );

    // Format the data points
    const dataPoints = result.rows.map((row: any) => ({
      date: new Date(row.period_start).toISOString(),
      label: formatLabel(new Date(row.period_start), config.trunc),
      revenue: Number(row.revenue),
      revenueFormatted: `$${(Number(row.revenue) / 10000000).toFixed(2)}`,
      paymentCount: row.payment_count,
    }));

    res.json({
      period: input.period,
      granularity: config.trunc,
      data: dataPoints,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/analytics/subscriber-growth — Subscriber count over time
 */
analyticsRoutes.get('/subscriber-growth', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = analyticsSchema.parse(req.query);
    const merchantId = await getMerchantId(req, res);
    if (!merchantId) return;



    const periodMap: Record<string, { interval: string; trunc: string }> = {
      day: { interval: '24 hours', trunc: 'hour' },
      week: { interval: '7 days', trunc: 'day' },
      month: { interval: '30 days', trunc: 'day' },
      quarter: { interval: '90 days', trunc: 'week' },
      year: { interval: '365 days', trunc: 'month' },
    };
    const config = periodMap[input.period] || periodMap.month;
    if (!config) return;

    // New subscriptions over time
    const newSubsResult = await dbPool.query(
      `SELECT 
        DATE_TRUNC($1, s.created_at) AS period_start,
        COUNT(*)::int AS new_subscribers
      FROM subscriptions s
      WHERE s.merchant_id = $2
        AND s.created_at >= NOW() - $3::interval
      GROUP BY period_start
      ORDER BY period_start ASC`,
      [config.trunc, merchantId, config.interval]
    );

    // Cancellations over time
    const cancelResult = await dbPool.query(
      `SELECT 
        DATE_TRUNC($1, s.updated_at) AS period_start,
        COUNT(*)::int AS cancelled
      FROM subscriptions s
      WHERE s.merchant_id = $2
        AND s.status IN ('cancelled', 'inactive')
        AND s.updated_at >= NOW() - $3::interval
      GROUP BY period_start
      ORDER BY period_start ASC`,
      [config.trunc, merchantId, config.interval]
    );

    // Current total active
    const activeResult = await dbPool.query(
      `SELECT COUNT(*)::int AS total FROM subscriptions WHERE merchant_id = $1 AND status = 'active'`,
      [merchantId]
    );

    res.json({
      period: input.period,
      granularity: config.trunc,
      totalActive: activeResult.rows[0].total,
      newSubscribers: newSubsResult.rows.map((row: any) => ({
        date: new Date(row.period_start).toISOString(),
        label: formatLabel(new Date(row.period_start), config.trunc),
        count: row.new_subscribers,
      })),
      cancellations: cancelResult.rows.map((row: any) => ({
        date: new Date(row.period_start).toISOString(),
        label: formatLabel(new Date(row.period_start), config.trunc),
        count: row.cancelled,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/analytics/payment-breakdown — Payment status breakdown
 */
analyticsRoutes.get('/payment-breakdown', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = analyticsSchema.parse(req.query);
    const merchantId = await getMerchantId(req, res);
    if (!merchantId) return;



    const periodMap: Record<string, string> = {
      day: '1 day', week: '7 days', month: '30 days',
      quarter: '90 days', year: '365 days',
    };
    const interval = periodMap[input.period] || '30 days';

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

    const result = await dbPool.query(
      `SELECT 
        p.status,
        COUNT(*)::int AS count,
        COALESCE(SUM(p.amount), 0)::bigint AS total_amount
      FROM payments p
      JOIN subscriptions s ON p.subscription_id = s.id
      WHERE s.merchant_id = $1
        AND p.created_at >= NOW() - $2::interval
      GROUP BY p.status
      ORDER BY count DESC`,
      [merchantId, interval]
    );

    const breakdown = result.rows.map((row: any) => ({
      status: row.status,
      count: row.count,
      totalAmount: Number(row.total_amount),
      totalAmountFormatted: `$${(Number(row.total_amount) / 10000000).toFixed(2)}`,
    }));

    // Calculate totals
    const totalPayments = breakdown.reduce((sum: number, b: any) => sum + b.count, 0);
    const successRate = totalPayments > 0
      ? ((breakdown.find((b: any) => b.status === 'completed')?.count || 0) / totalPayments * 100).toFixed(1)
      : '0.0';

    // Top plans by revenue
    const topPlansResult = await dbPool.query(
      `SELECT 
        pl.name,
        COUNT(p.id)::int AS payment_count,
        COALESCE(SUM(p.amount), 0)::bigint AS total_revenue
      FROM payments p
      JOIN subscriptions s ON p.subscription_id = s.id
      JOIN plans pl ON s.plan_id = pl.id
      WHERE s.merchant_id = $1
        AND p.status = 'completed'
        AND p.created_at >= NOW() - $2::interval
      GROUP BY pl.name
      ORDER BY total_revenue DESC
      LIMIT 5`,
      [merchantId, interval]
    );

    res.json({
      period: input.period,
      breakdown,
      totalPayments,
      totalRevenue,
      successRate: parseFloat(successRate as string),
      topPlans: topPlansResult.rows.map((row: any) => ({
        name: row.name,
        paymentCount: row.payment_count,
        revenue: Number(row.total_revenue),
        revenueFormatted: `$${(Number(row.total_revenue) / 10000000).toFixed(2)}`,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/analytics/platform — Global platform stats
 */
analyticsRoutes.get('/platform', async (_req: Request, res: Response, next: NextFunction) => {
  try {

    
    const subsResult = await dbPool.query(`SELECT COUNT(*)::int as total FROM subscriptions`);
    const activeSubsResult = await dbPool.query(`SELECT COUNT(*)::int as total FROM subscriptions WHERE status = 'active'`);
    const volumeResult = await dbPool.query(`SELECT COALESCE(SUM(amount), 0)::bigint as total_volume, COUNT(*)::int as tx_count FROM payments WHERE status = 'completed'`);

    const totalVolume = Number(volumeResult.rows[0].total_volume);
    const platformFee = Math.floor(totalVolume * 0.005); // 0.5%

    res.json({
      totalSubscriptions: subsResult.rows[0].total,
      activeSubscriptions: activeSubsResult.rows[0].total,
      totalTransactions: volumeResult.rows[0].tx_count,
      totalVolume,
      totalVolumeFormatted: `$${(totalVolume / 10000000).toFixed(2)}`,
      platformFee,
      platformFeeFormatted: `$${(platformFee / 10000000).toFixed(2)}`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/analytics/export-users — Unified CSV export
 */
analyticsRoutes.get('/export-users', async (_req: Request, res: Response, next: NextFunction) => {
  try {

    
    // 1. Fetch Users & Subscriptions
    const usersResult = await dbPool.query(`
      SELECT u.wallet_address, u.email, COUNT(s.id)::int as active_subs 
      FROM users u 
      LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
      GROUP BY u.id
    `);

    // 2. Fetch Merchants & Plans
    const merchantsResult = await dbPool.query(`
      SELECT m.wallet_address, m.business_email as email, COUNT(p.id)::int as plans_created 
      FROM merchants m
      LEFT JOIN plans p ON p.merchant_id = m.id
      GROUP BY m.id
    `);

    // 3. Read Feedback
    const feedbackMap: Record<string, string> = {};
    try {
      const feedbackPath = path.join(process.cwd(), 'feedback.csv');
      if (fs.existsSync(feedbackPath)) {
        const fileContent = fs.readFileSync(feedbackPath, 'utf-8');
        const lines = fileContent.split('\n').slice(1); // skip header
        for (const line of lines) {
          if (!line.trim()) continue;
          // Format: Date,Name,Email,Address,Transactions,Type,Message
          const parts = line.split(',');
          if (parts.length >= 7) {
            const wallet = parts[3]?.replace(/"/g, '').trim() || '';
            const message = parts.slice(6).join(',').replace(/"/g, '').trim();
            if (wallet && wallet !== 'N/A') {
              feedbackMap[wallet] = message;
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to parse feedback.csv', e);
    }

    // 4. Generate CSV
    let csvString = 'Wallet Address,Role,Email,Actions Done,General Feedback\n';

    // Helper to escape CSV strings
    const escapeCSV = (str: string | null | undefined) => {
      if (!str) return '';
      const safeStr = String(str);
      return safeStr.includes(',') || safeStr.includes('"') || safeStr.includes('\n') 
        ? `"${safeStr.replace(/"/g, '""')}"` 
        : safeStr;
    };

    // Users
    for (const u of usersResult.rows) {
      const feedback = feedbackMap[u.wallet_address] || '';
      csvString += `${u.wallet_address},User,${escapeCSV(u.email)},${u.active_subs} active subscriptions,${escapeCSV(feedback)}\n`;
    }

    // Merchants
    for (const m of merchantsResult.rows) {
      const feedback = feedbackMap[m.wallet_address] || '';
      csvString += `${m.wallet_address},Merchant,${escapeCSV(m.email)},${m.plans_created} plans created,${escapeCSV(feedback)}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="platform_data.csv"');
    res.send(csvString);

  } catch (err) {
    next(err);
  }
});

/**
 * Format a date label based on granularity
 */
function formatLabel(date: Date, trunc: string): string {
  switch (trunc) {
    case 'hour':
      return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
    case 'day':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    case 'week':
      return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    case 'month':
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    default:
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
