-- Phase 1 of the Operational Intelligence accuracy fix:
-- (1) billing_cycle lets a recurring transaction declare its real cadence
--     (monthly/quarterly/annual) instead of the dashboard guessing by
--     dividing total spend by occurrence count — the bug that showed an
--     annual domain renewal (Hover) as if it cost that amount every month.
-- (2) vendor_aliases lets a user manually merge vendor name variants
--     (e.g. "Starlink" + "Starlink Internet", "Apple"/"Apple Services"/
--     "Apple iCloud") under one canonical name for recurring-spend rollups,
--     mirroring the existing account_aliases pattern.
-- Additive only — no existing row or query is affected until a value is set.

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS billing_cycle TEXT;

CREATE TABLE IF NOT EXISTS vendor_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    vendor_key TEXT NOT NULL,
    canonical_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, vendor_key)
);

ALTER TABLE vendor_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_aliases_self ON vendor_aliases;
CREATE POLICY vendor_aliases_self ON vendor_aliases
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
