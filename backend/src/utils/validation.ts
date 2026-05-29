/**
 * Recurra — Zod Validation Schemas
 * 
 * Central validation schemas for all API inputs.
 * Uses Zod for type-safe runtime validation.
 * 
 * @security Prevents injection attacks and invalid data
 */

import { z } from 'zod';

// ============================================================
// COMMON SCHEMAS
// ============================================================

/** Stellar address format: G... or C... followed by 55 alphanumeric chars */
export const stellarAddressSchema = z
  .string()
  .regex(/^[GC][A-Z2-7]{55}$/, 'Invalid Stellar address format');

/** UUID v4 format */
export const uuidSchema = z.string().uuid();

/** Pagination parameters */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================================
// AUTH SCHEMAS
// ============================================================

export const connectWalletSchema = z.object({
  walletAddress: stellarAddressSchema,
  signedTxXdr: z.string().min(1, 'Signed transaction XDR is required'),
  publicKey: z.string().min(1, 'Public key is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// ============================================================
// MERCHANT SCHEMAS
// ============================================================

export const registerMerchantSchema = z.object({
  walletAddress: stellarAddressSchema,
  businessName: z.string().trim().min(2).max(255),
  businessEmail: z.string().trim().email().optional(),
  businessUrl: z.string().trim().url().optional(),
  countryCode: z.string().trim().length(2).optional(),
  gstNumber: z.string().trim().max(15).optional(),
});

// ============================================================
// PLAN SCHEMAS
// ============================================================

export const createPlanSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional().default(''),
  amount: z.number().int().positive('Amount must be positive'),
  tokenAddress: stellarAddressSchema,
  intervalSeconds: z.number().int().min(3600, 'Minimum interval is 1 hour'),
  maxPayments: z.number().int().min(0).default(0),
  metadataUri: z.string().url().or(z.literal('')).optional(),
});

export const updatePlanSchema = createPlanSchema.partial();

// ============================================================
// SUBSCRIPTION SCHEMAS
// ============================================================

export const createSubscriptionSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
  subscriptionIdOnChain: z.string().min(1, 'Transaction hash is required for on-chain verification'),
});

export const cancelSubscriptionSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

// ============================================================
// WEBHOOK SCHEMAS
// ============================================================

export const createWebhookSchema = z.object({
  url: z.string().url('Invalid webhook URL'),
  events: z.array(z.enum([
    'payment.executed',
    'payment.failed',
    'subscription.cancelled',
    'subscription.expired',
    'subscription.created',
    'dispute.created',
    'dispute.resolved',
  ])).min(1, 'At least one event type is required'),
});

// ============================================================
// QUERY FILTER SCHEMAS
// ============================================================

export const subscriptionFilterSchema = z.object({
  status: z.enum(['active', 'paused', 'cancelled', 'expired', 'past_due', 'trialing']).optional(),
  merchantId: uuidSchema.optional(),
  ...paginationSchema.shape,
});

export const paymentFilterSchema = z.object({
  status: z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
  subscriptionId: uuidSchema.optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  ...paginationSchema.shape,
});

export const analyticsSchema = z.object({
  period: z.enum(['day', 'week', 'month', 'quarter', 'year']),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type ConnectWalletInput = z.infer<typeof connectWalletSchema>;
export type RegisterMerchantInput = z.infer<typeof registerMerchantSchema>;
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type SubscriptionFilter = z.infer<typeof subscriptionFilterSchema>;
export type PaymentFilter = z.infer<typeof paymentFilterSchema>;
export type AnalyticsInput = z.infer<typeof analyticsSchema>;
