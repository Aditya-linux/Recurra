import { dbPool } from '../../database/index.js';

export const resolvers = {
  Query: {
    me: async (_: any, __: any, context: any) => {
      if (!context.user) return null;
      const { rows } = await dbPool.query('SELECT * FROM users WHERE id = $1', [context.user.id]);
      return rows[0] || null;
    },
    mySubscriptions: async (_: any, __: any, context: any) => {
      if (!context.user) throw new Error('Not authenticated');
      const { rows } = await dbPool.query('SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC', [context.user.id]);
      return rows;
    },
    merchant: async (_: any, { id }: { id: string }) => {
      const { rows } = await dbPool.query('SELECT * FROM merchants WHERE id = $1', [id]);
      return rows[0] || null;
    },
    merchantPlans: async (_: any, { merchantId }: { merchantId: string }) => {
      const { rows } = await dbPool.query('SELECT * FROM plans WHERE merchant_id = $1 AND is_active = true ORDER BY created_at DESC', [merchantId]);
      return rows;
    },
    plan: async (_: any, { id }: { id: string }) => {
      const { rows } = await dbPool.query('SELECT * FROM plans WHERE id = $1', [id]);
      return rows[0] || null;
    }
  },
  Subscription: {
    plan: async (parent: any) => {
      const { rows } = await dbPool.query('SELECT * FROM plans WHERE id = $1', [parent.plan_id]);
      return rows[0] || null;
    },
    merchant: async (parent: any) => {
      const { rows } = await dbPool.query('SELECT * FROM merchants WHERE id = $1', [parent.merchant_id]);
      return rows[0] || null;
    }
  },
  Mutation: {
    cancelSubscription: async (_: any, { id }: { id: string }, context: any) => {
      if (!context.user) throw new Error('Not authenticated');
      // Should verify ownership and interact with Soroban RPC
      const { rows } = await dbPool.query(
        'UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *',
        ['cancelled', id, context.user.id]
      );
      if (rows.length === 0) throw new Error('Subscription not found or not owned by user');
      return rows[0];
    }
  }
};
