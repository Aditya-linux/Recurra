import { Queue, Worker, Job } from 'bullmq';
import crypto from 'crypto';
import fetch from 'node-fetch'; // native fetch in Node 18+ or polyfill
import { redisClient } from '../utils/redis.js';
import { dbPool } from '../database/index.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export interface WebhookPayload {
  eventId: string;
  eventType: 'subscription.created' | 'payment.executed' | 'payment.failed' | 'subscription.cancelled' | 'subscription.expired';
  timestamp: string;
  data: any;
}

export interface WebhookJobData {
  endpointId: string;
  merchantId: string;
  url: string;
  secret: string;
  payload: WebhookPayload;
}

const WEBHOOK_QUEUE_NAME = 'webhook-delivery-queue';

export const webhookQueue = new Queue<WebhookJobData>(WEBHOOK_QUEUE_NAME, {
  connection: redisClient,
  defaultJobOptions: {
    attempts: config.webhook.maxRetries,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export class WebhookDeliveryService {
  private worker: Worker;

  constructor() {
    this.worker = new Worker<WebhookJobData>(
      WEBHOOK_QUEUE_NAME,
      async (job) => {
        await this.processWebhook(job);
      },
      {
        connection: redisClient,
        concurrency: 10,
      }
    );

    this.worker.on('completed', (job) => {
      logger.debug(`Webhook job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      logger.error(`Webhook job ${job?.id} failed`, { error: err.message });
      if (job) {
        this.handleJobFailure(job, err).catch(e => logger.error('Error handling webhook failure', { error: e.message }));
      }
    });
  }

  static async dispatch(merchantId: string, eventType: WebhookPayload['eventType'], data: any) {
    // Look up active endpoints for this merchant that subscribe to this event
    const client = await dbPool.connect();
    try {
      const result = await client.query(
        `SELECT id, url, secret FROM webhook_endpoints 
         WHERE merchant_id = $1 AND is_active = true AND $2 = ANY(events)`,
        [merchantId, eventType]
      );

      for (const row of result.rows) {
        const payload: WebhookPayload = {
          eventId: crypto.randomUUID(),
          eventType,
          timestamp: new Date().toISOString(),
          data
        };

        await webhookQueue.add('deliver-webhook', {
          endpointId: row.id,
          merchantId,
          url: row.url,
          secret: row.secret,
          payload
        });
      }
    } finally {
      client.release();
    }
  }

  private async processWebhook(job: Job<WebhookJobData>) {
    const { endpointId, url, secret, payload } = job.data;
    
    // Circuit Breaker check
    const failuresKey = `webhook:failures:${endpointId}`;
    const failures = parseInt(await redisClient.get(failuresKey) || '0', 10);
    
    if (failures >= config.webhook.circuitBreakerThreshold) {
      // Disable endpoint
      await dbPool.query('UPDATE webhook_endpoints SET is_active = false WHERE id = $1', [endpointId]);
      logger.warn(`Webhook endpoint ${endpointId} circuit breaker tripped. Endpoint disabled.`);
      throw new Error('Circuit breaker tripped');
    }

    const payloadString = JSON.stringify(payload);
    const signature = this.signPayload(payloadString, secret);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    let responseStatus: number = 0;
    let responseBody: string = '';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Recurra-Signature': signature,
          'Recurra-Event-Id': payload.eventId,
          'Recurra-Timestamp': payload.timestamp,
        },
        body: payloadString,
        signal: controller.signal as any
      });

      responseStatus = response.status;
      responseBody = await response.text().then(t => t.substring(0, 1000)).catch(() => '');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Success! Reset failure count
      await redisClient.del(failuresKey);
      await this.logDelivery(endpointId, payload.eventType, payload, responseStatus, responseBody, job.attemptsMade + 1);

    } catch (error) {
      // Log failure in deliveries
      await this.logDelivery(
        endpointId, 
        payload.eventType, 
        payload, 
        responseStatus, 
        error instanceof Error ? error.message : String(error), 
        job.attemptsMade + 1
      );
      throw error; // Let BullMQ handle retry
    } finally {
      clearTimeout(timeout);
    }
  }

  private async handleJobFailure(job: Job<WebhookJobData>, _error: Error) {
    const { endpointId } = job.data;
    const failuresKey = `webhook:failures:${endpointId}`;
    
    // Increment failure count
    await redisClient.incr(failuresKey);
    // Set expiry to 24 hours so intermittent failures don't permanently brick unless they happen close together
    await redisClient.expire(failuresKey, 86400); 

    await dbPool.query(
      'UPDATE webhook_endpoints SET failure_count = failure_count + 1, last_delivery_status = $1, last_delivery_at = NOW() WHERE id = $2',
      ['failed', endpointId]
    );
  }

  private signPayload(payloadString: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payloadString);
    return `sha256=${hmac.digest('hex')}`;
  }

  private async logDelivery(
    endpointId: string, 
    eventType: string, 
    payload: any, 
    status: number, 
    responseBody: string,
    attempt: number
  ) {
    await dbPool.query(
      `INSERT INTO webhook_deliveries 
      (webhook_endpoint_id, event_type, payload, response_status, response_body, attempt_number, delivered_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [endpointId, eventType, JSON.stringify(payload), status || null, responseBody, attempt]
    );

    if (status >= 200 && status < 300) {
      await dbPool.query(
        'UPDATE webhook_endpoints SET last_delivery_status = $1, last_delivery_at = NOW(), failure_count = 0 WHERE id = $2',
        ['success', endpointId]
      );
    }
  }

  async close() {
    await this.worker.close();
  }
}
