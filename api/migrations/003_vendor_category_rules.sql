-- Migration 003: vendor_category_rules — auto-categorization memory
-- Run once in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Idempotent: safe to re-run even if bare CREATE TABLE was already executed.
--
-- How it works:
--   • Every time a user edits a transaction's category, tax flag, or business %,
--     the normalized vendor name + those values are upserted here.
--   • On every Plaid sync, new transactions are checked against this table.
--     If a match is found, the user's preferred values are applied automatically.

CREATE TABLE IF NOT EXISTS vendor_category_rules (
    user_id          UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    vendor_pattern   TEXT         NOT NULL,
    category         TEXT,
    tax_deductible   BOOLEAN,
    business_use_pct INT,
    tax_bucket       TEXT,
    match_count      INT          NOT NULL DEFAULT 1,
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Add primary key if missing (handles case where bare table was already created)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name   = 'vendor_category_rules'
          AND constraint_type = 'PRIMARY KEY'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE vendor_category_rules
            ADD PRIMARY KEY (user_id, vendor_pattern);
    END IF;
END $$;

-- Fast lookup index for sync-time rule application
CREATE INDEX IF NOT EXISTS idx_vendor_rules_lookup
    ON vendor_category_rules (user_id, vendor_pattern);

-- RLS: users can only see and modify their own rules
ALTER TABLE vendor_category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_category_rules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_rules_select" ON vendor_category_rules;
DROP POLICY IF EXISTS "vendor_rules_insert" ON vendor_category_rules;
DROP POLICY IF EXISTS "vendor_rules_update" ON vendor_category_rules;
DROP POLICY IF EXISTS "vendor_rules_delete" ON vendor_category_rules;

CREATE POLICY "vendor_rules_select" ON vendor_category_rules
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "vendor_rules_insert" ON vendor_category_rules
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "vendor_rules_update" ON vendor_category_rules
    FOR UPDATE
    USING     (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "vendor_rules_delete" ON vendor_category_rules
    FOR DELETE USING (user_id = auth.uid());

-- Verify: run this SELECT to confirm
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'vendor_category_rules';
