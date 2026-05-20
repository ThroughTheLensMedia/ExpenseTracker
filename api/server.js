// Load environment variables (graceful — no .env in Vercel production)
try { require("dotenv").config(); } catch (e) { /* env vars come from Vercel dashboard */ }

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const { initDb, supabase } = require("./db");
const authMiddleware = require("./middleware/auth");

const expenseRouter = require("./routes/expenses");
const taxRouter = require("./routes/tax");
const importRouter = require("./routes/import");
const receiptsRouter = require("./routes/receipts");
const rulesRouter = require("./routes/rules");
const mileageRouter = require("./routes/mileage");
const assetsRouter = require("./routes/assets");
const invoiceRouter = require("./routes/invoices");
const adminRouter = require("./routes/admin");
const leadsRouter = require("./routes/leads");
const pwaRouter = require("./routes/pwa");
const settingsRouter = require("./routes/settings");
const subscriptionRouter = require("./routes/subscription");
const activityRouter = require("./routes/activity");
const brainRouter = require("./routes/brain"); // AI Intelligence Engine
const plaidRouter = require("./routes/plaid"); // Plaid Bank Sync
const payRouter = require("./routes/pay");    // Public Payment Portal (no auth)
const intakeRouter     = require("./routes/intake");      // Public TTLM website lead intake (no auth)
const intakeKeysRouter = require("./routes/intake-keys"); // Authenticated key management
const { router: stripeRouter, stripeWebhook } = require("./routes/stripe"); // Stripe billing
const metricsRouter = require("./routes/metrics"); // Dashboard metrics layer
const vendorsRouter = require("./routes/vendors"); // Vendor specific settings
const feedbackRouter = require("./routes/feedback"); // In-app feedback form
const accountsRouter = require("./routes/accounts"); // Accounts page summary

// Initialize Database — log clearly if it fails
if (!initDb()) {
  console.error("[STARTUP] Database client failed to initialize. Check SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL in Vercel env.");
}

const app = express();
const PORT = process.env.PORT || 3000;

const ALLOWED_ORIGINS = [
  'https://www.lumiereledger.com',
  'https://lumiereledger.com',
  'https://app.throughthelens.media',
  'http://localhost:5173',
  'http://localhost:3000',
];
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || ALLOWED_ORIGINS.includes(origin)),
  credentials: true,
}));
// Stripe webhook MUST be mounted before express.json() — raw body required for signature verification
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhook);

app.use(express.json({ limit: "10mb" }));

// Routing
const apiRouter = express.Router();

// Lightweight keep-alive endpoint — hit by Vercel cron every 5 minutes to prevent cold starts.
// No DB calls, no auth, returns instantly.
apiRouter.get("/ping", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// Public Health check
apiRouter.get("/health", async (req, res) => {
  try {
    res.json({
      ok: true,
      environment: process.env.VERCEL ? "vercel" : "local",
      lockdown: "enabled",
      mailer: !!process.env.RESEND_API_KEY,
      db: !!supabase,
      diagnostics: {
        has_url: !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
        has_key: !!(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY),
        has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        key_mode: process.env.SUPABASE_SERVICE_ROLE_KEY ? "ADMIN_PRIVILEGED" : "STANDARD_USER",
        node_env: process.env.NODE_ENV
      },
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: "Health check logic failed", detail: e.message });
  }
});

const { licensingMiddleware } = require("./middleware/licensing");

// --- PUBLIC ROUTES (no auth required) ---
// Must be mounted BEFORE authMiddleware
apiRouter.use("/pay", payRouter);
apiRouter.use("/intake", intakeRouter); // TTLM website booking form → Lumiere Ledger
apiRouter.use("/cron", require("./routes/cron")); // CRON_SECRET auth — no JWT needed

// Account Request — public form that emails the admin
apiRouter.post("/account-request", async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: "Name and email are required." });

    const { sendHealthAlertEmail } = require("./utils/mailer");
    const adminEmail = "joshua.deuermeyer@gmail.com";
    const html = `
      <div style="background:#0f172a;color:white;padding:40px;font-family:'Inter',sans-serif;border-radius:12px;max-width:600px;">
        <h2 style="color:#f97316;margin:0 0 20px;">NEW LUMIÈRE LEDGER ACCOUNT REQUEST</h2>
        <div style="background:rgba(255,255,255,0.05);padding:20px;border-radius:10px;margin-bottom:20px;">
          <p style="margin:0 0 10px;"><strong style="color:#38bdf8;">Name:</strong> ${name}</p>
          <p style="margin:0;"><strong style="color:#38bdf8;">Email:</strong> ${email}</p>
        </div>
        <p style="color:#94a3b8;font-size:13px;">This request was submitted from the Lumière Ledger login page. To onboard this user, generate an Access Key in the Ledger Control Center and send it to their email.</p>
      </div>
    `;

    const { Resend } = require("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.RESEND_FROM || "Lumière Ledger <support@throughthelens.media>",
      to: [adminEmail],
      subject: "NEW LUMIÈRE LEDGER ACCOUNT REQUEST",
      html
    });

    res.json({ success: true });
  } catch (err) {
    console.error("[ACCOUNT-REQUEST]", err);
    res.status(500).json({ error: "Failed to send request." });
  }
});

// --- ATTACH LOCKDOWN MIDDLEWARE ---
// Every route below this line is protected by Supabase Auth
apiRouter.use(authMiddleware);

// Feedback — auth required, not license-gated (any user can report issues)
apiRouter.use("/feedback", feedbackRouter);

// --- ATTACH LICENSING MIDDLEWARE ---
// Every route below this line is restricted by subscription status
apiRouter.use(licensingMiddleware);

// Standard routes (now using authenticated clients via req.sb)
apiRouter.use("/expenses", expenseRouter);
apiRouter.use("/tax", taxRouter);
apiRouter.use("/import", importRouter);
apiRouter.use("/receipts", receiptsRouter);
apiRouter.use("/rules", rulesRouter);
apiRouter.use("/mileage", mileageRouter);
apiRouter.use("/assets", assetsRouter);
apiRouter.use("/invoices", invoiceRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/leads", leadsRouter);
apiRouter.use("/intake-keys", intakeKeysRouter);
apiRouter.use("/pwa", pwaRouter);
apiRouter.use("/settings", settingsRouter);
apiRouter.use("/subscription", subscriptionRouter);
apiRouter.use("/activity", activityRouter);
apiRouter.use("/brain", brainRouter);
apiRouter.use("/plaid", plaidRouter);
apiRouter.use("/stripe", stripeRouter);
apiRouter.use("/metrics", metricsRouter);
apiRouter.use("/vendors", vendorsRouter);
apiRouter.use("/accounts", accountsRouter);

// Mount all API routes under /api
// Mount all API routes under /api AND root (for Vercel flexibility)
app.use("/api", apiRouter);
app.use("/", apiRouter);

// Top-level health check
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/api/test-direct", (req, res) => res.json({ ok: true, source: "direct-server-hit" }));

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("--- UNHANDLED ERROR ---");
  console.error("Path:", req.path);
  console.error("Error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message
  });
});

module.exports = app;

if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`API listening on port ${PORT} [LOCKDOWN MODE]`);
  });
}