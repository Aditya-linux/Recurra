import cron from 'node-cron';
import { dbPool } from '../database/index.js';
import { logger } from '../utils/logger.js';

export class AnalyticsSnapshotJob {
  private static task: cron.ScheduledTask | null = null;

  static start() {
    if (this.task) return;

    // Run every day at midnight UTC
    this.task = cron.schedule('0 0 * * *', async () => {
      logger.info('Starting daily analytics snapshot job...');
      try {
        await this.generateSnapshots();
        logger.info('Daily analytics snapshot job completed successfully.');
      } catch (error: any) {
        logger.error('Failed to generate daily analytics snapshots', { error: error.message });
      }
    });

    logger.info('Analytics Snapshot cron job scheduled.');
  }

  static stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
      logger.info('Analytics Snapshot cron job stopped.');
    }
  }

  static async generateSnapshots() {
    const client = await dbPool.connect();
    try {
      await client.query('BEGIN');

      const today = new Date();
      // Snapshot is usually for the previous day
      today.setDate(today.getDate() - 1);
      const snapshotDate = today.toISOString().split('T')[0]; // YYYY-MM-DD

      // Get all active merchants
      const merchantsResult = await client.query('SELECT id FROM merchants WHERE kyc_status = \'approved\'');
      
      for (const row of merchantsResult.rows) {
        const merchantId = row.id;

        // 1. Calculate MRR
        const mrrResult = await client.query(
          `SELECT COALESCE(SUM(
             (pl.amount::numeric / pl.interval_seconds) * 2592000
           ), 0)::bigint AS mrr
           FROM subscriptions s
           JOIN plans pl ON s.plan_id = pl.id
           WHERE s.merchant_id = $1 AND s.status = 'active'`,
          [merchantId]
        );
        const mrr = Number(mrrResult.rows[0].mrr);

        // 2. Active Subscribers
        const activeSubsResult = await client.query(
          `SELECT COUNT(*)::int AS count FROM subscriptions
           WHERE merchant_id = $1 AND status = 'active'`,
          [merchantId]
        );
        const activeSubscribers = activeSubsResult.rows[0].count;

        // 3. New Subscribers (yesterday)
        const newSubsResult = await client.query(
          `SELECT COUNT(*)::int AS count FROM subscriptions
           WHERE merchant_id = $1 AND DATE(created_at) = $2`,
          [merchantId, snapshotDate]
        );
        const newSubscribers = newSubsResult.rows[0].count;

        // 4. Churned Subscribers (yesterday)
        const churnedResult = await client.query(
          `SELECT COUNT(*)::int AS count FROM subscriptions
           WHERE merchant_id = $1 AND status IN ('cancelled', 'inactive')
           AND DATE(updated_at) = $2`,
          [merchantId, snapshotDate]
        );
        const churnedSubscribers = churnedResult.rows[0].count;

        // 5. Total Revenue (yesterday)
        const revenueResult = await client.query(
          `SELECT COALESCE(SUM(amount), 0)::bigint AS total
           FROM payments
           WHERE merchant_id = $1 AND status = 'completed'
           AND DATE(executed_at) = $2`,
          [merchantId, snapshotDate]
        );
        const totalRevenue = Number(revenueResult.rows[0].total);

        // 6. Total Refunds (yesterday)
        const refundsResult = await client.query(
          `SELECT COALESCE(SUM(refund_amount), 0)::bigint AS total
           FROM refunds
           WHERE merchant_id = $1 AND status = 'completed'
           AND DATE(processed_at) = $2`,
          [merchantId, snapshotDate]
        );
        const totalRefunds = Number(refundsResult.rows[0].total);

        // 7. Calculate Churn Rate
        // Simplified: churned / (active + churned)
        const totalInPeriod = activeSubscribers + churnedSubscribers;
        const churnRate = totalInPeriod > 0
          ? parseFloat(((churnedSubscribers / totalInPeriod) * 100).toFixed(2))
          : 0;
          
        // 8. Average Revenue Per User (ARPU)
        const avgRevenuePerSubscriber = activeSubscribers > 0 
          ? Math.floor(mrr / activeSubscribers) 
          : 0;

        // Insert or update snapshot
        await client.query(
          `INSERT INTO analytics_snapshots 
           (merchant_id, snapshot_date, mrr, total_revenue, active_subscribers, new_subscribers, churned_subscribers, churn_rate, avg_revenue_per_subscriber, total_refunds)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (merchant_id, snapshot_date) DO UPDATE SET
             mrr = EXCLUDED.mrr,
             total_revenue = EXCLUDED.total_revenue,
             active_subscribers = EXCLUDED.active_subscribers,
             new_subscribers = EXCLUDED.new_subscribers,
             churned_subscribers = EXCLUDED.churned_subscribers,
             churn_rate = EXCLUDED.churn_rate,
             avg_revenue_per_subscriber = EXCLUDED.avg_revenue_per_subscriber,
             total_refunds = EXCLUDED.total_refunds`,
          [merchantId, snapshotDate, mrr, totalRevenue, activeSubscribers, newSubscribers, churnedSubscribers, churnRate, avgRevenuePerSubscriber, totalRefunds]
        );
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
