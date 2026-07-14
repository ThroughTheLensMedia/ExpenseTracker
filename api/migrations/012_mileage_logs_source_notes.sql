-- 012_mileage_logs_source_notes.sql
-- Distinguishes AI Brain-logged mileage trips from manual entries, and stores
-- a separate business-purpose note so the weekly digest can flag AI-logged
-- trips missing one — v7.18.0
-- Idempotent, safe to re-run.

ALTER TABLE mileage_logs ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE mileage_logs ADD COLUMN IF NOT EXISTS notes TEXT;
