-- 025: Supabase security advisor fixes (applied to production 2026-10-15)
-- 1) SECURITY DEFINER functions must not be callable via PostgREST by anon/authenticated.
--    handle_new_user runs only as an auth.users trigger (on_auth_user_created /
--    on_auth_user_confirmed); triggers do not need EXECUTE for the calling role.
--    tc_* functions are only used server-side (service_role) by trading-cockpit.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

REVOKE EXECUTE ON FUNCTION public.tc_claim_signal_dedupe(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.tc_claim_signal_dedupe(text, text, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.tc_reserve_api_budget(text, timestamptz, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.tc_reserve_api_budget(text, timestamptz, integer, integer) TO service_role;

-- 2) Pin search_path (vector extension lives in public).
ALTER FUNCTION public.match_document_chunks(vector, uuid, integer) SET search_path = public, pg_catalog;
