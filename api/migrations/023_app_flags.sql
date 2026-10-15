-- 023_app_flags.sql
-- Global app feature / bot capability flags + audit log.
-- Additive and idempotent: safe to re-run. Service-role only (RLS on, no policies).
-- Code falls back to built-in defaults if this migration has not been applied yet.

CREATE TABLE IF NOT EXISTS public.app_flags (
  key         TEXT PRIMARY KEY,
  enabled     BOOLEAN NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('feature', 'bot')),
  updated_by  UUID REFERENCES auth.users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_flag_audit (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL REFERENCES public.app_flags(key),
  old_value   BOOLEAN,
  new_value   BOOLEAN NOT NULL,
  reason      TEXT NOT NULL,
  changed_by  UUID REFERENCES auth.users(id),
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_flag_audit_key_changed
  ON public.app_flag_audit (key, changed_at DESC);

ALTER TABLE public.app_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_flag_audit ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated JWT clients cannot read or write.
-- Only the service-role client (api/db.js) can access these tables.

INSERT INTO public.app_flags (key, enabled, category) VALUES
  ('bank_sync',              true,  'feature'),
  ('invoicing',              true,  'feature'),
  ('mileage',                true,  'feature'),
  ('gear_depreciation',      true,  'feature'),
  ('tax_review',             true,  'feature'),
  ('ai_assistant',           true,  'feature'),
  ('bot_security_reviews',   true,  'bot'),
  ('bot_saas_management',    true,  'bot'),
  ('bot_readonly_ops',       true,  'bot'),
  ('bot_require_human_confirm', false, 'bot')
ON CONFLICT (key) DO NOTHING;

-- Atomic flag flip + audit row. Rejects empty reason.
-- SECURITY DEFINER so it can write under RLS; revoke execute from PUBLIC / authenticated.
CREATE OR REPLACE FUNCTION public.set_app_flag(
  p_key     TEXT,
  p_enabled BOOLEAN,
  p_reason  TEXT,
  p_actor   UUID DEFAULT NULL
)
RETURNS public.app_flags
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old     BOOLEAN;
  v_row     public.app_flags%ROWTYPE;
  v_reason  TEXT := btrim(COALESCE(p_reason, ''));
BEGIN
  IF v_reason = '' THEN
    RAISE EXCEPTION 'reason is required' USING ERRCODE = '22023';
  END IF;

  IF p_key IS NULL OR btrim(p_key) = '' THEN
    RAISE EXCEPTION 'key is required' USING ERRCODE = '22023';
  END IF;

  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'enabled is required' USING ERRCODE = '22023';
  END IF;

  SELECT enabled INTO v_old
  FROM public.app_flags
  WHERE key = p_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown flag key: %', p_key USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.app_flags
  SET enabled = p_enabled,
      updated_by = p_actor,
      updated_at = now()
  WHERE key = p_key
  RETURNING * INTO v_row;

  INSERT INTO public.app_flag_audit (key, old_value, new_value, reason, changed_by)
  VALUES (p_key, v_old, p_enabled, v_reason, p_actor);

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_app_flag(TEXT, BOOLEAN, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_app_flag(TEXT, BOOLEAN, TEXT, UUID) TO service_role;
