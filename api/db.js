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

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("CRITICAL: Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.");
}

// Ensure URL is valid before creating client
let supabase;
try {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    // Return a proxy to prevent crashes on chained calls like supabase.from().select().order()...
    const mock = () => mock;
    supabase = new Proxy({}, {
      get: () => {
        return new Proxy(() => { }, {
          get: () => mock,
          apply: () => new Proxy({}, { get: () => mock })
        });
      }
    });
  }
} catch (e) {
  console.error("Failed to initialize Supabase client:", e);
}

module.exports = { supabase, initDb: () => { } };