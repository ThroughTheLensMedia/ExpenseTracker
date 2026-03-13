const { createClient } = require("@supabase/supabase-js");

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Access Token Missing" });
  }

  const token = authHeader.split(" ")[1];
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.warn("[AUTH] Configuration failure: URL or ANON_KEY is missing from process.env");
    return res.status(503).json({ 
      error: "Service Unavailable: API configuration is incomplete.",
      detail: "Supabase credentials not found on server."
    });
  }

  try {
    const tempClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error } = await tempClient.auth.getUser();

    if (error || !user) {
      return res.status(401).json({ error: "Session Expired or Invalid Token" });
    }

    req.user = user;
    req.sb = tempClient; // Per-request client for RLS
    
    next();
  } catch (err) {
    console.error("[AUTH] Fatal Runtime Error:", err.message);
    res.status(500).json({ error: "Internal Auth Failure", message: err.message });
  }
}

module.exports = authMiddleware;
