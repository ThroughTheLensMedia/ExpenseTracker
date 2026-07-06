-- 011_brain_messages.sql
-- Persistent AI Brain conversation history — v7.16.0
-- Idempotent, safe to re-run.

CREATE TABLE IF NOT EXISTS brain_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brain_messages_user_created ON brain_messages (user_id, created_at DESC);

ALTER TABLE brain_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brain_messages_own" ON brain_messages;
CREATE POLICY "brain_messages_own" ON brain_messages
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
