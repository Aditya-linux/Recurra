import { dbPool } from '../index.js';
import { PoolClient } from 'pg';

export interface NotificationLog {
  id: string;
  user_id: string;
  subscription_id: string | null;
  notification_type: string;
  channel: string;
  recipient: string | null;
  payload: any | null;
  sent_at: Date;
}

export class NotificationRepository {
  static async log(notification: Partial<NotificationLog>, client?: PoolClient): Promise<NotificationLog | null> {
    const db = client || dbPool;
    try {
      const query = `
        INSERT INTO notification_log (
          user_id, subscription_id, notification_type, channel, recipient, payload
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const values = [
        notification.user_id,
        notification.subscription_id || null,
        notification.notification_type,
        notification.channel || 'email',
        notification.recipient || null,
        notification.payload || null
      ];
      const result = await db.query<NotificationLog>(query, values);
      return result.rows[0] as NotificationLog;
    } catch (error: any) {
      // Ignore unique constraint violation (idempotency check)
      if (error.code === '23505') {
        return null; // Already logged today
      }
      throw error;
    }
  }

  static async hasBeenSent(
    userId: string,
    notificationType: string,
    subscriptionId?: string,
    date?: Date,
    client?: PoolClient
  ): Promise<boolean> {
    const db = client || dbPool;
    const checkDate = date || new Date();
    
    let query = `
      SELECT 1 FROM notification_log
      WHERE user_id = $1 AND notification_type = $2
      AND sent_at::date = $3::date
    `;
    const values: any[] = [userId, notificationType, checkDate];

    if (subscriptionId) {
      query += ` AND subscription_id = $4`;
      values.push(subscriptionId);
    }

    query += ` LIMIT 1`;

    const result = await db.query(query, values);
    return (result.rowCount ?? 0) > 0;
  }
}
