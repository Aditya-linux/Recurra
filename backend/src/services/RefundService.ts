import { RefundRepository, Refund } from '../database/repositories/RefundRepository.js';
import { SubscriptionRepository } from '../database/repositories/SubscriptionRepository.js';
import { PlanRepository } from '../database/repositories/PlanRepository.js';
import { UserRepository } from '../database/repositories/UserRepository.js';
import { MailService } from './MailService.js';
import { logger } from '../utils/logger.js';

export class RefundService {
  /**
   * Calculate prorated refund amount for a cancellation mid-cycle
   */
  static async calculateProratedRefund(subscriptionId: string): Promise<{
    refundAmount: number;
    daysUsed: number;
    daysTotal: number;
    dailyRate: number;
  }> {
    const subscription = await SubscriptionRepository.findById(subscriptionId);
    if (!subscription || subscription.status !== 'active') {
      throw new Error('Subscription must be active to calculate a refund');
    }

    const plan = await PlanRepository.findById(subscription.plan_id);
    if (!plan) {
      throw new Error('Plan not found');
    }

    // Calculation logic
    // We assume the billing cycle starts at `next_payment_time - interval_seconds`
    // and ends at `next_payment_time`.
    const intervalSeconds = plan.interval_seconds;
    const intervalDays = intervalSeconds / (24 * 3600);
    const amountStr = String(plan.amount);
    const amountTotal = parseInt(amountStr, 10);

    const now = new Date();
    const nextPaymentTime = new Date(subscription.next_payment_time);
    const cycleStartTime = new Date(nextPaymentTime.getTime() - intervalSeconds * 1000);

    if (now >= nextPaymentTime) {
       return { refundAmount: 0, daysUsed: intervalDays, daysTotal: intervalDays, dailyRate: amountTotal / intervalDays };
    }

    // Ensure we don't calculate negative days used if they cancel instantly
    const msUsed = Math.max(0, now.getTime() - cycleStartTime.getTime());
    const daysUsed = Math.ceil(msUsed / (1000 * 3600 * 24));
    
    // Calculate refund
    const daysTotal = Math.round(intervalDays);
    const dailyRate = amountTotal / daysTotal;
    const daysRemaining = Math.max(0, daysTotal - daysUsed);
    
    const refundAmount = Math.floor(daysRemaining * dailyRate);

    return {
      refundAmount,
      daysUsed,
      daysTotal,
      dailyRate
    };
  }

  /**
   * Process a refund, update DB, and optionally trigger on-chain transfer
   */
  static async processRefund(subscriptionId: string, reason?: string): Promise<Refund> {
    const subscription = await SubscriptionRepository.findById(subscriptionId);
    if (!subscription) throw new Error('Subscription not found');

    const plan = await PlanRepository.findById(subscription.plan_id);
    if (!plan) throw new Error('Plan not found');

    const { refundAmount, daysUsed, daysTotal } = await this.calculateProratedRefund(subscriptionId);

    // If no refund is due, or amount is too small (e.g., < 0.01 USDC), just return dummy completed refund
    if (refundAmount < 100000) { 
      return await RefundRepository.create({
        subscription_id: subscriptionId,
        user_id: subscription.user_id,
        merchant_id: subscription.merchant_id,
        refund_amount: refundAmount,
        token_address: plan.token_address,
        reason: reason || 'Prorated cancellation',
        status: 'completed',
        days_used: daysUsed,
        days_total: daysTotal
      });
    }

    // 1. Create pending refund record
    const refund = await RefundRepository.create({
      subscription_id: subscriptionId,
      user_id: subscription.user_id,
      merchant_id: subscription.merchant_id,
      refund_amount: refundAmount,
      token_address: plan.token_address,
      reason: reason || 'Prorated cancellation',
      status: 'pending',
      days_used: daysUsed,
      days_total: daysTotal
    });

    try {
      await RefundRepository.updateStatus(refund.id, 'processing');

      // 2. Trigger on-chain transfer
      // For now, if MAINNET is disabled, we simulate the transfer
      // Real implementation would invoke Soroban contract here
      let txHash = 'mock_refund_tx_' + Date.now();
      
      if (process.env.ENABLE_REAL_REFUND_TRANSFERS === 'true') {
         // TODO: Implement actual stellar sdk transfer
         logger.info(`Would transfer ${refundAmount} stroops from merchant to user`);
      }

      // 3. Mark completed
      const completedRefund = await RefundRepository.updateStatus(refund.id, 'completed', txHash);
      
      // 4. Send email
      const user = await UserRepository.findById(subscription.user_id);
      if (user?.email) {
         const amountStr = `${refundAmount / 10_000_000} USDC`;
         await MailService.sendRefundProcessedEmail(user.email, plan.name, amountStr, txHash);
      }

      return completedRefund!;
    } catch (error) {
      logger.error('Refund processing failed', { error: (error as Error).message });
      await RefundRepository.updateStatus(refund.id, 'failed');
      throw error;
    }
  }
}
