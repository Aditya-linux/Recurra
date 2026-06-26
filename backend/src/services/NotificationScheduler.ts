import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { MailService } from './MailService.js';
import { NotificationRepository } from '../database/repositories/NotificationRepository.js';
import { SubscriptionRepository } from '../database/repositories/SubscriptionRepository.js';

export class NotificationScheduler {
  private static task: cron.ScheduledTask | null = null;

  public static start() {
    if (this.task) {
      logger.warn('NotificationScheduler is already running.');
      return;
    }

    // Run every day at 10:00 AM UTC
    this.task = cron.schedule('0 10 * * *', async () => {
      logger.info('Running daily notification scheduler...');
      await this.processRenewalReminders();
      await this.processTrialEndingReminders();
    });

    logger.info('NotificationScheduler started.');
  }

  public static stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
      logger.info('NotificationScheduler stopped.');
    }
  }

  private static async processRenewalReminders() {
    try {
      // Find subscriptions due in exactly 3 days
      const dueSubs = await SubscriptionRepository.findDueForRenewalReminder(3);
      logger.info(`Found ${dueSubs.length} subscriptions due in 3 days for renewal reminders`);

      for (const sub of dueSubs) {
        if (!sub.user_email) continue;

        // Idempotency check: have we already sent a renewal reminder for this sub today?
        const alreadySent = await NotificationRepository.hasBeenSent(
          sub.user_id,
          'renewal_reminder',
          sub.id
        );

        if (!alreadySent) {
          const nextPaymentDate = new Date(sub.next_payment_time).toLocaleDateString('en-US');
          const amountStr = `${Number(sub.amount) / 10_000_000} USDC`;

          await MailService.sendRenewalReminderEmail(
            sub.user_email,
            sub.plan_name,
            amountStr,
            3, // days
            nextPaymentDate
          );

          await NotificationRepository.log({
            user_id: sub.user_id,
            subscription_id: sub.id,
            notification_type: 'renewal_reminder',
            channel: 'email',
            recipient: sub.user_email
          });
        }
      }
    } catch (error) {
      logger.error('Error processing renewal reminders', { error: (error as Error).message });
    }
  }

  private static async processTrialEndingReminders() {
    try {
      // Find trials ending in exactly 2 days
      const endingTrials = await SubscriptionRepository.findTrialsEndingSoon(2);
      logger.info(`Found ${endingTrials.length} trials ending in 2 days`);

      for (const sub of endingTrials) {
        if (!sub.user_email) continue;

        // Idempotency check
        const alreadySent = await NotificationRepository.hasBeenSent(
          sub.user_id,
          'trial_ending',
          sub.id
        );

        if (!alreadySent) {
          await MailService.sendTrialEndingEmail(
            sub.user_email,
            sub.plan_name,
            2 // days remaining
          );

          await NotificationRepository.log({
            user_id: sub.user_id,
            subscription_id: sub.id,
            notification_type: 'trial_ending',
            channel: 'email',
            recipient: sub.user_email
          });
        }
      }
    } catch (error) {
      logger.error('Error processing trial ending reminders', { error: (error as Error).message });
    }
  }
}
