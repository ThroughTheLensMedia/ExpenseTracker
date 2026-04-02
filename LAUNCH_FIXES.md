# Studio Tracker — Hardening Fix Checklist

> Focus: Architecture · Security · QA · DevOps
> Stripe and Plaid deferred until this list is complete.
> Check off each item as it is committed and deployed.

---

## Pass 1 — Environment & Git Hygiene
*No code changes. Prevents secret leakage and repo bloat.*

- [x] Add `.env`, `.env.local`, `*.sqlite`, `data/`, `marketing_assets/` to root `.gitignore`
- [ ] **ACTION REQUIRED:** Confirm `SUPABASE_SERVICE_ROLE_KEY` exists in Vercel Production env panel (`vercel env ls`)
- [ ] **ACTION REQUIRED:** Confirm `CRON_SECRET` exists in Vercel Production env panel
- [ ] **ACTION REQUIRED:** Confirm `NODE_ENV=production` is set explicitly in Vercel Production env panel

---

## Pass 2 — Server Startup Hardening
*Files: `api/db.js`, `api/server.js`*
*Makes misconfiguration visible at boot, not silently wrong at runtime.*

- [x] `api/db.js` — Fail loudly if `SUPABASE_SERVICE_ROLE_KEY` is missing (throw on startup)
- [x] `api/server.js` — Check `initDb()` return value; log error and exit if DB client failed to initialize

---

## Pass 3 — Auth Middleware Security
*File: `api/middleware/auth.js`*
*One-line logic fix prevents dev bypass from being active on Vercel preview deployments.*

- [x] Fix `isLocalDev` OR logic → AND logic: `!process.env.VERCEL && process.env.NODE_ENV !== 'production'`

---

## Pass 4 — Admin Route Guards
*File: `api/routes/admin.js`*
*Three routes were completely unprotected — any licensed user could create/delete/resend invite codes.*

- [x] Add admin guard to `POST /admin/beta-codes`
- [x] Add admin guard to `POST /admin/beta-codes/:code/resend`
- [x] Add admin guard to `DELETE /admin/beta-codes/:code`
- [x] Fix cron authentication to use `x-vercel-cron: 1` header (Vercel actually injects this)

---

## Pass 5 — Data Ownership Hardening
*File: `api/routes/expenses.js`*
*Defense-in-depth: back up RLS with explicit user_id filter on destructive operations.*

- [x] Add `.eq("user_id", req.user.id)` to `DELETE /expenses/:id` query

---

## Pass 6 — Licensing Fail-Closed
*File: `api/middleware/licensing.js`*
*Prevents all users from bypassing subscription check if the DB has a momentary error.*

- [x] Change `catch` block from `next()` to `res.status(503).json({ error: "Service temporarily unavailable" })`

---

## Pass 7 — Billing Correctness (Discount Math)
*Files: `api/routes/invoices.js`, `api/routes/pay.js`*
*Fixes the double-division bug. `discount_cents` stores percent×100 (basis points), so divide by 10000 — not by 100 twice.*

- [x] Fix `invoices.js` discount calculation — `discountPct = discount_cents / 10000`
- [x] Fix `pay.js` discount calculation — same fix applied

---

## Pass 8 — Vercel Config Hardening
*File: `vercel.json`*
*Removes unreachable duplicate SPA rewrite. Cron auth fix is in admin.js (Pass 4 above).*

- [x] Consolidate duplicate catch-all SPA rewrite rules (removed unreachable second rule)

---

## Pass 9 — Frontend Security
*File: `web-react/src/components/AuthContext.jsx`*
*Removes URL-based dev bypass that could appear in shared links or browser history.*

- [x] Remove `window.location.search.includes('bypass_login=true')` from `hasDevBypass` check

---

## Pass 10 — Frontend UX Hardening
*File: `web-react/src/App.jsx`*
*Fixes expiration banner button that routed to a hash anchor that doesn't exist on most pages.*

- [x] Fix "EXTEND ACCESS" button to `navigate('/StudioControlCenter?tab=saas')` instead of `#redeem`

---

## Pass 11 — Email Link Cleanup
*File: `api/utils/mailer.js`*
*Removes a broken "Download PDF" link in the client-facing approval email that 404s on click.*

- [x] Remove broken `${appUrl}/pay/${invoiceId}/download` link from `sendInvoiceApprovalEmail`

---

## Post-Hardening Validation
*Run after all passes are complete and deployed.*

| # | Command / Action | Expected Result |
|---|-----------------|-----------------|
| 1 | `vercel env ls` | `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `NODE_ENV` present under Production |
| 2 | `/api/health` response | `"key_mode": "ADMIN_PRIVILEGED"` |
| 3 | `POST /api/admin/beta-codes` as non-admin user | 403 |
| 4 | `DELETE /api/admin/beta-codes/TESTCODE` as non-admin | 403 |
| 5 | Send Vercel preview deploy + `Authorization: Bearer mock-session` | 401 |
| 6 | Delete expense owned by User A while logged in as User B | 404 or 403 |
| 7 | Create invoice with $50 discount on $500 subtotal — check email, pay page | Total = $450 |
| 8 | Kill DB connection mid-request → check licensing response | 503, not 200 |
| 9 | Trigger Vercel cron via dashboard → check admin email inbox | Daily report received |
| 10 | Click "EXTEND ACCESS" on any non-SCC page | Navigates to Studio Control Center |
| 11 | Trigger invoice approval → check email for "Download PDF" link | Link absent or working |

---

## Deferred (Do Not Start Until Above Is Complete)
- [ ] Stripe billing integration (checkout, webhook, subscription lifecycle)
- [ ] Stripe Customer Portal in Studio Control Center
- [ ] Plaid access token encryption at rest
- [ ] Plaid per-connection error isolation in sync loop
- [ ] Subscriber pricing page + onboarding flow
- [ ] Rate limiting on `/subscription/redeem`
- [ ] Uptime monitoring (UptimeRobot / Checkly)
- [ ] Error tracking (Sentry / Logtail)
- [ ] Automated test suite (unit + integration)
