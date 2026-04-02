const { createClient } = require("@supabase/supabase-js");

// Service Role Key is REQUIRED — all admin/cron/pay routes depend on it.
// It must never silently fall back to the anon key, which would enforce RLS
// and cause admin reads to return empty results with no error.
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  console.error("[DB] FATAL: SUPABASE_SERVICE_ROLE_KEY is not set. Admin operations will be broken.");
  console.error("[DB] Set this variable in your Vercel environment panel (Production scope).");
  // Do not throw — allow server to boot so /api/health still responds with diagnostics.
  // But supabase client will be null and routes will return 503.
}

if (!url) {
  console.error("[DB] FATAL: SUPABASE_URL is not set.");
}

let supabase = null;

if (url && serviceKey) {
  try {
    supabase = createClient(url, serviceKey);
    console.log("[DB] Initialized with Service Role (ADMIN_PRIVILEGED).");
  } catch (e) {
    console.error("[DB] Client Error:", e.message);
  }
}

module.exports = {
  supabase,
  initDb: () => {
    if (!supabase) {
      console.error("[DB] initDb() — client is null. Check SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL.");
      return false;
    }
    return true;
  }
};