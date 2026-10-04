-- 021_crm_import.sql
-- Import from another system (v7.30.0) — contacts + invoices.
-- Additive and idempotent: safe to re-run, drops nothing, rewrites no existing data.

-- 1. One row per uploaded file that was committed. Drives Import History + Undo.
CREATE TABLE IF NOT EXISTS import_batches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type   TEXT NOT NULL CHECK (entity_type IN ('contacts', 'invoices', 'vendors', 'expenses')),
  source_system TEXT NOT NULL DEFAULT 'generic',
  filename      TEXT,
  status        TEXT NOT NULL DEFAULT 'committed' CHECK (status IN ('committed', 'undone')),
  counts        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  undone_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_import_batches_user_created ON import_batches (user_id, created_at DESC);

ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "import_batches_own" ON import_batches;
CREATE POLICY "import_batches_own" ON import_batches
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 2. Provenance columns on existing tables (all nullable / defaulted — no backfill needed).
ALTER TABLE clients  ADD COLUMN IF NOT EXISTS legacy_id       TEXT;
ALTER TABLE clients  ADD COLUMN IF NOT EXISTS import_source   TEXT;
ALTER TABLE clients  ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS legacy_id            TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS import_source        TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS import_batch_id      UUID REFERENCES import_batches(id) ON DELETE SET NULL;
-- "Still open in the old system" tracking flag. Cleared only by the user, never automatically.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS legacy_open          BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS legacy_balance_cents BIGINT;

CREATE INDEX IF NOT EXISTS idx_clients_user_legacy   ON clients  (user_id, legacy_id) WHERE legacy_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_import_batch  ON clients  (import_batch_id)    WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_user_legacy  ON invoices (user_id, legacy_id) WHERE legacy_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_import_batch ON invoices (import_batch_id)    WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_legacy_open  ON invoices (user_id)            WHERE legacy_open;

-- 3. Holding area: columns from the old system that have no direct home in Ledger.
-- Kept in its own table (not a jsonb column on clients/invoices) so the existing
-- `select *` list endpoints never drag ~100 extra fields per invoice to the browser.
CREATE TABLE IF NOT EXISTS import_holding (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('client', 'invoice', 'vendor', 'expense')),
  entity_id   TEXT NOT NULL,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  batch_id    UUID REFERENCES import_batches(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_import_holding_batch ON import_holding (batch_id) WHERE batch_id IS NOT NULL;

ALTER TABLE import_holding ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "import_holding_own" ON import_holding;
CREATE POLICY "import_holding_own" ON import_holding
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 4. Client tax IDs (TaxID / TIN / SSN-type columns). libsodium-encrypted by the API
-- (same ENCRYPTION_KEY pattern as Plaid tokens). Separate table so `clients(*)` selects
-- never return the ciphertext. last4 is stored only for masked display.
CREATE TABLE IF NOT EXISTS client_tax_ids (
  client_id        BIGINT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tax_id_encrypted TEXT NOT NULL,
  last4            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE client_tax_ids ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "client_tax_ids_own" ON client_tax_ids;
CREATE POLICY "client_tax_ids_own" ON client_tax_ids
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
