-- Migration: 009_user_categories
-- Adds user-managed custom categories (expense / income / misc_income)
-- Safe to re-run (idempotent)

CREATE TABLE IF NOT EXISTS user_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('expense', 'income', 'misc_income')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, name)
);

ALTER TABLE user_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_categories' AND policyname = 'user_categories_own'
  ) THEN
    CREATE POLICY "user_categories_own" ON user_categories
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END
$$;
