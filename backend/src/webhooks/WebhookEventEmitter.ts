import { EventEmitter } from 'events';
import { WebhookDeliveryService } from './WebhookDeliveryService.js';
import { logger } from '../utils/logger.js';

/**
 * Central Event Bus for triggering webhooks across the application.
 * Services emit events here instead of tightly coupling to WebhookDeliveryService.
 */
class WebhookEventEmitter extends EventEmitter {
  constructor() {
    super();

    // Register event listeners for core business events

    this.on('subscription.created', async (data: { merchantId: string, subscriptionId: string, payload: any }) => {
      await this.dispatch(data.merchantId, 'subscription.created', data.payload);
    });

    this.on('payment.executed', async (data: { merchantId: string, paymentId: string, payload: any }) => {
      await this.dispatch(data.merchantId, 'payment.executed', data.payload);
    });

    this.on('payment.failed', async (data: { merchantId: string, paymentId: string, payload: any }) => {
      await this.dispatch(data.merchantId, 'payment.failed', data.payload);
    });

    this.on('subscription.cancelled', async (data: { merchantId: string, subscriptionId: string, payload: any }) => {
      await this.dispatch(data.merchantId, 'subscription.cancelled', data.payload);
    });

    this.on('subscription.expired', async (data: { merchantId: string, subscriptionId: string, payload: any }) => {
      await this.dispatch(data.merchantId, 'subscription.expired', data.payload);
    });
  }

  private async dispatch(merchantId: string, eventType: any, payload: any) {
    try {
      await WebhookDeliveryService.dispatch(merchantId, eventType, payload);
    } catch (error: any) {
      logger.error('Failed to dispatch webhook event', {
        eventType,
        merchantId,
        error: error.message
      });
    }
  }
}

// Export a singleton instance
export const webhookBus = new WebhookEventEmitter();
