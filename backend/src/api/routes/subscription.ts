/**
 * Recurra — Subscription Routes
 * POST /api/v1/subscriptions — Create subscription
 * POST /api/v1/subscriptions/:id/cancel — Cancel subscription
 * POST /api/v1/subscriptions/:id/pause — Pause subscription
 * POST /api/v1/subscriptions/:id/resume — Resume subscription
 * GET  /api/v1/subscriptions/:id — Get subscription details
 */

import { Router, Request, Response, NextFunction } from 'express';
import { dbPool } from '../../database/index.js';
import { authenticate } from '../../middleware/auth.js';
import { createSubscriptionSchema, cancelSubscriptionSchema } from '../../utils/validation.js';
import { logger } from '../../utils/logger.js';
import { SubscriptionRepository } from '../../database/repositories/SubscriptionRepository.js';
import { PlanRepository } from '../../database/repositories/PlanRepository.js';
import { rpc } from '@stellar/stellar-sdk';
import { UserRepository } from '../../database/repositories/UserRepository.js';
import { MailService } from '../../services/MailService.js';
import { getIO } from '../../utils/socket.js';
import { WebhookDeliveryService } from '../../webhooks/WebhookDeliveryService.js';
import { config } from '../../config/index.js';
import { DiscountCodeRepository } from '../../database/repositories/DiscountCodeRepository.js';
import { RefundService } from '../../services/RefundService.js';
import { WhatsAppService } from '../../services/WhatsAppService.js';

export const subscriptionRoutes = Router();

// All subscription routes require authentication
subscriptionRoutes.use(authenticate);

/**
 * POST /api/v1/subscriptions — Create subscription
 */
subscriptionRoutes.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const input = createSubscriptionSchema.parse(req.body);

    // Enforce strict role segregation: Merchants cannot subscribe
    if (req.user!.role === 'merchant') {
      res.status(403).json({ error: 'Wallet already registered as a merchant, cannot subscribe to plans' });
      return;
    }

    const plan = await PlanRepository.findById(input.planId);
    if (!plan || !plan.is_active) {
      res.status(400).json({ error: 'Plan does not exist or is inactive' });
      return;
    }

    // Calculate dates
    const now = new Date();
    const trialDays = plan.trial_days || 0;
    const isTrial = trialDays > 0;
    
    // First payment time is delayed if there is a trial
    const nextPayment = new Date(now.getTime() + (isTrial ? trialDays * 24 * 3600 * 1000 : plan.interval_seconds * 1000));
    const trialEndTime = isTrial ? nextPayment : null;

    // Handle Discount Code Validation
    let validDiscountCodeId: string | null = null;
    let validDiscountCode = null;
    if (input.discountCode) {
      const validation = await DiscountCodeRepository.isValid(input.discountCode, plan.merchant_id as string);
      if (!validation.valid) {
         res.status(400).json({ error: validation.reason });
         return;
      }
      
      const hasRedeemed = await DiscountCodeRepository.hasUserRedeemed(req.user!.userId as string, validation.discountCode!.id);
      if (hasRedeemed) {
         res.status(400).json({ error: 'You have already redeemed this discount code' });
         return;
      }

      validDiscountCodeId = validation.discountCode!.id;
      validDiscountCode = validation.discountCode;
    }

    // Verify transaction on-chain
    if (req.body.subscriptionIdOnChain) {
      const txId = req.body.subscriptionIdOnChain;
      
      try {
        const server = new rpc.Server(config.stellar.rpcUrl);
        const txResponse = await server.getTransaction(txId);
        if (txResponse.status !== 'SUCCESS') {
          res.status(400).json({ error: 'Transaction failed on-chain or is pending' });
          return;
        }
      } catch (error) {
        logger.error('Failed to verify transaction on-chain', { error: (error as Error).message });
        res.status(400).json({ error: 'Invalid or unverified transaction hash' });
        return;
      }
    } else {
      res.status(400).json({ error: 'Missing subscriptionIdOnChain' });
      return;
    }

    // Since the frontend invokes the smart contract (as per test_guide.md), 
    // the backend just records the intent/subscription creation.
    const sub = await SubscriptionRepository.create({
      user_id: req.user!.userId as string,
      plan_id: input.planId,
      merchant_id: plan.merchant_id as string,
      status: isTrial ? 'trialing' : 'active',
      subscription_id_on_chain: req.body.subscriptionIdOnChain || null,
      start_time: now,
      next_payment_time: nextPayment,
      trial_end_time: trialEndTime,
      discount_code_id: validDiscountCodeId
    });

    // Record redemption if applicable
    if (validDiscountCodeId && validDiscountCode) {
       const originalAmount = Number(plan.amount);
       let discountedAmount = originalAmount;
       if (validDiscountCode.discount_percent) {
           discountedAmount = Math.floor(originalAmount * (100 - validDiscountCode.discount_percent) / 100);
       } else if (validDiscountCode.discount_amount) {
           discountedAmount = Math.max(0, originalAmount - Number(validDiscountCode.discount_amount));
       }
       
       await DiscountCodeRepository.recordRedemption(
         validDiscountCodeId,
         sub.id,
         req.user!.userId as string,
         originalAmount,
         discountedAmount
       );
    }

    logger.info('Subscription created', {
      userId: req.user!.userId,
      planId: input.planId,
      subscriptionId: sub.id
    });

    // Fetch merchant redirect info for the response
    const merchantRedirectResult = await dbPool.query(
      `SELECT m.platform_url, m.platform_name, m.platform_logo_url, m.redirect_url_template,
              p.redirect_url as plan_redirect_url, p.redirect_label
       FROM merchants m
       JOIN plans p ON p.merchant_id = m.id
       WHERE p.id = $1`,
      [input.planId]
    );
    const redirectInfo = merchantRedirectResult.rows[0] || {};

    // Build the actual redirect URL (substitute {wallet} placeholder)
    let resolvedRedirectUrl = redirectInfo.plan_redirect_url || redirectInfo.redirect_url_template || redirectInfo.platform_url || null;
    if (resolvedRedirectUrl && req.user!.walletAddress) {
      resolvedRedirectUrl = resolvedRedirectUrl.replace('{wallet}', encodeURIComponent(req.user!.walletAddress as string));
    }

    res.status(201).json({
      message: 'Subscription created successfully',
      subscription: sub,
      redirect: {
        url: resolvedRedirectUrl,
        label: redirectInfo.redirect_label || 'Go to Platform',
        platformName: redirectInfo.platform_name || null,
        platformLogoUrl: redirectInfo.platform_logo_url || null,
        platformUrl: redirectInfo.platform_url || null,
      }
    });

    try {
      getIO().emit('subscription_updated', { type: 'created', subscription: sub });
    } catch (e) {
      logger.error('Failed to emit socket event', { error: (e as Error).message });
    }

    // Send Email Notification Async
    const user = await UserRepository.findById(req.user!.userId as string);
    if (user) {
      const amountFormatted = `${Number(plan.amount) / 10000000} ${plan.token_address === 'USDC' ? 'USDC' : 'Token'}`;
      
      if (user.email) {
        MailService.sendSubscriptionCreatedEmail(user.email, plan.name, amountFormatted).catch(e => logger.error('Mail error', { error: e }));
      }

      if (user.phone_number) {
        const templateName = process.env.WHATSAPP_TEMPLATE_NAME || 'hello_world';
        WhatsAppService.sendSubscriptionReceipt(
          user.phone_number,
          templateName,
          [user.name || 'Subscriber', plan.name, amountFormatted]
        ).catch(e => logger.error('WhatsApp error', { error: e }));
      }
    }

    // Dispatch Webhook to Merchant endpoints
    WebhookDeliveryService.dispatch(plan.merchant_id as string, 'subscription.created', sub)
      .catch(e => logger.error('Failed to dispatch webhook', { error: (e as Error).message }));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/subscriptions — List user subscriptions
 */
subscriptionRoutes.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const subs = await SubscriptionRepository.findByUserId(req.user!.userId as string);
    
    // Map to frontend expected format
    const formattedSubs = subs.map(sub => {
      const nextDate = new Date(sub.next_payment_time);
      const formattedDate = nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      
      // Resolve redirect URL — plan-level overrides merchant-level template
      const redirectUrl = sub.redirect_url || sub.redirect_url_template || sub.platform_url || null;

      return {
        id: sub.id,
        name: sub.name,
        amount: `$${(Number(sub.amount) / 10000000).toFixed(2)} / mo`,
        nextPayment: sub.status === 'active' ? formattedDate : 'Cancelled',
        status: sub.status,
        color: '#3B82F6', // default color
        icon: 'payment', // default material icon
        isMaterial: true,
        redirect: {
          url: redirectUrl,
          label: sub.redirect_label || 'Go to Platform',
          platformName: sub.platform_name || sub.merchant_name || null,
          platformLogoUrl: sub.platform_logo_url || null,
          platformUrl: sub.platform_url || null,
        },
        logoUrl: sub.logo_url || null,
      };
    });

    res.json({
      data: formattedSubs
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/subscriptions/:id — Get subscription details
 */
subscriptionRoutes.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;

    const sub = await SubscriptionRepository.findById(id);
    if (!sub) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    if (sub.user_id !== (req.user!.userId as string)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    res.json(sub);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/subscriptions/:id/cancel — Cancel subscription
 */
subscriptionRoutes.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const input = cancelSubscriptionSchema.parse(req.body);

    const sub = await SubscriptionRepository.findById(id);
    if (!sub || sub.user_id !== (req.user!.userId as string)) {
      res.status(404).json({ error: 'Subscription not found or unauthorized' });
      return;
    }

    const updatedSub = await SubscriptionRepository.updateStatus(id, 'cancelled');

    // Calculate Prorated Refund if active
    let refundInfo = null;
    if (sub.status === 'active') {
       try {
         const refund = await RefundService.processRefund(id, input.reason);
         refundInfo = {
            amount: refund.refund_amount,
            status: refund.status,
            txHash: refund.refund_tx_hash
         };
       } catch (err) {
         logger.error('Failed to process refund on cancel', { error: (err as Error).message });
       }
    }

    logger.info('Subscription cancelled', {
      subscriptionId: id,
      reason: input.reason,
    });

    res.json({
      message: 'Subscription cancelled successfully',
      subscription: updatedSub,
      refund: refundInfo
    });

    try {
      getIO().emit('subscription_updated', { type: 'cancelled', subscription: updatedSub });
    } catch (e) {
      logger.error('Failed to emit socket event', { error: (e as Error).message });
    }

    // Send Email Notification Async
    const user = await UserRepository.findById(req.user!.userId as string);
    const plan = await PlanRepository.findById(sub.plan_id);
    if (user && user.email && plan) {
      MailService.sendSubscriptionCancelledEmail(user.email, plan.name).catch(e => logger.error('Mail error', { error: e }));
    }
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/subscriptions/:id/pause — Pause subscription
 */
subscriptionRoutes.post('/:id/pause', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;

    const sub = await SubscriptionRepository.findById(id);
    if (!sub || sub.user_id !== (req.user!.userId as string)) {
      res.status(404).json({ error: 'Subscription not found or unauthorized' });
      return;
    }

    const updatedSub = await SubscriptionRepository.updateStatus(id, 'paused');

    res.json({
      message: 'Subscription paused',
      subscription: updatedSub,
    });

    try {
      getIO().emit('subscription_updated', { type: 'paused', subscription: updatedSub });
    } catch (e) {
      logger.error('Failed to emit socket event', { error: (e as Error).message });
    }
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/subscriptions/:id/resume — Resume subscription
 */
subscriptionRoutes.post('/:id/resume', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;

    const sub = await SubscriptionRepository.findById(id);
    if (!sub || sub.user_id !== (req.user!.userId as string)) {
      res.status(404).json({ error: 'Subscription not found or unauthorized' });
      return;
    }

    const updatedSub = await SubscriptionRepository.updateStatus(id, 'active');

    res.json({
      message: 'Subscription resumed',
      subscription: updatedSub,
    });

    try {
      getIO().emit('subscription_updated', { type: 'resumed', subscription: updatedSub });
    } catch (e) {
      logger.error('Failed to emit socket event', { error: (e as Error).message });
    }
  } catch (err) {
    next(err);
  }
});
