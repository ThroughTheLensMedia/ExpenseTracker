// Load environment variables (graceful — no .env in Vercel production)
try { require("dotenv").config(); } catch (e) { /* env vars come from Vercel dashboard */ }

// Catch silent crashes that would otherwise produce a 500 with no log
process.on('uncaughtException',  (err) => console.error('[FATAL] uncaughtException',  err?.message, err?.stack));
process.on('unhandledRejection', (reason) => console.error('[FATAL] unhandledRejection', reason?.message || reason));

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { initDb, supabase } = require("./db");
const authMiddleware = require("./middleware/auth");

function safeRequire(path) {
  try { return require(path); }
  catch(e) { console.error(`[STARTUP] FATAL require failed: ${path} — ${e.message}`); return null; }
}

const expenseRouter      = safeRequire("./routes/expenses");
const taxRouter          = safeRequire("./routes/tax");
const importRouter       = safeRequire("./routes/import");
const receiptsRouter     = safeRequire("./routes/receipts");
const rulesRouter        = safeRequire("./routes/rules");
const mileageRouter      = safeRequire("./routes/mileage");
const assetsRouter       = safeRequire("./routes/assets");
const invoiceRouter      = safeRequire("./routes/invoices");
const adminRouter        = safeRequire("./routes/admin");
const leadsRouter        = safeRequire("./routes/leads");
const pwaRouter          = safeRequire("./routes/pwa");
const settingsRouter     = safeRequire("./routes/settings");
const subscriptionRouter = safeRequire("./routes/subscription");
const activityRouter     = safeRequire("./routes/activity");
const brainRouter        = safeRequire("./routes/brain");
const plaidRouter        = safeRequire("./routes/plaid");
const payRouter          = safeRequire("./routes/pay");
const intakeRouter       = safeRequire("./routes/intake");
const intakeKeysRouter   = safeRequire("./routes/intake-keys");
const stripeImport       = safeRequire("./routes/stripe");
const stripeRouter       = stripeImport?.router || null;
const stripeWebhook      = stripeImport?.stripeWebhook || null;
const emailInboundRouter = safeRequire("./routes/emailInbound");
const metricsRouter      = safeRequire("./routes/metrics");
const vendorsRouter      = safeRequire("./routes/vendors");
const feedbackRouter     = safeRequire("./routes/feedback");
const accountsRouter     = safeRequire("./routes/accounts");
const documentsRouter    = safeRequire("./routes/documents");

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
if (stripeWebhook) app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhook);

app.use(express.json({ limit: "10mb" }));

// Request tracer — first middleware, logs every incoming request so we can confirm Express is receiving them
app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.path}`);
  next();
});

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
      routes: {
        expenses: !!expenseRouter, tax: !!taxRouter, import: !!importRouter,
        receipts: !!receiptsRouter, rules: !!rulesRouter, mileage: !!mileageRouter,
        assets: !!assetsRouter, invoices: !!invoiceRouter, admin: !!adminRouter,
        leads: !!leadsRouter, pwa: !!pwaRouter, settings: !!settingsRouter,
        subscription: !!subscriptionRouter, activity: !!activityRouter,
        brain: !!brainRouter, plaid: !!plaidRouter, pay: !!payRouter,
        intake: !!intakeRouter, stripe: !!stripeRouter, emailInbound: !!emailInboundRouter,
        metrics: !!metricsRouter, vendors: !!vendorsRouter, feedback: !!feedbackRouter,
        accounts: !!accountsRouter, documents: !!documentsRouter,
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
if (payRouter)          apiRouter.use("/pay", payRouter);
if (intakeRouter)       apiRouter.use("/intake", intakeRouter);
const cronRouter = safeRequire("./routes/cron");
if (cronRouter)         apiRouter.use("/cron", cronRouter);
if (emailInboundRouter) apiRouter.use("/receipts/email-inbound", emailInboundRouter);

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
if (feedbackRouter) apiRouter.use("/feedback", feedbackRouter);

// --- ATTACH LICENSING MIDDLEWARE ---
// Every route below this line is restricted by subscription status
apiRouter.use(licensingMiddleware);

// Standard routes (now using authenticated clients via req.sb)
if (expenseRouter)      apiRouter.use("/expenses",      expenseRouter);
if (taxRouter)          apiRouter.use("/tax",            taxRouter);
if (importRouter)       apiRouter.use("/import",         importRouter);
if (receiptsRouter)     apiRouter.use("/receipts",       receiptsRouter);
if (rulesRouter)        apiRouter.use("/rules",          rulesRouter);
if (mileageRouter)      apiRouter.use("/mileage",        mileageRouter);
if (assetsRouter)       apiRouter.use("/assets",         assetsRouter);
if (invoiceRouter)      apiRouter.use("/invoices",       invoiceRouter);
if (adminRouter)        apiRouter.use("/admin",          adminRouter);
if (leadsRouter)        apiRouter.use("/leads",          leadsRouter);
if (intakeKeysRouter)   apiRouter.use("/intake-keys",    intakeKeysRouter);
if (pwaRouter)          apiRouter.use("/pwa",            pwaRouter);
if (settingsRouter)     apiRouter.use("/settings",       settingsRouter);
if (subscriptionRouter) apiRouter.use("/subscription",   subscriptionRouter);
if (activityRouter)     apiRouter.use("/activity",       activityRouter);
if (brainRouter)        apiRouter.use("/brain",          brainRouter);
if (plaidRouter)        apiRouter.use("/plaid",          plaidRouter);
if (stripeRouter)       apiRouter.use("/stripe",         stripeRouter);
if (metricsRouter)      apiRouter.use("/metrics",        metricsRouter);
if (vendorsRouter)      apiRouter.use("/vendors",        vendorsRouter);
if (accountsRouter)     apiRouter.use("/accounts",       accountsRouter);
if (documentsRouter)    apiRouter.use("/documents",      documentsRouter);

// Mount all API routes under /api
// Mount all API routes under /api AND root (for Vercel flexibility)
app.use("/api", apiRouter);
app.use("/", apiRouter);

// Top-level health check
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/api/test-direct", (req, res) => res.json({ ok: true, source: "direct-server-hit" }));

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[SERVER] Unhandled error', {
    path: req.path,
    method: req.method,
    error: err.message,
    user: req.user?.id ?? 'unauthenticated',
  });
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