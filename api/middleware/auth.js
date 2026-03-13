const { createClient } = require("@supabase/supabase-js");

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Access Token Missing" });
  }

  const token = authHeader.split(" ")[1];
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return res.status(500).json({ error: "System Configuration Error: Keys Missing" });
  }

  try {
    const tempClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error } = await tempClient.auth.getUser();

    if (error || !user) {
      return res.status(401).json({ error: "Session Expired" });
    }

    req.user = user;
    req.sb = tempClient; // Per-request client for RLS
    
    next();
  } catch (err) {
    console.error("[AUTH] Fatal:", err.message);
    res.status(500).json({ error: "Internal Auth Failure" });
  }
}

module.exports = authMiddleware;
