-- Receipt token column for per-user email forwarding addresses
-- Run once in Supabase SQL editor
-- Idempotent: safe to re-run

ALTER TABLE settings ADD COLUMN IF NOT EXISTS receipt_token TEXT;

CREATE INDEX IF NOT EXISTS idx_settings_receipt_token ON settings(receipt_token);
