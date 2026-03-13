const { createClient } = require("@supabase/supabase-js");

// Standard Vercel Environment Access
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (e) {
    console.error("[DB] Failed to create client:", e.message);
  }
}

module.exports = { 
  supabase,
  initDb: () => {
    if (!supabaseUrl || !supabaseKey) {
      console.error("[DB] CRITICAL: Environment variables missing at runtime!");
    }
  }
};