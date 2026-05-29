/**
 * Demo Merchant Backend (Mock external server)
 * 
 * Simulates an external merchant like "Acme Streaming" receiving a webhook from Recurra.
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger.js';
import { RecurraMerchantSdk } from '../../utils/merchantSdk.js';

export const demoMerchantRoutes = Router();

// In-memory mock database of user subscription status
// Key: Wallet address, Value: boolean (is subscribed)
const merchantDb: Record<string, boolean> = {};

// Hardcoded mock secret for the demo
const DEMO_WEBHOOK_SECRET = 'demo_secret_123';

/**
 * Webhook receiver (simulating Acme Streaming's server)
 * POST /api/v1/demo-merchant/webhook
 */
demoMerchantRoutes.post('/webhook', (req: Request, res: Response) => {
  // 1. Get raw payload string (for express, we assume bodyParser json is used. 
  // In production, we'd need raw body for accurate HMAC. For this MVP, JSON.stringify works fine since we control both ends).
  const rawPayload = JSON.stringify(req.body);
  const signature = req.headers['recurra-signature'] as string;

  // 2. Verify Signature
  if (!RecurraMerchantSdk.verifyWebhookSignature(rawPayload, signature, DEMO_WEBHOOK_SECRET)) {
    logger.warn('Demo Merchant: Rejected webhook due to invalid or missing signature');
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  logger.info('Demo Merchant received verified webhook:', req.body);
  
  const { eventType, data } = req.body;
  
  if (eventType === 'subscription.created' || eventType === 'payment.executed') {
    // We expect the payload data to include the user's wallet address or ID
    // For simplicity, we just look at the subscription data
    const userId = data.user_id; // In a real app, this would map to their local user ID
    if (userId) {
      merchantDb[userId] = true;
      logger.info(`Demo Merchant: Activated subscription for user ${userId}`);
    }
  }

  res.status(200).send('OK');
});

/**
 * Status endpoint for frontend to check if account is active
 * GET /api/v1/demo-merchant/status/:userId
 */
demoMerchantRoutes.get('/status/:userId', (req: Request, res: Response) => {
  const userId = req.params.userId;
  if (!userId) {
    res.json({ isActive: false });
    return;
  }
  const isActive = merchantDb[userId] || false;
  res.json({ isActive });
});

/**
 * Reset endpoint for testing
 */
demoMerchantRoutes.post('/reset', (_req: Request, res: Response) => {
  for (const key in merchantDb) delete merchantDb[key];
  res.json({ message: 'Merchant DB reset' });
});
