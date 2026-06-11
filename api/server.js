// Load environment variables (graceful — no .env in Vercel production)
try { require("dotenv").config(); } catch (e) { /* env vars come from Vercel dashboard */ }

// Catch silent crashes that would otherwise produce a 500 with no log
process.on('uncaughtException',  (err) => {
    console.error('[FATAL] uncaughtException', err?.message, err?.stack);
    try { require('./utils/logger').error('server', 'uncaughtException', { error: err?.message, stack: err?.stack }); } catch (_) {}
});
process.on('unhandledRejection', (reason) => {
    console.error('[FATAL] unhandledRejection', reason?.message || reason);
    try { require('./utils/logger').error('server', 'unhandledRejection', { error: reason?.message || String(reason) }); } catch (_) {}
});

const express = require("express");
const cors = require("cors");
const path = require("path");
const { waitUntil } = require("@vercel/functions");
const fs = require("fs");
const { initDb, supabase } = require("./db");
const authMiddleware = require("./middleware/auth");

// Static requires — each is a literal string so Vercel's bundler (ncc) can trace them.
// DO NOT replace with a safeRequire(variable) wrapper — dynamic require() breaks ncc bundling.
let expenseRouter;      try { expenseRouter      = require("./routes/expenses");    } catch(e) { console.error('[STARTUP] FAIL expenses:',    e.message); }
let taxRouter;          try { taxRouter          = require("./routes/tax");         } catch(e) { console.error('[STARTUP] FAIL tax:',         e.message); }
let importRouter;       try { importRouter       = require("./routes/import");      } catch(e) { console.error('[STARTUP] FAIL import:',      e.message); }
let receiptsRouter;     try { receiptsRouter     = require("./routes/receipts");    } catch(e) { console.error('[STARTUP] FAIL receipts:',    e.message); }
let rulesRouter;        try { rulesRouter        = require("./routes/rules");       } catch(e) { console.error('[STARTUP] FAIL rules:',       e.message); }
let mileageRouter;      try { mileageRouter      = require("./routes/mileage");     } catch(e) { console.error('[STARTUP] FAIL mileage:',     e.message); }
let assetsRouter;       try { assetsRouter       = require("./routes/assets");      } catch(e) { console.error('[STARTUP] FAIL assets:',      e.message); }
let invoiceRouter;      try { invoiceRouter      = require("./routes/invoices");    } catch(e) { console.error('[STARTUP] FAIL invoices:',    e.message); }
let adminRouter;        try { adminRouter        = require("./routes/admin");       } catch(e) { console.error('[STARTUP] FAIL admin:',       e.message); }
let leadsRouter;        try { leadsRouter        = require("./routes/leads");       } catch(e) { console.error('[STARTUP] FAIL leads:',       e.message); }
let pwaRouter;          try { pwaRouter          = require("./routes/pwa");         } catch(e) { console.error('[STARTUP] FAIL pwa:',         e.message); }
let settingsRouter;     try { settingsRouter     = require("./routes/settings");    } catch(e) { console.error('[STARTUP] FAIL settings:',    e.message); }
let subscriptionRouter; try { subscriptionRouter = require("./routes/subscription");} catch(e) { console.error('[STARTUP] FAIL subscription:', e.message); }
let activityRouter;     try { activityRouter     = require("./routes/activity");    } catch(e) { console.error('[STARTUP] FAIL activity:',    e.message); }
let brainRouter;        try { brainRouter        = require("./routes/brain");       } catch(e) { console.error('[STARTUP] FAIL brain:',       e.message); }
let plaidRouter;        try { plaidRouter        = require("./routes/plaid");       } catch(e) { console.error('[STARTUP] FAIL plaid:',       e.message); }
let payRouter;          try { payRouter          = require("./routes/pay");         } catch(e) { console.error('[STARTUP] FAIL pay:',         e.message); }
let intakeRouter;       try { intakeRouter       = require("./routes/intake");      } catch(e) { console.error('[STARTUP] FAIL intake:',      e.message); }
let intakeKeysRouter;   try { intakeKeysRouter   = require("./routes/intake-keys"); } catch(e) { console.error('[STARTUP] FAIL intake-keys:', e.message); }
let stripeRouter, stripeWebhook;
try {
  const stripeImport = require("./routes/stripe");
  stripeRouter  = stripeImport?.router || null;
  stripeWebhook = stripeImport?.stripeWebhook || null;
} catch(e) { console.error('[STARTUP] FAIL stripe:', e.message); }
let metricsRouter;      try { metricsRouter      = require("./routes/metrics");     } catch(e) { console.error('[STARTUP] FAIL metrics:',     e.message); }
let vendorsRouter;      try { vendorsRouter      = require("./routes/vendors");     } catch(e) { console.error('[STARTUP] FAIL vendors:',     e.message); }
let feedbackRouter;     try { feedbackRouter     = require("./routes/feedback");    } catch(e) { console.error('[STARTUP] FAIL feedback:',    e.message); }
let pendingReceiptsRouter; try { pendingReceiptsRouter = require("./routes/pendingReceipts"); } catch(e) { console.error('[STARTUP] FAIL pendingReceipts:', e.message); }
let accountsRouter;     try { accountsRouter     = require("./routes/accounts");    } catch(e) { console.error('[STARTUP] FAIL accounts:',    e.message); }
let documentsRouter;    try { documentsRouter    = require("./routes/documents");   } catch(e) { console.error('[STARTUP] FAIL documents:',   e.message); }
let categoriesRouter;   try { categoriesRouter   = require("./routes/categories");  } catch(e) { console.error('[STARTUP] FAIL categories:',  e.message); }

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

// Routing
const apiRouter = express.Router();

// Lightweight keep-alive endpoint — hit by Vercel cron every 5 minutes to prevent cold starts.
// No DB calls, no auth, returns instantly.
apiRouter.get("/ping", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// Public Health check
apiRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    environment: process.env.VERCEL ? "vercel" : "local",
    mailer: !!process.env.RESEND_API_KEY,
    db: !!supabase,
    timestamp: new Date().toISOString()
  });
});

const { licensingMiddleware } = require("./middleware/licensing");

// --- PUBLIC ROUTES (no auth required) ---
// Must be mounted BEFORE authMiddleware
if (payRouter)          apiRouter.use("/pay", payRouter);
if (intakeRouter)       apiRouter.use("/intake", intakeRouter);
let cronRouter; try { cronRouter = require("./routes/cron"); } catch(e) { console.error('[STARTUP] FAIL cron:', e.message); }
if (cronRouter)         apiRouter.use("/cron", cronRouter);
// emailInbound mounted unconditionally at app level below — see route block after apiRouter definition

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

// Validate beta code — public, read-only, no auth required
apiRouter.get("/subscription/validate-code/:code", async (req, res) => {
  const { supabase: serviceClient } = require("./db");
  if (!serviceClient) return res.status(500).json({ valid: false, reason: "Server error" });
  try {
    const code = (req.params.code || '').toUpperCase().trim();
    if (!code) return res.status(400).json({ valid: false, reason: "Code required" });
    const { data, error } = await serviceClient
      .from('beta_codes')
      .select('code, plan_type, valid_until, is_used')
      .eq('code', code)
      .single();
    if (error || !data) return res.json({ valid: false, reason: "Invalid code" });
    if (data.is_used) return res.json({ valid: false, reason: "Code has already been redeemed" });
    if (data.valid_until && new Date(data.valid_until) < new Date()) {
      return res.json({ valid: false, reason: "Code has expired" });
    }
    res.json({ valid: true, plan_type: data.plan_type || 'beta_tester' });
  } catch (e) {
    res.status(500).json({ valid: false, reason: "Server error" });
  }
});

// --- ATTACH LOCKDOWN MIDDLEWARE ---
// Every route below this line is protected by Supabase Auth
apiRouter.use(authMiddleware);

// Feedback — auth required, not license-gated (any user can report issues)
if (feedbackRouter) apiRouter.use("/feedback", feedbackRouter);

// Pending receipts — auth required, not license-gated
if (pendingReceiptsRouter) apiRouter.use("/receipts/pending", pendingReceiptsRouter);

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
if (categoriesRouter)   apiRouter.use("/categories",     categoriesRouter);

// emailInbound — static require (ncc must trace deps at build time — dynamic require breaks bundling).
// Route registered UNCONDITIONALLY — no if() guard. res.sendStatus(200) fires before any processing
// so Postmark always gets 200 even if the module failed to load at startup.
let _emailInboundProcessor = null;
try { _emailInboundProcessor = require("./routes/emailInbound"); } catch(e) { console.error('[STARTUP] FAIL emailInbound:', e.message, e.stack); }
app.post("/api/receipts/email-inbound", (req, res) => {
    res.sendStatus(200);
    if (!_emailInboundProcessor) { console.error('[EmailInbound] Handler not loaded — check startup errors'); return; }
    // waitUntil tells Vercel to keep the Lambda alive until the promise resolves.
    // Without this, Vercel freezes the Lambda after res.send() and Gemini never completes.
    waitUntil(_emailInboundProcessor(req).catch(e => console.error('[EmailInbound] Error:', e.message, e.stack)));
});

// Mount all API routes under /api
app.use("/api", apiRouter);

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