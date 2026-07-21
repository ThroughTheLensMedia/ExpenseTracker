-- Adds admin-settable display_name override to user_subscriptions.
-- Root cause fix: api/routes/admin.js PATCH /admin/subscriptions/:userId has always
-- attempted to write display_name here; the column never existed, so every
-- SaaS admin "Edit Session" save failed with a schema-cache error.
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS display_name TEXT;
