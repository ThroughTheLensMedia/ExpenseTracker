-- Security review completion log
-- Run once in Supabase SQL editor
-- Idempotent: safe to re-run

CREATE TABLE IF NOT EXISTS security_reviews (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    review_type TEXT        NOT NULL CHECK (review_type IN ('weekly','monthly','quarterly','annual','dependency')),
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_by UUID        REFERENCES auth.users(id),
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Admin-only access via service role — no RLS needed
-- Index for fast "most recent per type" queries
CREATE INDEX IF NOT EXISTS idx_security_reviews_type_completed
    ON security_reviews (review_type, completed_at DESC);
