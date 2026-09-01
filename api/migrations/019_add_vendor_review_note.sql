-- Flags a newly-imported transaction whose vendor string closely resembles
-- an existing recurring vendor but doesn't exactly match it (e.g. a bank
-- descriptor variant like "HOVER 4212 DR MARTIN LUTHER KI..." vs "Hover").
-- Catches vendor-name fragmentation at import time instead of it silently
-- skewing recurring-vendor math later. Nullable text — null means no flag.
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vendor_review_note text;
