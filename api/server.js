// Load environment variables (Fails gracefully if .env is missing)
require("dotenv").config(); 

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

// Initialize Database
initDb();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));

// Serve static receipts (optional: could be moved behind auth if stored locally)
const RECEIPT_DIR = process.env.RECEIPT_DIR || (process.env.VERCEL ? "/tmp/receipts" : path.join(__dirname, "receipts"));
try {
  if (!fs.existsSync(RECEIPT_DIR)) fs.mkdirSync(RECEIPT_DIR, { recursive: true });
} catch (e) {
  console.error("Failed to create receipts directory:", e);
}
app.use("/receipts", express.static(RECEIPT_DIR));

// Routing
const apiRouter = express.Router();

// Public Health check
apiRouter.get("/health", async (req, res) => {
  try {
    const db = require("./db");
    res.json({
      ok: true,
      environment: process.env.VERCEL ? "vercel" : "local",
      lockdown: "enabled",
      mailer: !!process.env.RESEND_API_KEY,
      db: !!db.supabase,
      diagnostics: {
        has_url: !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
        has_key: !!(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY),
        node_env: process.env.NODE_ENV
      },
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: "Health check logic failed", detail: e.message });
  }
});

const licensingMiddleware = require("./middleware/licensing");

// --- ATTACH LOCKDOWN MIDDLEWARE ---
// Every route below this line is protected by Supabase Auth
apiRouter.use(authMiddleware);

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
apiRouter.use("/pwa", pwaRouter);
apiRouter.use("/settings", settingsRouter);
apiRouter.use("/subscription", subscriptionRouter);

// Mount all API routes under /api
app.use("/api", apiRouter);

// Top-level health check
app.get("/health", (_req, res) => res.json({ ok: true }));

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