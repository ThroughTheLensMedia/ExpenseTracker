-- system_logs table — persistent structured logging
-- 7-day retention enforced by logger.js cleanup on each write
-- Run once in Supabase SQL editor

CREATE TABLE IF NOT EXISTS system_logs (
    id          BIGSERIAL PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    level       TEXT NOT NULL DEFAULT 'info',   -- 'info' | 'warn' | 'error'
    source      TEXT NOT NULL,                  -- 'email-inbound' | 'plaid' | 'auth' | etc.
    message     TEXT NOT NULL,
    metadata    JSONB,                          -- arbitrary structured data (parsed values, error details, etc.)
    user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS system_logs_created_at_idx ON system_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS system_logs_source_idx     ON system_logs (source);
CREATE INDEX IF NOT EXISTS system_logs_level_idx      ON system_logs (level);
CREATE INDEX IF NOT EXISTS system_logs_user_id_idx    ON system_logs (user_id);
