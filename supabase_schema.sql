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

-- 3. Mileage Logs Table
CREATE TABLE IF NOT EXISTS mileage_logs (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  log_date DATE NOT NULL,
  miles numeric(10, 2) NOT NULL DEFAULT 0,
  purpose TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Mileage Rates Table (IRS Standard Business Mileage Rates)
CREATE TABLE IF NOT EXISTS mileage_rates (
  year INTEGER PRIMARY KEY,
  rate_per_mile NUMERIC(5, 4) NOT NULL, -- e.g. 0.7000 = $0.70/mile
  source TEXT NOT NULL DEFAULT 'IRS',
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed with known IRS rates (cents converted to dollars)
INSERT INTO mileage_rates (year, rate_per_mile, source) VALUES
  (2019, 0.58, 'IRS IR-2018-251'),
  (2020, 0.575, 'IRS IR-2019-215'),
  (2021, 0.56, 'IRS IR-2020-279'),
  (2022, 0.625, 'IRS IR-2022-124 (mid-year increase)'),
  (2023, 0.655, 'IRS IR-2022-234'),
  (2024, 0.67, 'IRS IR-2023-239'),
  (2025, 0.70, 'IRS IR-2024-312')
ON CONFLICT (year) DO NOTHING;

-- 5. Equipment Assets Table (for depreciation tracking — Section 179 or straight-line)
CREATE TABLE IF NOT EXISTS equipment_assets (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  purchase_date DATE NOT NULL,
  vendor TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Other',  -- Camera, Lens, Drone, Laptop, Flash, Gimbal, etc.
  cost_cents BIGINT NOT NULL DEFAULT 0,
  serial_number TEXT NOT NULL DEFAULT '',
  receipt_on_file BOOLEAN NOT NULL DEFAULT FALSE,
  depreciation_method TEXT NOT NULL DEFAULT 'straight_line', -- 'straight_line' | 'section_179'
  useful_life_years SMALLINT NOT NULL DEFAULT 5,
  disposal_date DATE,                   -- Date item was sold or retired
  disposal_value_cents BIGINT,          -- Resale price / salvage value
  receipt_link TEXT,                    -- Link to purchase receipt
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assets_date ON equipment_assets(purchase_date);

-- 6. Clients Table
CREATE TABLE IF NOT EXISTS clients (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  client_id BIGINT REFERENCES clients(id),
  invoice_number TEXT UNIQUE NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'sent', 'paid', 'void'
  notes TEXT,
  tax_percent NUMERIC(5,2) DEFAULT 0,
  discount_cents BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Invoice Items Table
CREATE TABLE IF NOT EXISTS invoice_items (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  invoice_id BIGINT REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price_cents BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_tax_bucket ON expenses(tax_bucket);
CREATE INDEX IF NOT EXISTS idx_mileage_logs_date ON mileage_logs(log_date);

-- 5. Enable Row Level Security (RLS) - Optional but recommended for Supabase
-- ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE classification_rules ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE mileage_logs ENABLE ROW LEVEL SECURITY;

-- Note: In a production Supabase app, you'd add policies here to restrict access to authenticated users.
