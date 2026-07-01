// ─── User directory — replaces the nonexistent `profiles` table ────────────
// cron.js and admin.js report routes used to query a `profiles` table for
// { id, email, display_name } that was never created in this Supabase
// project (only `user_roles` exists, and it has no email/display_name
// columns). Confirmed via Vercel runtime errors 2026-07-01 — the monthly
// report cron threw PGRST205 on every run and never sent.
//
// Fix: use Supabase's own Auth admin API, which is always authoritative for
// user id + email, instead of a table that doesn't exist. Requires the
// service-role client (supabase.auth.admin.* is not available to anon keys).
'use strict';

async function listAllUsers(supabase) {
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;
    return (data?.users || []).map(u => ({
        id: u.id,
        email: u.email,
        display_name: u.user_metadata?.display_name || u.user_metadata?.full_name || null,
    }));
}

module.exports = { listAllUsers };
