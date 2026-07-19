-- ============================================================
-- MIGRATION 005: Treasury Fee Tracking
-- Tracks every 0.5% protocol fee collected by Recurra treasury
-- ============================================================

CREATE TABLE IF NOT EXISTS treasury_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES payments(id),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id),
    fee_amount BIGINT NOT NULL CHECK (fee_amount >= 0),
    token_address VARCHAR(56) NOT NULL,
    transaction_hash VARCHAR(64),
    treasury_wallet VARCHAR(56) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate fee records for the same payment
CREATE UNIQUE INDEX IF NOT EXISTS idx_treasury_payment_unique
    ON treasury_transactions(payment_id);

-- Query by date range for dashboard
CREATE INDEX IF NOT EXISTS idx_treasury_created
    ON treasury_transactions(created_at);

-- Query by token for multi-token fee breakdown
CREATE INDEX IF NOT EXISTS idx_treasury_token
    ON treasury_transactions(token_address);
