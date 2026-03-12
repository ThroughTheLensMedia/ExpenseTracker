const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

/**
 * Middleware to authenticate Supabase users.
 * It extracts the JWT from the Authorization header and verifies it.
 * It then attaches a per-request Supabase client (authenticated as the user) to req.sb
 */
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // For now, let's just log and block. 
    // In a "Dev Mode" we could allow a bypass, but for a Lockdown, we block.
    return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Create a temporary client with the user's token to verify identity
    const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error } = await tempClient.auth.getUser();

    if (error || !user) {
      throw new Error("Invalid session");
    }

    // Attach user and the authenticated client to the request
    req.user = user;
    req.sb = tempClient; // This client will respect RLS!
    
    next();
  } catch (err) {
    console.error("[AUTH] Verification failed:", err.message);
    res.status(401).json({ error: "Session expired or invalid" });
  }
}

module.exports = authMiddleware;
