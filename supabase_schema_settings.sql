-- Supabase SQL Schema extension for Global Settings
-- Copy and paste this into your Supabase SQL Editor to create the new table.

CREATE TABLE IF NOT EXISTS settings (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  business_name TEXT NOT NULL DEFAULT '',
  contact_name TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  tax_id TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'USD',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed with a default row if empty
INSERT INTO settings (business_name, contact_name)
SELECT 'My Photography Studio', 'Owner Name'
WHERE NOT EXISTS (SELECT 1 FROM settings);
