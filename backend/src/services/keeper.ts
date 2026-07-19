import { Worker, Job } from 'bullmq';
import {
  Keypair,
  Contract,
  rpc,
  TransactionBuilder,
  TimeoutInfinite,
  nativeToScVal,
} from '@stellar/stellar-sdk';
import { dbPool } from '../database/index.js';
import { logger } from '../utils/logger.js';
import { WebhookDeliveryService } from '../webhooks/WebhookDeliveryService.js';
import { getIO } from '../utils/socket.js';
import { UserRepository } from '../database/repositories/UserRepository.js';
import { PlanRepository } from '../database/repositories/PlanRepository.js';
import { RetailFulfillmentService } from './RetailFulfillmentService.js';
import { MailService } from './MailService.js';
import { config } from '../config/index.js';
import { isRedisAvailable, getRedisClient } from '../utils/redis.js';
import { DiscountCodeRepository } from '../database/repositories/DiscountCodeRepository.js';
import { getHealthyRPC } from '../utils/rpcFailover.js';

// ── Constants ──
const KEEPER_BATCH_SIZE = parseInt(process.env.KEEPER_BATCH_SIZE || '500');
const TX_CONFIRMATION_TIMEOUT_MS = 30_000; // 30s max wait for tx confirmation
const TX_POLL_INTERVAL_MS = 2_000;         // Poll every 2s

// ── Reusable keeper keypair (computed once) ──
const keeperKeypair =
  process.env.KEEPER_PRIVATE_KEY &&
  process.env.KEEPER_PRIVATE_KEY !== 'NEVER_COMMIT_THIS'
    ? Keypair.fromSecret(process.env.KEEPER_PRIVATE_KEY)
    : Keypair.random();

const paymentEngineAddress = config.contracts.paymentEngine
  || process.env.CONTRACT_PAYMENT_ENGINE
  || 'CAVNDZ7YCVRPGJODZBKG2QYWG3S543POW6CDBBZ3X67G6URK7ZPQP6RY';

// ────────────────────────────────────────────────────────────────────────────
// processPayment — C10K-safe isolated unit of work (Two-Phase Commit)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Process a single subscription's payment cycle.
 *
 * Two-phase commit pattern:
 *   1. Insert payment as 'pending' BEFORE submitting to Soroban
 *   2. Submit on-chain transaction
 *   3. Wait for confirmation (with timeout)
 *   4. If confirmed → 'completed'; if failed/timeout → 'failed' + sub stays retryable
 *
 * If internet drops mid-transaction, payment stays 'pending' and the
 * PaymentReconciler picks it up on its next cycle.
 */
async function processPayment(sub: any): Promise<void> {
  logger.info(`Executing payment for subscription ${sub.subscription_id_on_chain}`);

  // ── Step 1: Load plan and calculate amount ──
  let amountToCharge = 10_000_000; // 1 USDC default
  let tokenAddress = config.contracts.usdcToken || 'USDC';
  let plan: any = null;

  try {
    plan = await PlanRepository.findById(sub.plan_id);
    if (plan) {
      amountToCharge = Number(plan.amount);
      tokenAddress = plan.token_address;

      // Apply discount on first payment
      if (sub.payments_made === 0 && sub.discount_code_id) {
        const dc = await DiscountCodeRepository.findById(sub.discount_code_id);
        if (dc) {
          amountToCharge = dc.discount_percent
            ? Math.floor(amountToCharge * (100 - dc.discount_percent) / 100)
            : Math.max(0, amountToCharge - Number(dc.discount_amount || 0));
        }
      }
    }
  } catch (e) {
    logger.warn(`Could not load plan/discount for sub ${sub.id}`, e);
  }

  const paymentNumber = (sub.payments_made ?? 0) + 1;

  // ── Step 2: Insert PENDING payment (pre-commit) ──
  const pendingPayment = await dbPool.query(
    `INSERT INTO payments
       (subscription_id, amount, fee_amount, token_address, from_address, to_address, payment_number, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
     ON CONFLICT (subscription_id, payment_number) DO NOTHING
     RETURNING id`,
    [
      sub.id,
      amountToCharge,
      Math.floor(amountToCharge * config.platform.feeBps / 10000),
      tokenAddress,
      sub.user_id,
      sub.merchant_id,
      paymentNumber,
    ]
  );

  // Idempotency: if the payment already exists, skip
  if (!pendingPayment.rows[0]) {
    logger.info(`Payment #${paymentNumber} for sub ${sub.id} already exists, skipping`);
    return;
  }
  const paymentId = pendingPayment.rows[0].id;

  // ── Step 3: Submit on-chain transaction ──
  let txHash = '';
  let txConfirmed = false;

  try {
    const server = await getHealthyRPC();
    const contract = new Contract(paymentEngineAddress);
    const account = await server.getAccount(keeperKeypair.publicKey());

    const tx = new TransactionBuilder(account, {
      fee: '1000',
      networkPassphrase: config.stellar.networkPassphrase,
    })
      .addOperation(
        contract.call(
          'execute_payment',
          nativeToScVal(sub.subscription_id_on_chain, { type: 'string' })
        )
      )
      .setTimeout(TimeoutInfinite)
      .build();

    const preparedTx = await server.prepareTransaction(tx);
    preparedTx.sign(keeperKeypair);
    const sendRes = await server.sendTransaction(preparedTx);
    txHash = sendRes.hash;

    // ── Step 4: Wait for confirmation with timeout ──
    txConfirmed = await waitForTxConfirmation(server, txHash);
  } catch (e) {
    logger.warn(`Stellar tx failed for sub ${sub.subscription_id_on_chain}: ${(e as Error).message}`);

    // If no txHash was even obtained, mark as failed immediately
    if (!txHash) {
      await dbPool.query(
        `UPDATE payments SET status = 'failed', failure_reason = $1 WHERE id = $2`,
        [`On-chain submission failed: ${(e as Error).message}`, paymentId]
      );
      // Leave subscription status unchanged — keeper will retry next cycle
      return;
    }
  }

  // ── Step 5: Finalize based on confirmation result ──
  if (txConfirmed) {
    // SUCCESS: update payment + advance subscription
    await dbPool.query(
      `UPDATE payments SET status = 'completed', transaction_hash = $1, executed_at = NOW() WHERE id = $2`,
      [txHash, paymentId]
    );

    await dbPool.query(
      `UPDATE subscriptions
       SET next_payment_time = next_payment_time + (interval_seconds * INTERVAL '1 second'),
           payments_made = payments_made + 1
       WHERE id = $1`,
      [sub.id]
    );

    // Check max payments → expire if reached
    if (plan?.max_payments > 0 && paymentNumber >= plan.max_payments) {
      await dbPool.query(`UPDATE subscriptions SET status = 'expired' WHERE id = $1`, [sub.id]);
    }

    // ── Step 5a: Record treasury fee ──
    const feeAmount = Math.floor(amountToCharge * config.platform.feeBps / 10000);
    await dbPool.query(
      `INSERT INTO treasury_transactions (payment_id, subscription_id, fee_amount, token_address, transaction_hash, treasury_wallet)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [paymentId, sub.id, feeAmount, tokenAddress, txHash, config.stellar.platformFeeWallet]
    ).catch(e => logger.warn('Treasury tracking insert failed (table may not exist yet)', { error: (e as Error).message }));

    // ── Step 6: Fulfillment, webhooks, sockets, emails ──
    await postPaymentActions(sub, plan, txHash, amountToCharge, tokenAddress, paymentNumber);

    logger.info(`✓ Payment settled: sub=${sub.subscription_id_on_chain} txHash=${txHash}`);
  } else {
    // FAILED or TIMEOUT: mark payment failed, leave sub for retry
    await dbPool.query(
      `UPDATE payments SET status = 'failed', transaction_hash = $1, failure_reason = 'Transaction not confirmed within timeout' WHERE id = $2`,
      [txHash || null, paymentId]
    );
    logger.error(`✗ Payment failed/timed out: sub=${sub.subscription_id_on_chain} txHash=${txHash}`);
  }
}

/**
 * Poll Stellar RPC for transaction confirmation with timeout.
 */
async function waitForTxConfirmation(server: rpc.Server, txHash: string): Promise<boolean> {
  const deadline = Date.now() + TX_CONFIRMATION_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const txResponse = await server.getTransaction(txHash);
      if (txResponse.status === 'SUCCESS') return true;
      if (txResponse.status === 'FAILED') return false;
      // status === 'NOT_FOUND' → still processing, keep polling
    } catch {
      // RPC error during poll — continue trying
    }
    await new Promise(resolve => setTimeout(resolve, TX_POLL_INTERVAL_MS));
  }

  return false; // Timed out
}

/**
 * Post-payment actions: fulfillment, webhooks, sockets, emails.
 * Extracted to avoid duplication and keep processPayment lean.
 */
async function postPaymentActions(
  sub: any,
  plan: any,
  txHash: string,
  amountToCharge: number,
  tokenAddress: string,
  paymentNumber: number,
): Promise<void> {
  try {
    const superMerchantId = process.env.SUPER_MERCHANT_ID || '00000000-0000-0000-0000-000000000000';
    const user = await UserRepository.findById(sub.user_id);

    if (sub.merchant_id === superMerchantId) {
      if (user?.email && plan) {
        await RetailFulfillmentService.fulfillOrder(plan.name, user.email);
      }
    } else {
      WebhookDeliveryService.dispatch(sub.merchant_id, 'payment.executed', {
        subscriptionId: sub.id,
        transactionHash: txHash,
        amount: amountToCharge,
        paymentNumber,
      }).catch(e => logger.error('Failed to dispatch payment webhook', { error: e.message }));
    }

    // Real-time dashboard update
    getIO().emit('payment_executed', { subscriptionId: sub.id, transactionHash: txHash });

    // Email notifications
    if (user?.email && plan) {
      const amountStr = `${amountToCharge / 10_000_000} ${tokenAddress === config.contracts.usdcToken ? 'USDC' : 'Token'}`;

      const nextPmtResult = await dbPool.query(
        'SELECT next_payment_time FROM subscriptions WHERE id = $1',
        [sub.id]
      );
      const nextPaymentDate = nextPmtResult.rows[0]?.next_payment_time
        ? new Date(nextPmtResult.rows[0].next_payment_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Upcoming';

      MailService.sendPaymentExecutedEmail(user.email, plan.name, amountStr, paymentNumber, nextPaymentDate)
        .catch(e => logger.error('Failed to send payment email', { error: (e as Error).message }));

      if (plan.max_payments > 0) {
        const remaining = plan.max_payments - paymentNumber;
        if (remaining <= 2 && remaining > 0) {
          MailService.sendSubscriptionExpiringEmail(user.email, plan.name, remaining)
            .catch(e => logger.error('Failed to send expiring email', { error: (e as Error).message }));
        }
      }
    }
  } catch (e) {
    logger.error('Post-payment action error', { error: (e as Error).message });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Keeper Worker — C10K-safe parallel batch processor
// ────────────────────────────────────────────────────────────────────────────

let _keeperWorker: Worker | null = null;

/**
 * Initialize the keeper worker. Must be called AFTER Redis is connected.
 * Returns the worker instance, or null if Redis is unavailable.
 */
export function initKeeperWorker(): Worker | null {
  if (_keeperWorker) return _keeperWorker;
  if (!isRedisAvailable()) {
    logger.warn('Keeper worker: Redis unavailable — worker disabled');
    return null;
  }

  const client = getRedisClient();
  if (!client) return null;

  _keeperWorker = new Worker(
    'keeperQueue',
    async (job: Job) => {
      logger.info(`Processing keeper job ${job.id}`);

      // Query due subscriptions (active + past_due)
      const result = await dbPool.query(
        `SELECT id, subscription_id_on_chain, plan_id, user_id, merchant_id,
                next_payment_time, payments_made, discount_code_id
         FROM subscriptions
         WHERE next_payment_time <= NOW() AND status IN ('active', 'past_due')
         LIMIT $1`,
        [KEEPER_BATCH_SIZE]
      );
      const dueSubscriptions = result.rows;

      // Handle trials that are ending
      const trialResult = await dbPool.query(
        `SELECT id, trial_end_time, plan_id, user_id, merchant_id, discount_code_id
         FROM subscriptions
         WHERE status = 'trialing' AND trial_end_time <= NOW()`
      );

      for (const trial of trialResult.rows) {
        const trialPlan = await PlanRepository.findById(trial.plan_id);
        if (trialPlan) {
          await dbPool.query(
            `UPDATE subscriptions SET status = 'active', next_payment_time = NOW() WHERE id = $1`,
            [trial.id]
          );
          dueSubscriptions.push({
            ...trial,
            status: 'active',
            next_payment_time: new Date(),
            payments_made: 0,
          });
        }
      }

      if (trialResult.rows.length > 0) {
        logger.info(`Transitioned ${trialResult.rows.length} trials to active`);
      }

      logger.info(`Found ${dueSubscriptions.length} due subscriptions (batch limit: ${KEEPER_BATCH_SIZE})`);
      if (dueSubscriptions.length === 0) return;

      // ── C10K PARALLEL EXECUTION ──
      const results = await Promise.allSettled(
        dueSubscriptions.map(sub => processPayment(sub))
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      logger.info(`Keeper batch done: ${succeeded} succeeded / ${failed} failed / ${dueSubscriptions.length} total`);

      // Log individual failures
      for (let i = 0; i < results.length; i++) {
        const r = results[i]!;
        if (r.status === 'rejected') {
          logger.error(`✗ sub[${i}] ${dueSubscriptions[i]?.subscription_id_on_chain}: ${(r as PromiseRejectedResult).reason}`);
        }
      }

      // Dead-man's switch ping (fire-and-forget)
      if (config.stellar.healthcheckPingUrl) {
        fetch(config.stellar.healthcheckPingUrl).catch(() => {});
      }

      // Mainnet gate strict mode
      if (failed > 0 && process.env.MAINNET_GATE_TEST === 'true') {
        throw new Error(
          `Mainnet gate FAILED: ${failed}/${dueSubscriptions.length} payments failed.`
        );
      }
    },
    { connection: client.duplicate() as any }
  );

  _keeperWorker.on('completed', job => logger.info(`Keeper job ${job.id} completed`));
  _keeperWorker.on('failed', (job, err) => logger.error(`Keeper job ${job?.id} failed: ${err.message}`));

  logger.info('Keeper worker initialized');
  return _keeperWorker;
}

/** Get the existing keeper worker (or null if not initialized) */
export function getKeeperWorker(): Worker | null {
  return _keeperWorker;
}
