/**
 * Recurra — Keeper Service
 * 
 * Automated payment trigger that scans for due subscriptions
 * and executes payments via the Payment Engine smart contract.
 * 
 * Architecture: Scheduler (node-cron) → Queue (BullMQ + Redis) → Workers
 * 
 * @security
 * - Keeper private key stored in KMS (never in code)
 * - Key rotation every 30 days
 * - Multi-keeper whitelist
 * - Spending limit on keeper account
 * - Duplicate prevention via idempotency keys
 */

import cron from 'node-cron';
import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { RedisLock } from '../utils/redisLock.js';
import { transactionBatcher } from './TransactionBatcher.js';

// ============================================================
// TYPES
// ============================================================

interface PaymentJob {
  subscriptionId: string;
  userId: string;
  merchantId: string;
  amount: number;
  tokenAddress: string;
  paymentNumber: number;
  attemptNumber: number;
}

interface KeeperStats {
  jobsProcessed: number;
  jobsFailed: number;
  jobsWaiting: number;
  lastRunAt: Date | null;
  totalVolumeProcessed: number;
}

// ============================================================
// KEEPER SERVICE CLASS
// ============================================================

export class KeeperService {
  private queue: Queue<PaymentJob>;
  private worker: Worker<PaymentJob> | null = null;
  private cronJob: cron.ScheduledTask | null = null;
  private stats: KeeperStats = {
    jobsProcessed: 0,
    jobsFailed: 0,
    jobsWaiting: 0,
    lastRunAt: null,
    totalVolumeProcessed: 0,
  };

  constructor() {
    // Initialize BullMQ queue with Redis
    this.queue = new Queue<PaymentJob>('recurra-payments', {
      connection: {
        url: config.redis.url,
      },
      defaultJobOptions: {
        attempts: config.keeper.maxRetryAttempts,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5s, 25s, 125s
        },
        removeOnComplete: {
          count: 1000, // Keep last 1000 completed jobs
          age: 86400,  // Remove after 24 hours
        },
        removeOnFail: {
          count: 5000, // Keep last 5000 failed jobs for debugging
          age: 604800, // Remove after 7 days
        },
      },
    });

    logger.info('Keeper service queue initialized');
  }

  /**
   * Start the keeper service — scheduler + worker
   */
  async start(): Promise<void> {
    // Start worker(s)
    this.startWorker();

    // Start cron scheduler
    this.startScheduler();

    // Start monitoring
    this.startMonitoring();

    logger.info('Keeper service started', {
      schedule: config.keeper.cronSchedule,
      workers: config.keeper.maxConcurrentWorkers,
    });
  }

  /**
   * Stop the keeper service gracefully
   */
  async stop(): Promise<void> {
    logger.info('Stopping keeper service...');

    if (this.cronJob) {
      this.cronJob.stop();
    }

    if (this.worker) {
      await this.worker.close();
    }

    await this.queue.close();
    logger.info('Keeper service stopped');
  }

  /**
   * Hourly scheduler — scans for due payments
   */
  private startScheduler(): void {
    this.cronJob = cron.schedule(config.keeper.cronSchedule, async () => {
      try {
        logger.info('Keeper scan started');
        await this.scanDuePayments();
        this.stats.lastRunAt = new Date();
      } catch (err) {
        logger.error('Keeper scan failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  /**
   * Scan database for subscriptions with due payments
   */
  private async scanDuePayments(): Promise<void> {
    const lock = new RedisLock('keeper:scan_due_payments', 120); // 2 minute lock
    const acquired = await lock.acquire();

    if (!acquired) {
      logger.debug('Keeper scan already in progress by another instance. Skipping.');
      return;
    }

    try {
      // TODO: Query database for subscriptions where:
      // - status IN ('active', 'past_due')
      // - next_payment_time <= NOW() + 1 hour buffer
      // - NOT already queued (idempotency)

      const dueSubscriptions: PaymentJob[] = []; // Replace with actual DB query

      logger.info(`Found ${dueSubscriptions.length} due payments`);

      // Enqueue each payment job with deduplication
      for (const sub of dueSubscriptions) {
        const jobId = `payment-${sub.subscriptionId}-${sub.paymentNumber}`;

        await this.queue.add('execute-payment', sub, {
          jobId, // Prevents duplicate jobs
          priority: sub.attemptNumber > 1 ? 2 : 1, // Retries are lower priority
        });
      }

      this.stats.jobsWaiting = await this.queue.getWaitingCount();
    } finally {
      await lock.release();
    }
  }

  /**
   * Worker — processes payment jobs from the queue
   */
  private startWorker(): void {
    this.worker = new Worker<PaymentJob>(
      'recurra-payments',
      async (job: Job<PaymentJob>) => {
        const { subscriptionId, paymentNumber, amount } = job.data;

        logger.info('Processing payment job', {
          jobId: job.id,
          subscriptionId,
          paymentNumber,
          attempt: job.attemptsMade + 1,
        });

        try {
          // STEP 1: Check authorization (via contract call)
          // const isAuthorized = await this.checkAuthorization(job.data);
          // if (!isAuthorized) throw new Error('Authorization revoked');

          // STEP 2: Check user balance
          // const hasBalance = await this.checkBalance(job.data);
          // if (!hasBalance) {
          //   await this.markPastDue(subscriptionId);
          //   throw new Error('Insufficient balance');
          // }

          // STEP 3: Build and submit Soroban transaction via Batcher
          await transactionBatcher.addAndProcess({
            subscriptionId,
            paymentNumber,
            amount
          });

          // STEP 4: Log success
          this.stats.jobsProcessed++;
          this.stats.totalVolumeProcessed += amount;

          logger.info('Payment added to batch successfully', {
            subscriptionId,
            paymentNumber,
            amount,
          });

          return { success: true, subscriptionId, paymentNumber };
        } catch (err) {
          this.stats.jobsFailed++;
          const errorMessage = err instanceof Error ? err.message : String(err);

          logger.error('Payment execution failed', {
            subscriptionId,
            paymentNumber,
            error: errorMessage,
            attempt: job.attemptsMade + 1,
            maxAttempts: config.keeper.maxRetryAttempts,
          });

          throw err; // BullMQ will retry based on backoff strategy
        }
      },
      {
        connection: { url: config.redis.url },
        concurrency: config.keeper.maxConcurrentWorkers,
        limiter: {
          max: 10,      // Max 10 jobs
          duration: 1000, // Per second (rate limiting)
        },
      },
    );

    // Worker event handlers
    this.worker.on('completed', (job) => {
      logger.debug('Job completed', { jobId: job.id });
    });

    this.worker.on('failed', (job, err) => {
      logger.warn('Job failed', {
        jobId: job?.id,
        error: err.message,
        attemptsMade: job?.attemptsMade,
      });
    });

    this.worker.on('error', (err) => {
      logger.error('Worker error', { error: err.message });
    });
  }

  /**
   * Monitoring — alerts if thresholds exceeded
   */
  private startMonitoring(): void {
    setInterval(async () => {
      try {
        const waiting = await this.queue.getWaitingCount();
        const failed = await this.queue.getFailedCount();

        // Alert if > 10 failed jobs
        if (failed > 10) {
          logger.error('ALERT: High number of failed payment jobs', {
            failedCount: failed,
          });
        }

        // Alert if > 1000 waiting jobs
        if (waiting > 1000) {
          logger.error('ALERT: Queue backlog exceeds 1000 jobs', {
            waitingCount: waiting,
          });
        }

        // Alert if no execution in 2 hours
        if (
          this.stats.lastRunAt &&
          Date.now() - this.stats.lastRunAt.getTime() > 7_200_000
        ) {
          logger.error('ALERT: No keeper execution in 2+ hours');
        }

        this.stats.jobsWaiting = waiting;
      } catch (err) {
        logger.error('Monitoring check failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }, 60_000); // Check every minute
  }

  /**
   * Get current keeper stats
   */
  getStats(): KeeperStats {
    return { ...this.stats };
  }
}

// Export singleton instance
export const keeperService = new KeeperService();
