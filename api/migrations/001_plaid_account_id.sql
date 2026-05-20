-- Migration 001: Add plaid_account_id to expenses
-- Run once in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Idempotent — safe to re-run.

ALTER TABLE expenses
    ADD COLUMN IF NOT EXISTS plaid_account_id TEXT;

-- Index for sub-account transaction filtering
CREATE INDEX IF NOT EXISTS idx_expenses_plaid_account_id
    ON expenses (user_id, plaid_account_id)
    WHERE plaid_account_id IS NOT NULL;

-- After running this migration:
-- 1. Deploy v7.8.4+ (Plaid sync will start storing plaid_account_id on new transactions)
-- 2. Existing Plaid transactions will have NULL plaid_account_id until next sync
-- 3. Trigger a manual sync from the Accounts page to backfill recent transactions
