-- invoice_number was globally unique across ALL tenants instead of per-user,
-- causing cross-tenant collisions (e.g. every new user's default first
-- invoice number "INV-1001" could only ever be used by one account, total).
-- Applied directly to production 2026-08-06.
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_user_invoice_number_key'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_user_invoice_number_key UNIQUE (user_id, invoice_number);
  END IF;
END $$;
