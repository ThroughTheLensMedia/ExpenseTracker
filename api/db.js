const { createClient } = require("@supabase/supabase-js");

// Standardize variable names
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;

if (url && key) {
  try {
    supabase = createClient(url, key);
  } catch (e) {
    console.error("[DB] Client Error:", e.message);
  }
}

module.exports = { 
  supabase,
  initDb: () => !!supabase
};