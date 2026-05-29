import { Router, Request, Response, NextFunction } from 'express';
import { dbPool } from '../../database/index.js';
import { logger } from '../../utils/logger.js';

export const plansRoutes = Router();

/**
 * GET /api/v1/plans — List all active plans globally
 */
plansRoutes.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const query = `
      SELECT p.id, p.plan_id_on_chain, p.name as plan_name, p.amount, p.interval_seconds, p.token_address,
             m.business_name as merchant_name, m.logo_url
      FROM plans p
      JOIN merchants m ON p.merchant_id = m.id
      WHERE p.is_active = true
      ORDER BY m.business_name, p.amount
    `;
    const result = await dbPool.query(query);
    
    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching plans', { error });
    next(error);
  }
});
