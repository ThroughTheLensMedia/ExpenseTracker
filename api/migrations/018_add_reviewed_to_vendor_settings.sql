-- Lets a user dismiss a vendor's "Review" flag in Operational Intelligence
-- (raised when a vendor has fewer than 6 charges seen but averages over $20/mo —
-- not enough history yet to confirm it's a real recurring subscription).
-- Previously there was no way to clear this flag short of the vendor
-- accumulating 6+ charges on its own.
ALTER TABLE vendor_settings ADD COLUMN IF NOT EXISTS is_reviewed boolean DEFAULT false;
