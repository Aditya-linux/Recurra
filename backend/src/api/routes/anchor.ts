import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { AnchorService } from '../../services/AnchorService.js';
import { CurrencyService } from '../../services/CurrencyService.js';
import { logger } from '../../utils/logger.js';

export const anchorRoutes = Router();

/**
 * GET /api/v1/anchor/rates
 * Get current exchange rates
 */
anchorRoutes.get('/rates', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rates = await CurrencyService.getExchangeRates();
    res.json({ rates });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/anchor/convert
 * Convert amount between currencies
 */
anchorRoutes.post('/convert', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount, from, to } = req.body;
    if (!amount || !from || !to) {
      res.status(400).json({ error: 'amount, from, and to are required' });
      return;
    }

    const converted = await CurrencyService.convert(Number(amount), from, to);
    res.json({ converted, from, to, originalAmount: amount });
  } catch (err) {
    next(err);
  }
});
