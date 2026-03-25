-- ═══════════════════════════════════════════════════════
-- Plaid Integration Schema
-- Run this migration to enable bank auto-sync via Plaid
-- ═══════════════════════════════════════════════════════

-- 1. Plaid Connections table (stores access tokens per linked bank)
CREATE TABLE IF NOT EXISTS plaid_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    item_id TEXT NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    institution_id TEXT,
    institution_name TEXT DEFAULT 'Unknown Bank',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'error')),
    cursor TEXT,  -- Plaid sync cursor for incremental fetches
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_plaid_connections_user ON plaid_connections(user_id);
CREATE INDEX idx_plaid_connections_status ON plaid_connections(user_id, status);

-- 2. Add plaid_transaction_id column to expenses (for dedup & sync)
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS plaid_transaction_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_expenses_plaid_txn ON expenses(plaid_transaction_id)
WHERE plaid_transaction_id IS NOT NULL;

-- 3. RLS Policies for plaid_connections
ALTER TABLE plaid_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plaid connections"
    ON plaid_connections FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plaid connections"
    ON plaid_connections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plaid connections"
    ON plaid_connections FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own plaid connections"
    ON plaid_connections FOR DELETE
    USING (auth.uid() = user_id);
