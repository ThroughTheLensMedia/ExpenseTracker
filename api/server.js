/**
 * server.js
 * API for Expense Tracker (Refactored)
 *
 * Version: v3.0.0
 * Updated: 2026-03-05
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const { initDb } = require("./db");
const expenseRouter = require("./routes/expenses");
const taxRouter = require("./routes/tax");
const importRouter = require("./routes/import");
const receiptsRouter = require("./routes/receipts");
const rulesRouter = require("./routes/rules");
const mileageRouter = require("./routes/mileage");

// Initialize Database
initDb();

const app = express();
const PORT = process.env.PORT || 3000;

// Debug log for Vercel
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));

// Security validation for Cloudflare Access (disabled by default, configurable)
// If you enable Enforce JWT on Cloudflare, we must validate the header here
const REQUIRE_CF_JWT = process.env.REQUIRE_CF_JWT === "true";

if (REQUIRE_CF_JWT) {
  const jwt = require("jsonwebtoken");
  const jwksClient = require("jwks-rsa");

  // e.g "https://<your-team-name>.cloudflareaccess.com/cdn-cgi/access/certs"
  const CERTS_URL = process.env.CF_CERTS_URL;
  const AUDIENCE = process.env.CF_AUDIENCE;

  const client = jwksClient({ jwksUri: CERTS_URL });
  function getKey(header, callback) {
    client.getSigningKey(header.kid, (err, key) => {
      if (err) return callback(err);
      const signingKey = key.getPublicKey();
      callback(null, signingKey);
    });
  }

  app.use((req, res, next) => {
    // Correctly bypass health check even with /api prefix
    if (req.path === "/health" || req.path === "/api/health") return next();

    const token = req.cookies?.CF_Authorization || req.headers["cf-access-jwt-assertion"];
    if (!token) return res.status(403).json({ error: "Missing Cloudflare Access Token" });

    jwt.verify(token, getKey, { audience: AUDIENCE }, (err, decoded) => {
      if (err) return res.status(403).json({ error: "Invalid Cloudflare Access Token" });
      req.user = decoded;
      next();
    });
  });
}

// Serve static receipts
const RECEIPT_DIR = process.env.RECEIPT_DIR || (process.env.VERCEL ? "/tmp/receipts" : path.join(__dirname, "receipts"));
try {
  if (!fs.existsSync(RECEIPT_DIR)) fs.mkdirSync(RECEIPT_DIR, { recursive: true });
} catch (e) {
  console.error("Failed to create receipts directory:", e);
}
app.use("/receipts", express.static(RECEIPT_DIR));

// Routing
const apiRouter = express.Router();

// Health check inside apiRouter for /api/health
apiRouter.get("/health", (_req, res) => res.json({ ok: true, environment: process.env.VERCEL ? "vercel" : "local" }));

// Standard routes
apiRouter.use("/expenses", expenseRouter);
apiRouter.use("/tax", taxRouter);
apiRouter.use("/import", importRouter);
apiRouter.use("/receipts", receiptsRouter);
apiRouter.use("/rules", rulesRouter);
apiRouter.use("/mileage", mileageRouter);

// Mount all API routes under /api
app.use("/api", apiRouter);

// Top-level health check (for convenience)
app.get("/health", (_req, res) => res.json({ ok: true }));

// Global Error Handler - Very Verbose for Vercel Debugging
app.use((err, req, res, next) => {
  console.error("--- UNHANDLED ERROR ---");
  console.error("Path:", req.path);
  console.error("Error:", err);
  if (err.stack) console.error(err.stack);
  console.error("-----------------------");

  res.status(500).json({
    error: "Internal Server Error",
    message: err.message,
    path: req.path,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

module.exports = app;

if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`);
    if (REQUIRE_CF_JWT) console.log("Cloudflare JWT Verification ENABLED.");
  });
}