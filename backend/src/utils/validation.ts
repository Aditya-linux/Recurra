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
  businessEmail: z.string().trim().email(),
  logoUrl: z.string().trim().url(),
  businessUrl: z.string().trim().url().optional(),
  countryCode: z.string().trim().length(2).optional(),
  gstNumber: z.string().trim().max(15).optional(),
  platformUrl: z.string().trim().url().optional(),
  platformName: z.string().trim().max(100).optional(),
  platformLogoUrl: z.string().trim().url().optional(),
  redirectUrlTemplate: z.string().trim().max(500).optional(),
});

export const updateMerchantSettingsSchema = z.object({
  businessName: z.string().trim().min(2).max(255).optional(),
  businessUrl: z.string().trim().url().optional(),
  platformUrl: z.string().trim().url().optional(),
  platformName: z.string().trim().max(100).optional(),
  platformLogoUrl: z.string().trim().url().optional(),
  redirectUrlTemplate: z.string().trim().max(500).optional(),
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
  redirectUrl: z.string().trim().url().optional(),
  redirectLabel: z.string().trim().max(100).optional(),
  tier: z.enum(['basic', 'standard', 'pro', 'enterprise']).optional().default('standard'),
  trialDays: z.number().int().min(0).optional().default(0),
  features: z.array(z.string()).optional().default([]),
  acceptedTokens: z.array(stellarAddressSchema).optional().default([]),
});

export const updatePlanSchema = createPlanSchema.partial();

// ============================================================
// SUBSCRIPTION SCHEMAS
// ============================================================

export const createSubscriptionSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
  subscriptionIdOnChain: z.string().min(1, 'Transaction hash is required for on-chain verification'),
  discountCode: z.string().trim().optional(),
});

export const cancelSubscriptionSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

// ============================================================
// DISCOUNT CODE SCHEMAS
// ============================================================

export const createDiscountCodeSchema = z.object({
  code: z.string().trim().min(3).max(50).toUpperCase(),
  description: z.string().trim().max(500).optional(),
  discountPercent: z.number().int().min(1).max(100).optional(),
  discountAmount: z.number().int().min(1).optional(),
  maxUses: z.number().int().min(0).optional().default(0),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  appliesToFirstPaymentOnly: z.boolean().optional().default(true),
}).refine(data => {
  const hasPercent = typeof data.discountPercent === 'number';
  const hasAmount = typeof data.discountAmount === 'number';
  return (hasPercent && !hasAmount) || (!hasPercent && hasAmount);
}, { message: "Must provide either discountPercent or discountAmount, but not both" });

export const updateDiscountCodeSchema = z.object({
  description: z.string().trim().max(500).optional(),
  discountPercent: z.number().int().min(1).max(100).optional(),
  discountAmount: z.number().int().min(1).optional(),
  maxUses: z.number().int().min(0).optional(),
  validUntil: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
  appliesToFirstPaymentOnly: z.boolean().optional(),
});

export const applyDiscountCodeSchema = z.object({
  code: z.string().trim().min(1),
  planId: z.string().min(1),
});

// ============================================================
// REFUND SCHEMAS
// ============================================================

export const refundRequestSchema = z.object({
  subscriptionId: z.string().uuid(),
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
export type UpdateMerchantSettingsInput = z.infer<typeof updateMerchantSettingsSchema>;
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type SubscriptionFilter = z.infer<typeof subscriptionFilterSchema>;
export type PaymentFilter = z.infer<typeof paymentFilterSchema>;
export type AnalyticsInput = z.infer<typeof analyticsSchema>;
export type CreateDiscountCodeInput = z.infer<typeof createDiscountCodeSchema>;
export type UpdateDiscountCodeInput = z.infer<typeof updateDiscountCodeSchema>;
export type ApplyDiscountCodeInput = z.infer<typeof applyDiscountCodeSchema>;
export type RefundRequestInput = z.infer<typeof refundRequestSchema>;
