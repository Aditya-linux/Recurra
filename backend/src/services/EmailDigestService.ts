import cron from 'node-cron';
import { dbPool } from '../database/index.js';
import { logger } from '../utils/logger.js';
import { MailService } from './MailService.js';

export class EmailDigestService {
  private static task: cron.ScheduledTask | null = null;

  static start() {
    if (this.task) return;

    // Run every Monday at 8 AM UTC
    this.task = cron.schedule('0 8 * * 1', async () => {
      logger.info('Starting weekly email digest job...');
      try {
        await this.sendDigests();
        logger.info('Weekly email digest job completed successfully.');
      } catch (error: any) {
        logger.error('Failed to send weekly email digests', { error: error.message });
      }
    });

    logger.info('Email Digest cron job scheduled.');
  }

  static stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
      logger.info('Email Digest cron job stopped.');
    }
  }

  static async sendDigests() {
    const client = await dbPool.connect();
    try {
      // Get all active merchants with an email
      const merchantsResult = await client.query('SELECT id, business_email, business_name FROM merchants WHERE kyc_status = \'approved\' AND business_email IS NOT NULL');
      
      for (const merchant of merchantsResult.rows) {
        // Gather stats for the last 7 days
        const statsResult = await client.query(`
          SELECT 
            (SELECT COUNT(*) FROM subscriptions WHERE merchant_id = $1 AND created_at >= NOW() - INTERVAL '7 days') as new_subs,
            (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE to_address = $1 AND status = 'completed' AND executed_at >= NOW() - INTERVAL '7 days') as revenue
        `, [merchant.id]);

        const { new_subs, revenue } = statsResult.rows[0];
        
        // Skip if nothing happened
        if (Number(new_subs) === 0 && Number(revenue) === 0) continue;

        const formattedRevenue = `$${(Number(revenue) / 10_000_000).toFixed(2)}`;
        
        // Mock sending the digest email
        logger.info(`Sending weekly digest to ${merchant.business_email}`, { new_subs, formattedRevenue });
        
        // If MailService had a sendWeeklyDigest method, we would call it here.
        // MailService.sendWeeklyDigest(merchant.business_email, merchant.business_name, new_subs, formattedRevenue);
      }
    } finally {
      client.release();
    }
  }
}
