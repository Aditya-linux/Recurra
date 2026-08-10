/**
 * Recurra — Webhook Routes
 * POST /api/v1/webhooks — Configure webhook endpoint
 * GET  /api/v1/webhooks — List webhook endpoints
 * DELETE /api/v1/webhooks/:id — Remove webhook endpoint
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { createWebhookSchema } from '../../utils/validation.js';
import { logger } from '../../utils/logger.js';
import crypto from 'crypto';

import { webhookRateLimiter } from '../../middleware/rateLimiter.js';

export const webhookRoutes = Router();

// Strict rate limiting for webhook creation/deletion/testing
webhookRoutes.use(webhookRateLimiter);

// All webhook routes require merchant auth
webhookRoutes.use(authenticate);
webhookRoutes.use(requireRole('merchant', 'admin'));

/**
 * POST /api/v1/webhooks — Create webhook endpoint
 */
webhookRoutes.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createWebhookSchema.parse(req.body);

    // Generate HMAC signing secret for this webhook
    const signingSecret = crypto.randomBytes(32).toString('hex');
    const { dbPool } = await import('../../database/index.js');

    // Get merchant ID
    const merchantResult = await dbPool.query('SELECT id FROM merchants WHERE wallet_address = $1', [req.user!.walletAddress]);
    if (merchantResult.rowCount === 0) {
      res.status(403).json({ error: 'Merchant not found' });
      return;
    }
    const merchantId = merchantResult.rows[0].id;

    // Store webhook endpoint in database
    const result = await dbPool.query(
      `INSERT INTO webhook_endpoints (merchant_id, url, secret, events)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [merchantId, input.url, signingSecret, input.events]
    );

    const webhook = result.rows[0];

    logger.info('Webhook endpoint created', {
      merchantId: req.user!.userId,
      url: input.url,
      events: input.events,
    });

    res.status(201).json({
      message: 'Webhook endpoint created',
      webhook: {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        // Return secret only once — merchant must store it
        signingSecret,
        isActive: webhook.is_active,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/webhooks — List webhook endpoints
 */
webhookRoutes.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dbPool } = await import('../../database/index.js');
    const merchantResult = await dbPool.query('SELECT id FROM merchants WHERE wallet_address = $1', [req.user!.walletAddress]);
    if (merchantResult.rowCount === 0) {
      res.status(403).json({ error: 'Merchant not found' });
      return;
    }
    const merchantId = merchantResult.rows[0].id;

    const result = await dbPool.query('SELECT id, url, events, is_active, created_at FROM webhook_endpoints WHERE merchant_id = $1', [merchantId]);

    res.json({
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/webhooks/:id — Remove webhook endpoint
 */
webhookRoutes.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { dbPool } = await import('../../database/index.js');

    // Get merchant ID
    const merchantResult = await dbPool.query('SELECT id FROM merchants WHERE wallet_address = $1', [req.user!.walletAddress]);
    if (merchantResult.rowCount === 0) {
      res.status(403).json({ error: 'Merchant not found' });
      return;
    }
    const merchantId = merchantResult.rows[0].id;

    // Verify merchant owns this webhook before deleting
    const webhookResult = await dbPool.query(
      'SELECT id FROM webhook_endpoints WHERE id = $1 AND merchant_id = $2',
      [id, merchantId]
    );
    if (webhookResult.rowCount === 0) {
      res.status(404).json({ error: 'Webhook endpoint not found or not owned by you' });
      return;
    }

    // Delete associated delivery logs first, then the endpoint
    await dbPool.query('DELETE FROM webhook_deliveries WHERE webhook_endpoint_id = $1', [id]);
    await dbPool.query('DELETE FROM webhook_endpoints WHERE id = $1', [id]);

    logger.info('Webhook endpoint removed', { webhookId: id, merchantId });

    res.json({ message: 'Webhook endpoint removed successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/webhooks/:id/test — Send test ping event
 */
webhookRoutes.post('/:id/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { dbPool } = await import('../../database/index.js');

    // Get merchant ID
    const merchantResult = await dbPool.query('SELECT id FROM merchants WHERE wallet_address = $1', [req.user!.walletAddress]);
    if (merchantResult.rowCount === 0) {
      res.status(403).json({ error: 'Merchant not found' });
      return;
    }
    const merchantId = merchantResult.rows[0].id;

    // Fetch the webhook endpoint (including secret for signing)
    const webhookResult = await dbPool.query(
      'SELECT id, url, secret, events, is_active FROM webhook_endpoints WHERE id = $1 AND merchant_id = $2',
      [id, merchantId]
    );
    if (webhookResult.rowCount === 0) {
      res.status(404).json({ error: 'Webhook endpoint not found or not owned by you' });
      return;
    }

    const webhook = webhookResult.rows[0];
    if (!webhook.is_active) {
      res.status(400).json({ error: 'Webhook endpoint is inactive' });
      return;
    }

    // Build test ping payload
    const testPayload = JSON.stringify({
      eventType: 'ping',
      data: {
        message: 'This is a test webhook from Recurra',
        webhookId: webhook.id,
        timestamp: new Date().toISOString(),
      },
    });

    // Sign the payload with HMAC
    const { RecurraMerchantSdk } = await import('../../utils/merchantSdk.js');
    const signature = RecurraMerchantSdk.signPayload(testPayload, webhook.secret);

    // Send the test webhook
    let deliveryStatus = 'success';
    let responseStatus = 0;
    let responseBody = '';

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Recurra-Signature': signature,
          'X-Recurra-Event': 'ping',
        },
        body: testPayload,
        signal: AbortSignal.timeout(10000), // 10s timeout
      });
      responseStatus = response.status;
      responseBody = await response.text();

      if (!response.ok) {
        deliveryStatus = 'failed';
      }
    } catch (fetchError: any) {
      deliveryStatus = 'failed';
      responseBody = fetchError.message || 'Connection failed';
    }

    // Record delivery in webhook_deliveries audit log
    await dbPool.query(
      `INSERT INTO webhook_deliveries (webhook_endpoint_id, event_type, payload, response_status, response_body, delivered_at)
       VALUES ($1, 'ping', $2::jsonb, $3, $4, NOW())`,
      [id, testPayload, responseStatus || null, responseBody]
    );

    logger.info('Test webhook sent', { webhookId: id, url: webhook.url, deliveryStatus });

    res.json({
      message: deliveryStatus === 'success' ? 'Test webhook delivered successfully' : 'Test webhook delivery failed',
      status: deliveryStatus,
      responseStatus,
      responseBody: responseBody.substring(0, 500), // Truncate long responses
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/webhooks/:id — Update webhook endpoint
 */
webhookRoutes.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { url, events, is_active } = req.body;
    const { dbPool } = await import('../../database/index.js');

    const merchantResult = await dbPool.query('SELECT id FROM merchants WHERE wallet_address = $1', [req.user!.walletAddress]);
    if (merchantResult.rowCount === 0) { res.status(403).json({ error: 'Merchant not found' }); return; }
    const merchantId = merchantResult.rows[0].id;

    const result = await dbPool.query(
      `UPDATE webhook_endpoints 
       SET url = COALESCE($1, url), events = COALESCE($2, events), is_active = COALESCE($3, is_active), updated_at = NOW()
       WHERE id = $4 AND merchant_id = $5 RETURNING id, url, events, is_active`,
      [url, events, is_active, id, merchantId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Webhook endpoint not found' });
      return;
    }

    res.json({ message: 'Webhook endpoint updated', webhook: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/webhooks/:id/rotate-secret — Rotate webhook signing secret
 */
webhookRoutes.post('/:id/rotate-secret', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const newSecret = crypto.randomBytes(32).toString('hex');
    const { dbPool } = await import('../../database/index.js');

    const merchantResult = await dbPool.query('SELECT id FROM merchants WHERE wallet_address = $1', [req.user!.walletAddress]);
    if (merchantResult.rowCount === 0) { res.status(403).json({ error: 'Merchant not found' }); return; }
    const merchantId = merchantResult.rows[0].id;

    const result = await dbPool.query(
      'UPDATE webhook_endpoints SET secret = $1, updated_at = NOW() WHERE id = $2 AND merchant_id = $3 RETURNING id',
      [newSecret, id, merchantId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Webhook endpoint not found' });
      return;
    }

    logger.info('Webhook secret rotated', { webhookId: id, merchantId });

    res.json({ message: 'Secret rotated successfully', signingSecret: newSecret });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/webhooks/:id/logs — Get delivery logs for a webhook endpoint
 */
webhookRoutes.get('/:id/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const { dbPool } = await import('../../database/index.js');

    const merchantResult = await dbPool.query('SELECT id FROM merchants WHERE wallet_address = $1', [req.user!.walletAddress]);
    if (merchantResult.rowCount === 0) { res.status(403).json({ error: 'Merchant not found' }); return; }
    const merchantId = merchantResult.rows[0].id;

    // Verify ownership
    const endpointCheck = await dbPool.query('SELECT id FROM webhook_endpoints WHERE id = $1 AND merchant_id = $2', [id, merchantId]);
    if (endpointCheck.rowCount === 0) { res.status(404).json({ error: 'Webhook endpoint not found' }); return; }

    const countResult = await dbPool.query('SELECT COUNT(*)::int AS total FROM webhook_deliveries WHERE webhook_endpoint_id = $1', [id]);
    const total = countResult.rows[0].total;

    const logsResult = await dbPool.query(
      `SELECT id, event_type, payload, response_status, response_body, attempt_number, delivered_at 
       FROM webhook_deliveries 
       WHERE webhook_endpoint_id = $1 
       ORDER BY delivered_at DESC LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    res.json({
      data: logsResult.rows,
      pagination: { page, limit, total }
    });
  } catch (err) {
    next(err);
  }
});
