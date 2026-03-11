-- Supabase SQL Schema extension for Leads & CRM Console
-- Copy and paste this into your Supabase SQL Editor to create the new tables.

-- 9. Leads & CRM Table
CREATE TABLE IF NOT EXISTS leads (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  client_id BIGINT REFERENCES clients(id) ON DELETE SET NULL, -- Optional link to an existing client
  name TEXT NOT NULL,          -- Lead Name or Project Name (e.g., "John & Jane Wedding")
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  project_type TEXT NOT NULL DEFAULT 'Other',
  quoted_value_cents BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'New Lead', -- Allowed: 'New Lead', 'Quoted', 'Booked', 'Paid', 'Lost'
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for performant Kanban queries
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- Note: In a production Supabase app, you'd add RLS policies here to restrict access to authenticated users.
-- ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
