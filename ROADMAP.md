# Lumière Ledger — Master Roadmap

**Version:** v7.3.4 | **Last reviewed:** 2026-05-16  
Source of truth for all sprint work, security status, and product phases. Replaces `FIX_ROADMAP.md` and `LAUNCH_FIXES.md` — those files are archived.

---

## 🚦 Current Status

| Area | State |
|------|-------|
| Security hardening (Passes 1–11) | ✅ Complete — verified in code |
| Email pipeline | ✅ Fixed — `RESEND_FROM` → `support@throughthelens.media` |
| Marketing page | ✅ Live — `throughthelens.media/marketing/lumiere-ledger` |
| Supabase auth redirect | ✅ `https://www.lumiereledger.com/**` allowlisted |
| Domain + rebrand (Joshua) | ✅ Complete |
| Google OAuth updated (Joshua) | ✅ Complete |
| Logo selected (Joshua) | ✅ Complete |
| Vercel env vars confirmed (Joshua) | ✅ Complete (`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `NODE_ENV`) |
| Post-hardening validation tests | 🔲 Never run — blocking Stripe/Plaid |
| RLS multi-tenant audit | 🔲 Policies written, end-to-end verification pending |

---

## 🔥 Launch Gate — Must Ship Before SaaS Launch

### 1. Code Fixes (3 gaps found in audit — 2026-05-16)

| Item | File | Issue |
|------|------|-------|
| CORS — add `www.lumiereledger.com` | `api/server.js` ALLOWED_ORIGINS | New domain blocked by CORS — auth calls will fail |
| APP_URL fallback | `api/routes/invoices.js` line 236 | Pay portal links still point to `app.throughthelens.media` |
| Mailer fallback from-address | `api/server.js` line 115 + `api/utils/mailer.js` line 32 | Fallback uses `lumiereledger.com` (unverified Resend domain) — should be `support@throughthelens.media` |
| `REDIS_URL` in Vercel | Vercel env panel | Required to activate email queueing |

### 2. Post-Hardening Validation (run after code fixes deployed)

None of these have been executed. All 11 hardening passes are verified in code — these tests confirm live behavior.

| # | Test | Expected |
|---|------|----------|
| 1 | `vercel env ls` | `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `NODE_ENV=production` present under Production |
| 2 | `GET /api/health` | `"key_mode": "ADMIN_PRIVILEGED"` |
| 3 | `POST /api/admin/beta-codes` as non-admin | 403 |
| 4 | `DELETE /api/admin/beta-codes/TESTCODE` as non-admin | 403 |
| 5 | Vercel preview deploy + `Authorization: Bearer mock-session` | 401 |
| 6 | Delete expense owned by User A while logged in as User B | 404 or 403 |
| 7 | Invoice with $50 discount on $500 subtotal — check email + pay page | Total = $450 |
| 8 | Kill DB connection mid-request → licensing response | 503, not 200 |
| 9 | Trigger Vercel cron → check admin email | Daily report received |
| 10 | Click "EXTEND ACCESS" on any non-SCC page | Navigates to Ledger Control Center |
| 11 | Trigger invoice approval → check email for broken download link | Link absent |

### 3. RLS Multi-Tenant Audit

- [ ] Verify all tables have `user_id = auth.uid()` RLS policies active in Supabase dashboard
- [ ] Test: User A cannot read User B's expenses, leads, invoices, clients
- [ ] Confirm `user_roles` table is service-role-only (no user-facing RLS bypass)

---

## ⏭ Next Sprint (after launch gate clears)

| Item | Notes |
|------|-------|
| Maps Autopilot | In progress — Google Maps A→B→A mileage round-trip |
| Stripe billing | Checkout, webhook, subscription lifecycle. Deferred until launch gate complete. |
| Fast Receipt Processing | Drag-drop + Vision model auto-extract on transaction create |
| User-Defined Accounts (Phase 5) | Replace dynamic source dropdown with user-managed named accounts |

---

## ✅ Completed — Security Hardening (All Passes Verified in Code)

All items below are confirmed live in the codebase as of 2026-05-16.

| Pass | Item | File |
|------|------|------|
| 1 | `.env`, `*.sqlite`, `data/` added to `.gitignore` | Root `.gitignore` |
| 2 | `db.js` fails loudly on missing `SUPABASE_SERVICE_ROLE_KEY`; `server.js` checks `initDb()` on startup | `api/db.js`, `api/server.js` |
| 3 | `isLocalDev` uses AND logic — dev bypass cannot activate on Vercel | `api/middleware/auth.js` |
| 4 | Admin guard (`requireRole('admin')`) on all beta-code routes; cron auth uses `x-vercel-cron: 1` | `api/routes/admin.js` |
| 5 | DELETE expenses includes `.eq("user_id", req.user.id)` | `api/routes/expenses.js` |
| 6 | Licensing middleware fail-closed — DB error → 503, not pass-through | `api/middleware/licensing.js` |
| 7 | Discount math fixed: `discountPct = discount_cents / 10000` | `api/routes/invoices.js`, `api/routes/pay.js` |
| 8 | Duplicate catch-all SPA rewrite removed from `vercel.json` | `vercel.json` |
| 9 | `bypass_login=true` URL param removed from `AuthContext.jsx` | `web-react/src/components/AuthContext.jsx` |
| 10 | "EXTEND ACCESS" button routes to `navigate('/StudioControlCenter?tab=saas')` | `web-react/src/App.jsx` |
| 11 | Broken "Download PDF" link removed from invoice approval email | `api/utils/mailer.js` |

---

## ✅ Completed — Infrastructure & Platform

| Item | Version | Notes |
|------|---------|-------|
| Professional Invoicing + PDF + E-Sign | v5.2.0 | |
| Executive Dashboard KPIs | v5.2.0 | |
| RLS fully activated on all tables | v5.2.0 | Verification pending (see Launch Gate) |
| Watchdog cron + UptimeRobot | v5.2.0 | |
| AI Brain (Gemini 2.5 Flash, BYOB) | v5.2.0 | Read-only queries |
| AI retry mechanism (503 handling) | v5.2.0 | |
| Mobile UX sprint | v6.x | iOS dates, receipt upload, PWA session persistence, tap targets |
| Import dedup (exact + fuzzy + near-duplicate) | v7.3.2 | |
| Near-duplicate review modal | v7.3.2 | |
| Feedback widget + route | v7.3.2 | |
| Real-time lead intake (`/api/intake`) | v7.1.0 | |
| Intake key management (per-user `ll-xxxx` keys) | v7.1.0 | |
| Supabase Realtime lead notifications | v7.1.0 | |
| Add-On Marketplace page | v7.1.0 | |
| TTLM form worker v2 (non-blocking) | v7.1.0 | |
| Email pipeline fix (Resend from-address) | v7.3.4 | |
| Marketing page rewrite | v7.3.4 | |
| Supabase auth redirect for lumiereledger.com | v7.3.4 | |

---

## 🧠 Phase 2: AI Agentic Capabilities ("Studio Hands")

Implementation order is fixed — do not skip steps.

- [ ] **Step 1 — Read-Only Tool Calls** (`api/routes/brain.js`, `api/utils/gemini.js`)
  - Wire Gemini function calling with 4 read tools: `search_transactions`, `get_lead`, `get_invoice_summary`, `get_metrics_snapshot`
  - Deliverable: "What did I spend on meals this quarter?" returns live DB data

- [ ] **Step 2 — Confirmation UI** (`web-react/src/components/AssistantSidebar.jsx`)
  - API returns `pendingActions[]` alongside text when a write is requested
  - Approve/Reject UI before any write executes
  - **No write tools go live until this UI is confirmed working**

- [ ] **Step 3 — Write Tools** (gated by Step 2)
  - `create_transaction`, `update_lead_status`, `link_transaction_to_lead`
  - All writes route through existing authenticated Express endpoints

- [ ] **Step 4 — Invoice Generation** (after Step 3 is stable)
  - `create_invoice_draft(client_name, line_items, due_date)`

---

## 📷 Phase 3: Computer Vision & RAG

- [ ] Fast Receipt Processing — drag-drop → Vision model extracts vendor + amount before save
- [ ] RAG — index uploaded PDF receipts and contracts; extract serial #s, term dates, interest rates
- [ ] Smart Receipt Scanner (deferred) — OpenCV.js edge detection + perspective warp (~1.5MB load cost)

---

## 🚀 Phase 4: Semantic Memory & Predictive Forecasting

- [ ] Semantic Search — pgvector embeddings for natural language ledger recall
- [ ] Burn Rate Alerts — proactive warnings when monthly velocity exceeds historical average

---

## 🏦 Phase 5: Enterprise Integrations & Account Management

- [ ] **User-Defined Accounts** — named accounts with type, institution, last 4 digits; source dropdown reads from accounts table with backward-compatible fallback
- [ ] **Plaid Live Bank Sync** — blocked by: Plaid approval + `cryptoUtil.js` real `libsodium-wrappers` impl + `ENCRYPTION_KEY` in Vercel
- [ ] **Stripe Billing** — checkout, webhooks, subscription lifecycle, Customer Portal in Control Center

---

## 🧩 Phase 6: Add-On Platform

Foundation shipped (intake keys + marketplace page).

- [ ] Photography Website Builder — Cloudflare Pages template pre-wired to Lumière intake
- [ ] Client Portal — invoices, quote approval, deliverable downloads
- [ ] Contract E-Sign — send/sign/store from CRM with photography templates
- [ ] Add-On Billing — Stripe per-add-on recurring charges

---

## 🔭 Backlog

- AI Function Calling write-to-DB from chat ("Studio Hands" Phase 2+)
- RAG document indexing — PDF receipts, contracts
- Semantic search via pgvector
- Rate limiting on `/subscription/redeem`
- Error tracking (Sentry / Logtail)
- Automated test suite (unit + integration)
- `mailer.js` — stream large attachments instead of buffering
- `admin.js` — cache daily report user mapping

---

## 🚩 Flagged Items (Out-of-Scope — Pending Review)

Items added here when a request falls outside the current sprint. Review with Joshua before promoting to an active sprint.

### Need
> *Required for core functionality or launch — will break something if not done.*

<!-- add items here -->

### Broken
> *Confirmed not working correctly in production.*

<!-- add items here -->

### Clean Up
> *Technical debt, dead code, naming inconsistencies, structural improvements.*

<!-- add items here -->

### Good to Have
> *Nice UX or feature additions — not blocking anything.*

<!-- add items here -->

---

> All AI features use **Gemini exclusively** (BYOB model). No OpenAI or other providers.
