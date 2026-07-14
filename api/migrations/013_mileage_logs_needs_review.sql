-- 013_mileage_logs_needs_review.sql
-- Flags AI-logged mileage trips where the Distance Matrix lookup failed and
-- the exact mileage couldn't be calculated — logged as 0 mi pending manual
-- correction, instead of dropping the trip entirely — v7.19.0
-- Idempotent, safe to re-run.

ALTER TABLE mileage_logs ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT false;
