-- ============================================================
-- MIGRATION 002: Merchant Platform Redirect
-- Adds platform URL and redirect fields to merchants and plans
-- ============================================================

-- Merchant platform identity and redirect configuration
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS platform_url VARCHAR(500);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS platform_name VARCHAR(100);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS platform_logo_url VARCHAR(500);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS redirect_url_template VARCHAR(500);
  -- Template supports placeholder: https://netflix.com/activate?wallet={wallet}&ref=recurra

-- Plan-specific redirect URLs (overrides merchant-level template)
ALTER TABLE plans ADD COLUMN IF NOT EXISTS redirect_url VARCHAR(500);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS redirect_label VARCHAR(100) DEFAULT 'Go to Platform';
