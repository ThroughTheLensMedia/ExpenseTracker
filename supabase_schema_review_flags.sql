-- Lumière Ledger — Near-Duplicate Review Flags Migration
-- Idempotent: safe to run multiple times.
-- Adds needs_review and review_pair_id to expenses for tip-amount near-duplicate flagging.

-- Flag that this row has a potential near-duplicate pending user review
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE;

-- Shared UUID linking two near-duplicate rows together for side-by-side review
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS review_pair_id UUID;

-- Index for fast lookups when resolving a pair or rendering the review filter
CREATE INDEX IF NOT EXISTS idx_expenses_needs_review ON expenses (user_id, needs_review) WHERE needs_review = TRUE;
CREATE INDEX IF NOT EXISTS idx_expenses_review_pair_id ON expenses (review_pair_id) WHERE review_pair_id IS NOT NULL;
