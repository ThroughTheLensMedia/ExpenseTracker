const { createClient } = require("@supabase/supabase-js");

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Access Token Missing" });
  }

  const token = authHeader.split(" ")[1];
  // SECURITY: Both conditions must be true for dev bypass to activate.
  // Using OR (||) means it fires if EITHER is true — which includes Vercel preview deployments.
  // Using AND (&&) means it only fires locally where VERCEL is unset AND NODE_ENV is not production.
  const isLocalDev = !process.env.VERCEL && process.env.NODE_ENV !== 'production';

  // 1. Local Developer Bypass
  if (isLocalDev && token === "mock-session") {
    req.user = { 
        id: "f129a00b-333e-4d43-98b7-08ca1161d765", 
        email: "joshua.deuermeyer@gmail.com", 
        user_metadata: { display_name: "Developer Mode" } 
    };
    req.sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    return next();
  }

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

/**
 * requireRole(...allowedRoles)
 * Middleware that checks user's role against allowed list.
 * Must be used AFTER authMiddleware; short-circuits with 403 if role doesn't match.
 *
 * Usage: router.get("/admin", requireRole('admin'), handler)
 */
function requireRole(...allowedRoles) {
    return async (req, res, next) => {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        try {
            const { data: roleRecord, error } = await req.sb
                .from("user_roles")
                .select("role")
                .eq("user_id", req.user.id)
                .single();

            if (error || !roleRecord) {
                console.warn(`[AUTH] User ${req.user.id} has no role record`);
                return res.status(403).json({ error: "Access Denied" });
            }

            if (!allowedRoles.includes(roleRecord.role)) {
                console.warn(`[AUTH] User ${req.user.id} (${roleRecord.role}) denied access; required: ${allowedRoles.join(' or ')}`);
                return res.status(403).json({ error: "Admin access required" });
            }

            req.userRole = roleRecord.role;
            next();
        } catch (err) {
            console.error("[AUTH] Role check failed:", err.message);
            res.status(500).json({ error: "Role verification failed" });
        }
    };
}

// Export as default for backward compatibility, plus named export for requireRole
module.exports = authMiddleware;
module.exports.requireRole = requireRole;
