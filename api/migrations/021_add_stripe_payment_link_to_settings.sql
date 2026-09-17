-- Migration 021: Add stripe_payment_link to settings
-- Allows users to save a direct Stripe Payment Link (e.g. https://buy.stripe.com/...)
-- Idempotent and safe to run multiple times.

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS stripe_payment_link TEXT;
