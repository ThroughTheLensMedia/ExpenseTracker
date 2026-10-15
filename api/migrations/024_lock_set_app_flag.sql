-- 024: set_app_flag is SECURITY DEFINER; only the API (service_role) may call it.
-- (applied to production 2026-10-15)
REVOKE EXECUTE ON FUNCTION public.set_app_flag(text, boolean, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.set_app_flag(text, boolean, text, uuid) TO service_role;
