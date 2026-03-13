const { createClient } = require("@supabase/supabase-js");

// Load Environment Variables
// For local dev, we might have VITE_ prefixes in web-react/.env or standard keys in api/.env
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log("[DB] Client initialized successfully.");
  } catch (e) {
    console.error("[DB] Fatal Client Error:", e.message);
  }
}

module.exports = { 
  supabase,
  initDb: () => {
    if (!supabaseUrl) console.warn("[DB] SUPABASE_URL is missing.");
    if (!supabaseKey) console.warn("[DB] SUPABASE_KEY is missing.");
  }
};