-- Migration 002: RLS policies for account_aliases + confirm linked_source column
-- Run once in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Idempotent — safe to re-run.
--
-- NOTE: The Express API uses the service role key which bypasses RLS.
-- These policies enforce row isolation at the DB level for any direct
-- Supabase client access and follow the same pattern as all other user tables.

-- Enable RLS (safe if already on)
ALTER TABLE account_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_aliases FORCE ROW LEVEL SECURITY;

-- Confirm linked_source column exists (added in v7.8.30 migration)
ALTER TABLE account_aliases ADD COLUMN IF NOT EXISTS linked_source TEXT;

-- Drop any existing policies by either naming convention (safe on first run)
DROP POLICY IF EXISTS "account_aliases_user_select" ON account_aliases;
DROP POLICY IF EXISTS "account_aliases_user_insert" ON account_aliases;
DROP POLICY IF EXISTS "account_aliases_user_update" ON account_aliases;
DROP POLICY IF EXISTS "account_aliases_user_delete" ON account_aliases;
DROP POLICY IF EXISTS "account_aliases_select"       ON account_aliases;
DROP POLICY IF EXISTS "account_aliases_insert"       ON account_aliases;
DROP POLICY IF EXISTS "account_aliases_update"       ON account_aliases;
DROP POLICY IF EXISTS "account_aliases_delete"       ON account_aliases;

-- Users can only see their own aliases
CREATE POLICY "account_aliases_user_select" ON account_aliases
    FOR SELECT USING (user_id = auth.uid());

-- Users can only create aliases for themselves
CREATE POLICY "account_aliases_user_insert" ON account_aliases
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can only update their own aliases
CREATE POLICY "account_aliases_user_update" ON account_aliases
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Users can only delete their own aliases
CREATE POLICY "account_aliases_user_delete" ON account_aliases
    FOR DELETE USING (user_id = auth.uid());

-- Verify: run this SELECT to confirm policies were created
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'account_aliases';
