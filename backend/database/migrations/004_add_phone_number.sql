-- ============================================================
-- MIGRATION 004: Add Phone Number for WhatsApp
-- ============================================================

-- Add phone_number to users table for WhatsApp notifications
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

-- Update the notification_type and channel constraints in notification_log
-- Since we cannot alter a check constraint directly, we drop it and recreate it.
-- First drop the channel constraint:
ALTER TABLE notification_log DROP CONSTRAINT IF EXISTS notification_log_channel_check;

-- Add it back with 'whatsapp' included:
ALTER TABLE notification_log ADD CONSTRAINT notification_log_channel_check 
CHECK (channel IN ('email', 'webhook', 'push', 'console', 'whatsapp'));
