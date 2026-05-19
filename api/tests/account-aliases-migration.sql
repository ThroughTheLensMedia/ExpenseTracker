-- account_aliases migration
-- Run in Supabase SQL editor → New query → Run
-- Idempotent: safe to re-run

CREATE TABLE IF NOT EXISTS account_aliases (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_key   TEXT        NOT NULL,
    display_name TEXT,                          -- null = use auto-detected label
    visible      BOOLEAN     NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ DEFAULT now(),
    updated_at   TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, source_key)
);

ALTER TABLE account_aliases ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'account_aliases' AND policyname = 'account_aliases_self'
    ) THEN
        CREATE POLICY account_aliases_self ON account_aliases
            FOR ALL USING (user_id = auth.uid())
            WITH CHECK (user_id = auth.uid());
    END IF;
END $$;
