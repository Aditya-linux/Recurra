import { Router } from 'express';
import { dbPool } from '../../database/index.js';
import { authenticate } from '../../middleware/auth.js';
import { ReceiptService } from '../../services/ReceiptService.js';
import { logger } from '../../utils/logger.js';

const router = Router();

// GET /api/v1/payments/history - Get payment history for a user
router.get('/history', authenticate, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { page = '1', limit = '20', status } = req.query;
    
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let query = `
      SELECT 
        p.id, p.transaction_hash, p.amount, p.token_address, p.payment_number, p.status, p.executed_at,
        pl.name as plan_name,
        m.business_name as merchant_name
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
    values.push(parseInt(limit as string), offset);

    const result = await dbPool.query(query, values);
    
    // Total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM payments p
      JOIN subscriptions s ON p.subscription_id = s.id
      WHERE p.from_address = $1
    `;
    const countValues: any[] = [userId];
    if (status) {
      countQuery += ` AND p.status = $2`;
      countValues.push(status);
    }
    const countResult = await dbPool.query(countQuery, countValues);
    const total = parseInt(countResult.rows[0].total);

    res.json({
      data: result.rows,
      meta: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    logger.error('Failed to fetch payment history', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/payments/:id/receipt - Get receipt data
router.get('/:id/receipt', authenticate, async (req, res): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.userId;

    // Verify ownership
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

export default router;
