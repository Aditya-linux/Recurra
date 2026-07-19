import { Router } from 'express';
import { dbPool } from '../../database/index.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { ReceiptService } from '../../services/ReceiptService.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

const router = Router();

// GET /api/v1/payments/history — Payment history for authenticated user
router.get('/history', authenticate, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { status } = req.query;
    const pageNum = parseInt(req.query.page as string || '1', 10);
    const limitNum = parseInt(req.query.limit as string || '20', 10);
    const offset = (pageNum - 1) * limitNum;

    let query = `
      SELECT p.id, p.transaction_hash, p.amount, p.token_address,
             p.payment_number, p.status, p.executed_at,
             pl.name AS plan_name, m.business_name AS merchant_name
      FROM payments p
      JOIN subscriptions s ON p.subscription_id = s.id
      JOIN plans pl ON s.plan_id = pl.id
      JOIN merchants m ON s.merchant_id = m.id
      WHERE p.from_address = $1
    `;
    const values: any[] = [userId];

    if (status) {
      query += ` AND p.status = $2`;
      values.push(status);
    }

    query += ` ORDER BY p.executed_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(limitNum, offset);

    const result = await dbPool.query(query, values);

    // Total count
    let countQuery = `
      SELECT COUNT(*) AS total FROM payments p
      JOIN subscriptions s ON p.subscription_id = s.id
      WHERE p.from_address = $1
    `;
    const countValues: any[] = [userId];
    if (status) {
      countQuery += ` AND p.status = $2`;
      countValues.push(status);
    }
    const countResult = await dbPool.query(countQuery, countValues);
    const total = parseInt(countResult.rows[0].total, 10);

    res.json({
      data: result.rows,
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    logger.error('Failed to fetch payment history', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/payments/:id/receipt — Receipt data for a payment
router.get('/:id/receipt', authenticate, async (req, res): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.userId;

    const checkResult = await dbPool.query('SELECT from_address FROM payments WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: 'Payment not found or unauthorized' });
      return;
    }
    if (checkResult.rows[0].from_address !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const receiptData = await ReceiptService.getReceiptData(id);
    if (!receiptData) {
      res.status(400).json({ error: 'Receipt not available for failed/pending payments' });
      return;
    }

    res.json({ data: receiptData });
  } catch (error) {
    logger.error('Failed to fetch receipt', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/payments/treasury — Treasury wallet summary (admin only)
router.get('/treasury', authenticate, requireRole('admin'), async (_req, res): Promise<void> => {
  try {
    // Total accumulated fees
    const totalResult = await dbPool.query(
      `SELECT COALESCE(SUM(fee_amount), 0)::bigint AS total_fees,
              COUNT(*)::int AS total_transactions
       FROM treasury_transactions`
    );
    const { total_fees, total_transactions } = totalResult.rows[0];

    // Daily breakdown (last 30 days)
    const dailyResult = await dbPool.query(
      `SELECT DATE_TRUNC('day', created_at) AS day,
              COALESCE(SUM(fee_amount), 0)::bigint AS fees,
              COUNT(*)::int AS tx_count
       FROM treasury_transactions
       WHERE created_at >= NOW() - INTERVAL '30 days'
       GROUP BY day
       ORDER BY day DESC`
    );

    // Recent transactions (last 20)
    const recentResult = await dbPool.query(
      `SELECT t.id, t.fee_amount, t.token_address, t.transaction_hash,
              t.treasury_wallet, t.created_at,
              pl.name AS plan_name
       FROM treasury_transactions t
       JOIN subscriptions s ON t.subscription_id = s.id
       JOIN plans pl ON s.plan_id = pl.id
       ORDER BY t.created_at DESC
       LIMIT 20`
    );

    res.json({
      treasury: {
        walletAddress: config.stellar.platformFeeWallet,
        feeBps: config.platform.feeBps,
        feePercent: `${config.platform.feeBps / 100}%`,
        totalFeesCollected: Number(total_fees),
        totalFeesFormatted: `$${(Number(total_fees) / 10_000_000).toFixed(2)}`,
        totalTransactions: total_transactions,
      },
      dailyBreakdown: dailyResult.rows.map((row: any) => ({
        date: new Date(row.day).toISOString().split('T')[0],
        fees: Number(row.fees),
        feesFormatted: `$${(Number(row.fees) / 10_000_000).toFixed(2)}`,
        transactionCount: row.tx_count,
      })),
      recentTransactions: recentResult.rows.map((row: any) => ({
        id: row.id,
        feeAmount: Number(row.fee_amount),
        feeFormatted: `$${(Number(row.fee_amount) / 10_000_000).toFixed(4)}`,
        tokenAddress: row.token_address,
        transactionHash: row.transaction_hash,
        planName: row.plan_name,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    logger.error('Failed to fetch treasury data', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
