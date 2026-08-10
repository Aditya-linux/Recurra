-- ============================================================
-- MIGRATION 007: Major Features
-- Adds support for: Smart Wallets, Session Keys, Payment Receipts,
-- Anchor (SEP-24/31) Transactions, Analytics Snapshots,
-- Tier Change Tracking, Webhook Event Queue
-- ============================================================

-- ============================================================
-- TABLE: SMART WALLETS
-- ============================================================
CREATE TABLE IF NOT EXISTS smart_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contract_address VARCHAR(56) UNIQUE, -- Deployed smart wallet contract C-address
    daily_limit BIGINT NOT NULL DEFAULT 0,  -- 0 = no limit
    monthly_limit BIGINT NOT NULL DEFAULT 0,
    auto_approve_threshold BIGINT NOT NULL DEFAULT 0,
    is_frozen BOOLEAN DEFAULT false,
    daily_spent BIGINT DEFAULT 0,
    monthly_spent BIGINT DEFAULT 0,
    last_daily_reset TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_monthly_reset TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_smart_wallet_user UNIQUE (user_id)
);

-- ============================================================
-- TABLE: SESSION KEYS
-- ============================================================
CREATE TABLE IF NOT EXISTS session_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES smart_wallets(id) ON DELETE CASCADE,
    key_address VARCHAR(56) NOT NULL,
    label VARCHAR(255) NOT NULL DEFAULT 'Session Key',
    max_amount BIGINT NOT NULL,
    total_spent BIGINT DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,

    CONSTRAINT uq_session_key UNIQUE (wallet_id, key_address)
);

-- ============================================================
-- TABLE: PAYMENT RECEIPTS
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id),
    user_id UUID NOT NULL REFERENCES users(id),
    merchant_id UUID NOT NULL REFERENCES merchants(id),
    receipt_hash VARCHAR(128) NOT NULL, -- SHA-256 hash for verification
    amount BIGINT NOT NULL,
    token_address VARCHAR(56) NOT NULL,
    transaction_hash VARCHAR(64),
    pdf_path VARCHAR(500), -- S3 or local path to generated PDF
    merchant_name VARCHAR(255),
    plan_name VARCHAR(255),
    billing_period_start TIMESTAMPTZ,
    billing_period_end TIMESTAMPTZ,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_receipt_payment UNIQUE (payment_id)
);

-- ============================================================
-- TABLE: ANCHOR TRANSACTIONS (SEP-24/31)
-- ============================================================
CREATE TABLE IF NOT EXISTS anchor_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    anchor_domain VARCHAR(255) NOT NULL, -- e.g. "api.anchorusd.com"
    sep_type VARCHAR(10) NOT NULL CHECK (sep_type IN ('sep24', 'sep31')),
    transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('deposit', 'withdraw')),
    stellar_transaction_id VARCHAR(64), -- Stellar-side tx ID
    anchor_transaction_id VARCHAR(128), -- Anchor-side tx ID
    source_asset VARCHAR(20) NOT NULL, -- e.g. "USD", "EUR", "INR"
    dest_asset VARCHAR(20) NOT NULL, -- e.g. "USDC"
    source_amount NUMERIC(18,7),
    dest_amount NUMERIC(18,7),
    exchange_rate NUMERIC(18,7),
    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'incomplete', 'pending_user_transfer_start',
            'pending_anchor', 'pending_stellar', 'pending_external',
            'completed', 'refunded', 'expired', 'error', 'no_market')),
    status_message TEXT,
    redirect_url VARCHAR(1000), -- SEP-24 interactive URL
    more_info_url VARCHAR(1000), -- Anchor's transaction info page
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: ANALYTICS SNAPSHOTS (Daily MRR/Churn/Revenue)
-- ============================================================
CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    mrr BIGINT NOT NULL DEFAULT 0, -- Monthly Recurring Revenue
    total_revenue BIGINT NOT NULL DEFAULT 0,
    active_subscribers INTEGER NOT NULL DEFAULT 0,
    new_subscribers INTEGER NOT NULL DEFAULT 0,
    churned_subscribers INTEGER NOT NULL DEFAULT 0,
    churn_rate NUMERIC(5,2) DEFAULT 0.00,
    avg_revenue_per_subscriber BIGINT DEFAULT 0,
    total_refunds BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_analytics_snapshot UNIQUE (merchant_id, snapshot_date)
);

-- ============================================================
-- TABLE: CHURN RISK SCORES
-- ============================================================
CREATE TABLE IF NOT EXISTS churn_risk_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    merchant_id UUID NOT NULL REFERENCES merchants(id),
    risk_score NUMERIC(5,2) NOT NULL DEFAULT 0.00, -- 0 = low risk, 100 = high risk
    risk_factors JSONB DEFAULT '[]'::jsonb, -- Array of contributing factors
    failed_payment_count INTEGER DEFAULT 0,
    days_since_last_payment INTEGER DEFAULT 0,
    subscription_age_days INTEGER DEFAULT 0,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_churn_score UNIQUE (subscription_id)
);

-- ============================================================
-- SUBSCRIPTIONS TABLE EXTENSIONS
-- ============================================================

-- Track tier changes
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS previous_plan_id UUID;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tier_changed_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS proration_credit BIGINT DEFAULT 0;

-- ============================================================
-- PAYMENTS TABLE EXTENSIONS
-- ============================================================

-- Receipt hash for on-chain verification
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_hash VARCHAR(128);
-- Discount applied to this payment
ALTER TABLE payments ADD COLUMN IF NOT EXISTS discount_code VARCHAR(50);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS discount_savings BIGINT DEFAULT 0;

-- ============================================================
-- WEBHOOK EVENT QUEUE
-- ============================================================
CREATE TABLE IF NOT EXISTS webhook_event_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES merchants(id),
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'dead_letter')),
    attempt_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    next_retry_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Smart wallets
CREATE INDEX IF NOT EXISTS idx_smart_wallets_user ON smart_wallets(user_id);

-- Session keys
CREATE INDEX IF NOT EXISTS idx_session_keys_wallet ON session_keys(wallet_id);
CREATE INDEX IF NOT EXISTS idx_session_keys_active ON session_keys(is_active, expires_at)
    WHERE is_active = true;

-- Payment receipts
CREATE INDEX IF NOT EXISTS idx_receipts_payment ON payment_receipts(payment_id);
CREATE INDEX IF NOT EXISTS idx_receipts_user ON payment_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_merchant ON payment_receipts(merchant_id);

-- Anchor transactions
CREATE INDEX IF NOT EXISTS idx_anchor_tx_user ON anchor_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_anchor_tx_status ON anchor_transactions(status)
    WHERE status NOT IN ('completed', 'refunded', 'expired', 'error');

-- Analytics snapshots
CREATE INDEX IF NOT EXISTS idx_analytics_merchant_date ON analytics_snapshots(merchant_id, snapshot_date);

-- Churn risk scores
CREATE INDEX IF NOT EXISTS idx_churn_risk_merchant ON churn_risk_scores(merchant_id, risk_score DESC);

-- Webhook event queue
CREATE INDEX IF NOT EXISTS idx_webhook_queue_pending ON webhook_event_queue(status, next_retry_at)
    WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_webhook_queue_merchant ON webhook_event_queue(merchant_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER trg_smart_wallets_updated_at
    BEFORE UPDATE ON smart_wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_anchor_tx_updated_at
    BEFORE UPDATE ON anchor_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
