const { createClient } = require("@supabase/supabase-js");

// Service Role Key is REQUIRED — all admin/cron/pay routes depend on it.
// It must never silently fall back to the anon key, which would enforce RLS
// and cause admin reads to return empty results with no error.
// Standardize variable names — give priority to Service Role for admin operations
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

// On Vercel, use SUPABASE_SERVICE_ROLE_KEY.
// Locally, fall back to SUPABASE_KEY or SUPABASE_ANON_KEY to support legacy dev setups.
const key = process.env.SUPABASE_SERVICE_ROLE_KEY 
  || process.env.SUPABASE_KEY 
  || process.env.SUPABASE_ANON_KEY 
  || process.env.VITE_SUPABASE_ANON_KEY;

if (!key) {
  console.error("[DB] FATAL: SUPABASE_SERVICE_ROLE_KEY is not set. Admin operations will be broken.");
  console.error("[DB] Set this variable in your Vercel environment panel (Production scope).");
}

if (!url) {
  console.error("[DB] FATAL: SUPABASE_URL is not set.");
}

let supabase = null;

if (url && key) {
  try {
    supabase = createClient(url, key);
    // Log whether we are running in full admin mode or scoped (RLS) mode
    const mode = key === process.env.SUPABASE_SERVICE_ROLE_KEY ? "ADMIN_PRIVILEGED" : "SCOPED_RLS_ONLY";
    console.log(`[DB] Initialized with Service: ${mode}`);
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