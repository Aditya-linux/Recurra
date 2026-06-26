-- ============================================================
-- MIGRATION 003: Feature Extensions
-- Adds support for: Tiered Plans, Trial Periods, Discount Codes,
-- Multi-Token, Prorated Refunds, Payment Receipts, Notifications
-- ============================================================

-- ============================================================
-- PLANS TABLE EXTENSIONS
-- ============================================================

-- Tiered plans (basic/pro/enterprise)
ALTER TABLE plans ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'standard'
    CHECK (tier IN ('basic', 'standard', 'pro', 'enterprise'));

-- Trial period in days (0 = no trial)
ALTER TABLE plans ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 0 CHECK (trial_days >= 0);

-- Feature list for tiered display (JSON array of strings)
ALTER TABLE plans ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb;

-- Accepted tokens for multi-token support (array of token contract addresses)
ALTER TABLE plans ADD COLUMN IF NOT EXISTS accepted_tokens TEXT[] DEFAULT '{}';

-- ============================================================
-- SUBSCRIPTIONS TABLE EXTENSIONS
-- ============================================================

-- Trial end time (null = no trial active)
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_end_time TIMESTAMPTZ;

-- Applied discount code reference
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS discount_code_id UUID;

-- ============================================================
-- TABLE: DISCOUNT CODES
-- ============================================================
CREATE TABLE IF NOT EXISTS discount_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    discount_percent INTEGER CHECK (discount_percent >= 0 AND discount_percent <= 100),
    discount_amount BIGINT CHECK (discount_amount >= 0), -- Fixed amount discount in smallest token unit
    max_uses INTEGER DEFAULT 0, -- 0 = unlimited
    used_count INTEGER DEFAULT 0,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ, -- null = never expires
    is_active BOOLEAN DEFAULT true,
    applies_to_first_payment_only BOOLEAN DEFAULT true, -- true = first month only
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Either percent or amount must be set (not both)
    CONSTRAINT chk_discount_type CHECK (
        (discount_percent IS NOT NULL AND discount_percent > 0 AND (discount_amount IS NULL OR discount_amount = 0))
        OR (discount_amount IS NOT NULL AND discount_amount > 0 AND (discount_percent IS NULL OR discount_percent = 0))
    ),
    -- Code must be unique per merchant
    CONSTRAINT uq_discount_code_merchant UNIQUE (code, merchant_id)
);

-- ============================================================
-- TABLE: DISCOUNT REDEMPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS discount_redemptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discount_code_id UUID NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_amount BIGINT NOT NULL,
    discounted_amount BIGINT NOT NULL,
    savings BIGINT NOT NULL,
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Each user can only redeem a code once per subscription
    CONSTRAINT uq_redemption UNIQUE (discount_code_id, subscription_id)
);

-- ============================================================
-- TABLE: REFUNDS
-- ============================================================
CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id),
    payment_id UUID REFERENCES payments(id), -- Optional: links to the specific payment being refunded
    user_id UUID NOT NULL REFERENCES users(id),
    merchant_id UUID NOT NULL REFERENCES merchants(id),
    refund_amount BIGINT NOT NULL CHECK (refund_amount > 0),
    token_address VARCHAR(56) NOT NULL,
    refund_tx_hash VARCHAR(64), -- Stellar tx hash for the refund
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    days_used INTEGER, -- Days used in the billing cycle
    days_total INTEGER, -- Total days in the billing cycle
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: NOTIFICATION LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    notification_type VARCHAR(50) NOT NULL
        CHECK (notification_type IN (
            'renewal_reminder', 'trial_ending', 'payment_success',
            'payment_failed', 'subscription_created', 'subscription_cancelled',
            'refund_processed', 'discount_applied', 'subscription_expiring'
        )),
    channel VARCHAR(20) NOT NULL DEFAULT 'email'
        CHECK (channel IN ('email', 'webhook', 'push', 'console')),
    recipient VARCHAR(255), -- email or endpoint
    payload JSONB,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency: don't send same notification type for same subscription twice in same day
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_daily 
ON notification_log (user_id, subscription_id, notification_type, ((sent_at AT TIME ZONE 'UTC')::date));

-- ============================================================
-- INDEXES
-- ============================================================

-- Discount codes
CREATE INDEX IF NOT EXISTS idx_discount_codes_merchant ON discount_codes(merchant_id);
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON discount_codes(is_active) WHERE is_active = true;

-- Discount redemptions
CREATE INDEX IF NOT EXISTS idx_discount_redemptions_code ON discount_redemptions(discount_code_id);
CREATE INDEX IF NOT EXISTS idx_discount_redemptions_user ON discount_redemptions(user_id);

-- Refunds
CREATE INDEX IF NOT EXISTS idx_refunds_subscription ON refunds(subscription_id);
CREATE INDEX IF NOT EXISTS idx_refunds_user ON refunds(user_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);

-- Notification log
CREATE INDEX IF NOT EXISTS idx_notification_log_user ON notification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_type ON notification_log(notification_type, sent_at);

-- Subscriptions: trial queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial ON subscriptions(trial_end_time)
    WHERE trial_end_time IS NOT NULL AND status = 'trialing';

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER trg_discount_codes_updated_at
    BEFORE UPDATE ON discount_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_refunds_updated_at
    BEFORE UPDATE ON refunds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ADD FOREIGN KEY for subscriptions.discount_code_id
-- (done after table creation to avoid circular dependency issues)
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_subscription_discount_code'
    ) THEN
        ALTER TABLE subscriptions
            ADD CONSTRAINT fk_subscription_discount_code
            FOREIGN KEY (discount_code_id) REFERENCES discount_codes(id)
            ON DELETE SET NULL;
    END IF;
END $$;
