/**
 * Payment Watchdog — Independent monitor for missed payments
 *
 * Runs on a separate schedule from the keeper.
 * Detects overdue payments and fires alerts.
 * Does NOT process payments — only monitors.
 */

import cron from 'node-cron';
import { dbPool } from '../database/index.js';
import { logger } from '../utils/logger.js';
import * as Sentry from '@sentry/node';

const OVERDUE_THRESHOLD_HOURS = 2;

export class PaymentWatchdog {
  private cronJob: cron.ScheduledTask | null = null;

  start(): void {
    // Run every 15 minutes
    this.cronJob = cron.schedule('*/15 * * * *', () => {
      this.checkForOverduePayments().catch(err =>
        logger.error('Watchdog tick failed', { error: (err as Error).message })
      );
    });
    logger.info('Payment watchdog started (checks every 15 minutes)');
  }

  stop(): void {
    this.cronJob?.stop();
    this.cronJob = null;
  }

  private async checkForOverduePayments(): Promise<void> {
    try {
      const result = await dbPool.query(
        `SELECT id, subscription_id_on_chain, merchant_id, user_id,
                next_payment_time, status,
                EXTRACT(EPOCH FROM (NOW() - next_payment_time)) / 3600 AS hours_overdue
         FROM subscriptions
         WHERE next_payment_time < NOW() - INTERVAL '${OVERDUE_THRESHOLD_HOURS} hours'
         AND status IN ('active', 'past_due')
         ORDER BY next_payment_time ASC
         LIMIT 100`
      );

      if (result.rows.length === 0) {
        logger.debug('Watchdog: No overdue payments detected ✓');
        return;
      }

      const overdueCount = result.rows.length;
      const alertMsg = `WATCHDOG ALERT: ${overdueCount} payments overdue by >${OVERDUE_THRESHOLD_HOURS}h`;

      logger.error(alertMsg, {
        overdueCount,
        oldestOverdue: `${Number(result.rows[0]?.hours_overdue).toFixed(1)} hours`,
        subscriptionIds: result.rows.slice(0, 5).map((r: any) => r.subscription_id_on_chain),
      });

      // Report to Sentry as critical
      Sentry.captureMessage(alertMsg, {
        level: 'fatal',
        extra: { overdueCount, samples: result.rows.slice(0, 10) },
      });

      // Mark severely overdue active subscriptions as past_due
      for (const sub of result.rows) {
        if (sub.status === 'active' && Number(sub.hours_overdue) > 24) {
          await dbPool.query(
            `UPDATE subscriptions SET status = 'past_due' WHERE id = $1 AND status = 'active'`,
            [sub.id]
          );
          logger.warn(`Watchdog: Marked ${sub.subscription_id_on_chain} as past_due (overdue ${Number(sub.hours_overdue).toFixed(0)}h)`);
        }
      }
    } catch (err) {
      logger.error('Watchdog check failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export const paymentWatchdog = new PaymentWatchdog();
