-- ============================================================
-- MIGRATION 006: Auto-Renew Feature
-- Adds auto_renew column to subscriptions table
-- ============================================================

-- Default to true: all existing and new subscriptions auto-renew by default
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT true;

-- Index for keeper queries that filter by auto_renew
CREATE INDEX IF NOT EXISTS idx_subscriptions_auto_renew ON subscriptions(auto_renew)
    WHERE status IN ('active', 'past_due');
