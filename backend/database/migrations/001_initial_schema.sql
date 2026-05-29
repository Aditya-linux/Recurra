-- ============================================================
-- RECURRA — PostgreSQL Database Schema
-- Version: 1.0.0
-- Security: Row-level validation, proper indexes, constraints
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLE 1: USERS
-- ============================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(56) UNIQUE NOT NULL, -- Stellar G-address or C-address
    email VARCHAR(255),
    name VARCHAR(255),
    c_address VARCHAR(56),  -- Smart account C-address (if upgraded)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT chk_wallet_address_format CHECK (
        wallet_address ~ '^[GC][A-Z2-7]{55}$'
    )
);

-- ============================================================
-- TABLE 2: MERCHANTS
-- ============================================================
CREATE TABLE merchants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(56) UNIQUE NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    business_email VARCHAR(255),
    business_url VARCHAR(500),
    logo_url VARCHAR(500),
    kyc_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (kyc_status IN ('pending', 'submitted', 'approved', 'rejected')),
    country_code CHAR(2),
    gst_number VARCHAR(15),
    webhook_url VARCHAR(500),
    webhook_secret VARCHAR(128),
    api_key_hash VARCHAR(128), -- bcrypt hashed API key
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_merchant_wallet CHECK (
        wallet_address ~ '^[GC][A-Z2-7]{55}$'
    )
);

-- ============================================================
-- TABLE 3: PLANS
-- ============================================================
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id_on_chain VARCHAR(64) UNIQUE NOT NULL, -- e.g. PLAN_1
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    amount BIGINT NOT NULL CHECK (amount > 0), -- Smallest token unit
    token_address VARCHAR(56) NOT NULL,
    interval_seconds INTEGER NOT NULL CHECK (interval_seconds >= 3600),
    max_payments INTEGER DEFAULT 0, -- 0 = infinite
    is_active BOOLEAN DEFAULT true,
    metadata_uri VARCHAR(500),
    subscriber_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE 4: SUBSCRIPTIONS
-- ============================================================
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id_on_chain VARCHAR(64) UNIQUE, -- Nullable: set when on-chain tx is confirmed
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id),
    merchant_id UUID NOT NULL REFERENCES merchants(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'cancelled', 'expired', 'past_due', 'trialing')),
    start_time TIMESTAMPTZ NOT NULL,
    next_payment_time TIMESTAMPTZ NOT NULL,
    payments_made INTEGER DEFAULT 0,
    grace_period_end TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE 5: PAYMENTS
-- ============================================================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id),
    transaction_hash VARCHAR(64) UNIQUE, -- Stellar tx hash
    amount BIGINT NOT NULL,
    fee_amount BIGINT DEFAULT 0,
    token_address VARCHAR(56) NOT NULL,
    from_address VARCHAR(56) NOT NULL,
    to_address VARCHAR(56) NOT NULL,
    payment_number INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    failure_reason TEXT,
    executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Idempotency constraint
    CONSTRAINT uq_payment_idempotency UNIQUE (subscription_id, payment_number)
);

-- ============================================================
-- TABLE 6: WEBHOOK ENDPOINTS
-- ============================================================
CREATE TABLE webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    secret VARCHAR(128) NOT NULL, -- HMAC signing secret
    events TEXT[] NOT NULL DEFAULT '{}', -- Array of event types
    is_active BOOLEAN DEFAULT true,
    last_delivery_status VARCHAR(20),
    last_delivery_at TIMESTAMPTZ,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE 7: WEBHOOK DELIVERIES (Audit Log)
-- ============================================================
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id),
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    attempt_number INTEGER DEFAULT 1,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE 8: EVENT LOG (Blockchain Sync)
-- ============================================================
CREATE TABLE event_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(50) NOT NULL,
    contract_address VARCHAR(56) NOT NULL,
    ledger_sequence BIGINT NOT NULL,
    transaction_hash VARCHAR(64),
    event_data JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Prevent duplicate event processing
    CONSTRAINT uq_event UNIQUE (contract_address, ledger_sequence, event_type)
);

-- ============================================================
-- INDEXES (Performance-Critical)
-- ============================================================

-- User dashboard queries
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_user_status ON subscriptions(user_id, status);

-- Merchant subscriber list
CREATE INDEX idx_subscriptions_merchant ON subscriptions(merchant_id);
CREATE INDEX idx_subscriptions_merchant_status ON subscriptions(merchant_id, status);

-- Keeper: find due payments (CRITICAL for performance)
CREATE INDEX idx_subscriptions_due_payments 
    ON subscriptions(next_payment_time, status) 
    WHERE status IN ('active', 'past_due');

-- Payment history
CREATE INDEX idx_payments_subscription ON payments(subscription_id);
CREATE INDEX idx_payments_tx_hash ON payments(transaction_hash);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_executed_at ON payments(executed_at);

-- Merchant plans
CREATE INDEX idx_plans_merchant ON plans(merchant_id);
CREATE INDEX idx_plans_active ON plans(is_active) WHERE is_active = true;

-- Webhook queries
CREATE INDEX idx_webhooks_merchant ON webhook_endpoints(merchant_id);
CREATE INDEX idx_webhook_deliveries_endpoint ON webhook_deliveries(webhook_endpoint_id);

-- Event log: indexer checkpoint
CREATE INDEX idx_events_unprocessed ON event_log(processed, ledger_sequence) 
    WHERE processed = false;
CREATE INDEX idx_events_contract ON event_log(contract_address, ledger_sequence);

-- ============================================================
-- TRIGGERS: Auto-update timestamps
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_merchants_updated_at
    BEFORE UPDATE ON merchants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_plans_updated_at
    BEFORE UPDATE ON plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_webhooks_updated_at
    BEFORE UPDATE ON webhook_endpoints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED DATA (Development Only)
-- ============================================================

-- NOTE: Remove this section before production deployment
-- INSERT statements for test data will be in a separate seed file
