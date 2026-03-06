-- Supabase SQL Schema for Expense Tracker

-- 1. Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  expense_date DATE NOT NULL,
  vendor TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  amount_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  rm_id TEXT UNIQUE, -- Unique constraint for RocketMoney imports
  tax_deductible BOOLEAN NOT NULL DEFAULT FALSE,
  tax_bucket TEXT NOT NULL DEFAULT '',
  business_use_pct SMALLINT NOT NULL DEFAULT 100,
  receipt_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Classification Rules Table
CREATE TABLE IF NOT EXISTS classification_rules (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  match_column TEXT NOT NULL,         -- 'vendor', 'notes'
  match_type TEXT NOT NULL,           -- 'contains', 'exact'
  match_value TEXT NOT NULL,          -- e.g. 'Adobe'
  assign_category TEXT NOT NULL DEFAULT '',
  assign_tax_bucket TEXT NOT NULL DEFAULT '',
  assign_tax_deductible BOOLEAN NOT NULL DEFAULT FALSE,
  assign_business_use_pct SMALLINT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_tax_bucket ON expenses(tax_bucket);

-- 4. Enable Row Level Security (RLS) - Optional but recommended for Supabase
-- ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE classification_rules ENABLE ROW LEVEL SECURITY;

-- Note: In a production Supabase app, you'd add policies here to restrict access to authenticated users.
