-- pending_receipts: holds email-forwarded receipts that haven't matched a transaction yet.
-- Matched on next Plaid sync by amount_cents + receipt_date ± 3 days.
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS pending_receipts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor       TEXT,
  receipt_date DATE,
  amount_cents BIGINT,
  file_path    TEXT,
  raw_subject  TEXT,
  raw_sender   TEXT,
  needs_review BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pending_receipts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pending_receipts' AND policyname = 'Users see own pending receipts'
  ) THEN
    CREATE POLICY "Users see own pending receipts"
      ON pending_receipts FOR ALL
      USING (user_id = auth.uid());
  END IF;
END$$;
