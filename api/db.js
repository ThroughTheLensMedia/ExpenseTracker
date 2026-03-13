/**
 * db.js
 * Supabase client initialization
 *
 * Version: v3.0.0-supabase
 * Updated: 2026-03-05
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || "").trim();
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("CRITICAL: Missing core Supabase environment variables.");
}

// Ensure URL is valid before creating client
let supabase = null;
try {
  if (SUPABASE_URL && (SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY)) {
    const key = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
    supabase = createClient(SUPABASE_URL, key);
  }
} catch (e) {
  console.error("Failed to initialize Supabase client:", e);
}

module.exports = { supabase, initDb: () => { } };