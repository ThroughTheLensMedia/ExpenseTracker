# Fix Roadmap — Phase 1 & 2

**Last updated:** 2026-04-06

---

## Status Legend
- ✅ Done
- 🔲 Not started
- ⚠️ Partial / needs verification

---

## Immediate Blockers

| Item | Status | Notes |
|------|--------|-------|
| Query param auth removed from admin.js | ✅ | `req.query.auth` bypass removed |
| RLS bypass fixed in admin.js | ✅ | `.neq("id", "-1")` removed |
| Email queueing implemented | ✅ | `emailQueue.js` created, Bull-based |
| Plaid token encryption | ⚠️ | `cryptoUtil.js` is a **stub** — throws if called. Real libsodium-wrappers implementation required when Plaid work begins (2+ months out) |

---

## Environment / Ops (NOT in original roadmap — fix before deploying)

| Item | Status | Notes |
|------|--------|-------|
| `api/.env` created with real Supabase credentials | ✅ | File was missing entirely |
| Root `.env` duplicate placeholder lines removed | ✅ | Placeholder values were overriding real credentials |
| `file-type` installed | ✅ | `npm install --save file-type` — verify it's in package.json |
| `bull` installed | ✅ | `npm install --save bull` — verify it's in package.json |
| `user_roles` table created in Supabase | ✅ | Table created, Joshua inserted as admin. Verified via SQL editor. |
| Redis running locally for Bull queue | ✅ | Installed via Homebrew, running as background service |
| Vercel env vars: `REDIS_URL` | 🔲 | Not in Vercel production env panel — email queue will fail in prod |
| Vercel env vars: `ENCRYPTION_KEY` | 🔲 | Not in Vercel production env panel — required when Plaid work begins |

**user_roles table SQL (run in Supabase if missing):**
```sql
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Insert Joshua as admin (replace with actual user_id from auth.users)
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'joshua.deuermeyer@gmail.com'
ON CONFLICT DO NOTHING;
```

---

## Phase 1 Fixes

### Batch 1A: Auth Infrastructure

| Item | Status | Notes |
|------|--------|-------|
| 1A-1a: `requireRole()` middleware in auth.js | ✅ | Dual export pattern — backward compatible |
| 1A-1b: admin.js — Replace 10 hardcoded email checks with `requireRole('admin')` | ✅ | All 10 routes updated. `/daily-report` retains cron bypass; other 9 use `requireRole('admin')` middleware. |
| 1A-2: pay.js — Add `user_id` filter to payment token lookup | ✅ | Hardened via invoices logic |

**Routes needing `requireRole('admin')` in admin.js:**
1. Line 20: `GET /daily-report`
2. Line 127: `GET /check-status`
3. Line 287: `GET /subscriptions`
4. Line 322: `PATCH /subscriptions/:userId`
5. Line 368: `GET /weekly-report`
6. Line 423: `GET /beta-codes`
7. Line 444: `POST /beta-codes`
8. Line 483: `PATCH /beta-codes/:code`
9. Line 503: `POST /beta-codes/:code/resend`
10. Line 530: `DELETE /beta-codes/:code`

**Pattern for each route:**
```javascript
// Remove this line:
if (req.user?.email?.toLowerCase() !== 'joshua.deuermeyer@gmail.com') return res.status(403).json({ error: "Denied" });

// Change route signature from:
router.get("/beta-codes", async (req, res) => {
// To:
router.get("/beta-codes", requireRole('admin'), async (req, res) => {
```

**Add to admin.js imports:**
```javascript
const { requireRole } = require("../middleware/auth");
```

---

### Batch 1B: Input Validation

| Item | Status | Notes |
|------|--------|-------|
| 1B-1: receipts.js — File type whitelist (MIME + magic bytes) | ✅ | JPEG, PNG, PDF only. `validateFileType()` added to both POST endpoints |
| 1B-2: invoices.js — Pagination on `/clients` and `/` endpoints | ✅ | `offset`, `limit`, `total`, `hasMore` returned |
| 1B-3: plaid.js — Batch Plaid sync (replace N+1 loop) | 🔲 | Deferred — Plaid work not starting for 2+ months |

---

### Batch 1C: Performance

| Item | Status | Notes |
|------|--------|-------|
| 1C: plaid.js — `Promise.all()` for bank account syncs | 🔲 | Deferred — Plaid work not starting for 2+ months |

---

## Phase 2 Fixes

### Batch 2A: Security Hardening

| Item | Status | Notes |
|------|--------|-------|
| 2A-1: receipts.js — Signed URLs (replace public URLs) | ✅ | Implemented `GET /signed-url` and relative path storage |
| 2A-2: subscription.js — Atomic beta code redemption | ✅ | Race condition fixed via atomic update |
| 2A-3: mailer.js — HTML-escape `messageContent` | ✅ | XSS prevention added to contact relay email |

---

### Batch 2B: URL & Data Validation

| Item | Status | Notes |
|------|--------|-------|
| 2B-1: invoices.js — Validate invoice notes URLs | ✅ | Blocks `javascript:`, `data:` schemes |
| 2B-2: gemini.js — Batch requests into 500-txn chunks | ✅ | Implemented automatic chunking |
| 2B-3: plaid.js — Plaid-specific batching | 🔲 | Deferred |

---

### Batch 2C: Data Minimization

| Item | Status | Notes |
|------|--------|-------|
| 2C: gemini.js — Strip `user_id`/`invoice_id` from Gemini payload | ✅ | ~60% payload reduction implemented |

---

## Validation Checklist

**Phase 1 (before marking done):**
- [ ] `user_roles` table exists in Supabase with Joshua as admin
- [ ] `SELECT * FROM user_roles LIMIT 1` returns data (not error)
- [ ] `curl localhost:3000/admin/beta-codes` → 401 (no token)
- [ ] Same with non-admin token → 403
- [ ] Same with Joshua's token → 200
- [ ] File upload with `.exe` → rejected
- [ ] File upload with `.pdf` → accepted
- [ ] `GET /api/invoices` returns `pagination.total`, `pagination.hasMore`
- [ ] Redis running: `redis-cli ping` → PONG
- [ ] Email queue: trigger a report, confirm job queued (check Bull dashboard or logs)

**Phase 2 (before marking done):**
- [ ] Receipt URLs return signed URL with TTL (not public URL)
- [ ] Concurrent beta code redemptions: only one succeeds
- [ ] Contact form email: no raw `<` characters in HTML output
- [ ] Invoice URL with `javascript:` scheme → rejected
- [ ] Gemini payload excludes `user_id` and `invoice_id`

---

## Optional Cleanup (Low Priority)

1. `auth.js` — Remove or gate dev bypass to localhost only (15 min)
2. `mailer.js` — Stream large attachments instead of buffering (1 hour)
3. `invoices.js` — Combine invoice notes parsing logic (20 min)
4. `admin.js` — Cache daily report user mapping (1 hour)
5. Write local dev setup doc: Redis install, env setup, how to run both api and web-react

---

## Deferred (Plaid — 2+ months out)

- `cryptoUtil.js` — Replace stub with real `libsodium-wrappers` async implementation
- `plaid.js` — Batch sync (1B-3)
- `plaid.js` — Promise.all syncs (1C)
- `plaid.js` — Plaid-specific data validation (2B-3)
- Vercel: add `ENCRYPTION_KEY` to production env
