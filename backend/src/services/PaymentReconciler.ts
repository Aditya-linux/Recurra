/**
 * Payment Reconciler — Catches payments stuck in 'pending' state
 *
 * When the keeper submits a Soroban transaction but internet drops before
 * confirmation, the payment stays 'pending' in the DB. This service:
 *   1. Finds payments stuck in 'pending' for >5 minutes
 *   2. Checks Stellar RPC for the tx hash status
 *   3. If confirmed on-chain → updates to 'completed'
 *   4. If not found / failed → updates to 'failed' for keeper retry
 */

import cron from 'node-cron';
import { dbPool } from '../database/index.js';
import { logger } from '../utils/logger.js';
import { getHealthyRPC } from '../utils/rpcFailover.js';
import { config } from '../config/index.js';
import * as Sentry from '@sentry/node';

const PENDING_THRESHOLD_MINUTES = 5;

export class PaymentReconciler {
  private cronJob: cron.ScheduledTask | null = null;

  start(): void {
    // Run every 5 minutes
    this.cronJob = cron.schedule('*/5 * * * *', () => {
      this.reconcilePendingPayments().catch(err =>
        logger.error('Reconciler tick failed', { error: (err as Error).message })
      );
    });
    logger.info('Payment reconciler started (checks every 5 minutes)');
  }

  stop(): void {
    this.cronJob?.stop();
    this.cronJob = null;
  }

  private async reconcilePendingPayments(): Promise<void> {
    try {
      // Find payments stuck in 'pending' for more than the threshold
      const result = await dbPool.query(
        `SELECT id, transaction_hash, subscription_id, payment_number, amount, token_address
         FROM payments
         WHERE status = 'pending'
         AND created_at < NOW() - INTERVAL '${PENDING_THRESHOLD_MINUTES} minutes'
         ORDER BY created_at ASC
         LIMIT 50`
      );

      if (result.rows.length === 0) {
        logger.debug('Reconciler: No stuck pending payments ✓');
        return;
      }

      logger.info(`Reconciler: Found ${result.rows.length} stuck pending payments`);
      let reconciled = 0;
      let failed = 0;

      for (const payment of result.rows) {
        try {
          if (payment.transaction_hash) {
            // Has a tx hash — check if it was confirmed on-chain
            const confirmed = await this.checkOnChainStatus(payment.transaction_hash);

            if (confirmed) {
              // Transaction succeeded on-chain — mark completed
              await dbPool.query(
                `UPDATE payments SET status = 'completed', executed_at = NOW() WHERE id = $1`,
                [payment.id]
              );

              // Also advance the subscription
              await dbPool.query(
                `UPDATE subscriptions
                 SET next_payment_time = next_payment_time + (interval_seconds * INTERVAL '1 second'),
                     payments_made = payments_made + 1
                 WHERE id = $1`,
                [payment.subscription_id]
              );

              // Record treasury fee
              const feeAmount = Math.floor(Number(payment.amount) * config.platform.feeBps / 10000);
              await dbPool.query(
                `INSERT INTO treasury_transactions (payment_id, subscription_id, fee_amount, token_address, transaction_hash, treasury_wallet)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT DO NOTHING`,
                [payment.id, payment.subscription_id, feeAmount, payment.token_address, payment.transaction_hash, config.stellar.platformFeeWallet]
              ).catch(() => {}); // Ignore if table doesn't exist yet

              reconciled++;
              logger.info(`Reconciler: Payment ${payment.id} confirmed on-chain, marked completed`);
            } else {
              // Transaction failed on-chain — mark failed for retry
              await dbPool.query(
                `UPDATE payments SET status = 'failed', failure_reason = 'Transaction failed on-chain (reconciled)' WHERE id = $1`,
                [payment.id]
              );
              failed++;
              logger.warn(`Reconciler: Payment ${payment.id} failed on-chain, marked for retry`);
            }
          } else {
            // No tx hash — submission never completed. Mark as failed for retry.
            await dbPool.query(
              `UPDATE payments SET status = 'failed', failure_reason = 'No transaction hash (internet dropped before submission)' WHERE id = $1`,
              [payment.id]
            );
            failed++;
          }
        } catch (err) {
          logger.error(`Reconciler: Error processing payment ${payment.id}`, {
            error: (err as Error).message,
          });
        }
      }

      if (reconciled > 0 || failed > 0) {
        const msg = `Reconciler: ${reconciled} confirmed, ${failed} marked failed out of ${result.rows.length} pending`;
        logger.info(msg);

        if (failed > 5) {
          Sentry.captureMessage(`Reconciler: High failure rate — ${failed} payments failed`, {
            level: 'warning',
            extra: { reconciled, failed, total: result.rows.length },
          });
        }
      }
    } catch (err) {
      logger.error('Reconciler check failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async checkOnChainStatus(txHash: string): Promise<boolean> {
    try {
      const server = await getHealthyRPC();
      const txResponse = await server.getTransaction(txHash);
      return txResponse.status === 'SUCCESS';
    } catch {
      return false; // If RPC is down, assume not confirmed — will retry next cycle
    }
  }
}

export const paymentReconciler = new PaymentReconciler();
