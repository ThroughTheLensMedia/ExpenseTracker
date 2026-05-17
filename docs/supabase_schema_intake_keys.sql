-- ============================================================
-- Lumière Ledger — Intake Keys Schema
-- Multi-tenant website lead capture integration
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS intake_keys (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    key          TEXT        NOT NULL UNIQUE,
    label        TEXT        NOT NULL DEFAULT 'Website Integration',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

-- Fast lookup on every form submission
CREATE INDEX IF NOT EXISTS intake_keys_key_idx ON intake_keys(key);

-- RLS: users can only manage their own keys
ALTER TABLE intake_keys ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'intake_keys'
        AND policyname = 'Users manage own intake keys'
    ) THEN
        CREATE POLICY "Users manage own intake keys"
            ON intake_keys FOR ALL
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END
$$;

-- Service role bypass (for intake.js key lookup via server-side client)
-- No additional policy needed — service role bypasses RLS by design.
