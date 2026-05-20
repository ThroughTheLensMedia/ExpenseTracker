# Lumière Ledger — Master Roadmap

**Version:** v7.8.4 | **Last reviewed:** 2026-05-19  
Source of truth for all sprint work, security status, and product phases.

---

## 🚦 Current Status

| Area | State |
|------|-------|
| Security hardening (Passes 1–11) | ✅ Complete |
| Email pipeline (Resend + throughthelens.media) | ✅ Fixed — all mailer fallbacks now point to correct domain |
| Supabase auth emails via Resend SMTP | ✅ Live v7.7.9 — no rate limits, branded sender |
| Domain + rebrand | ✅ Complete |
| Google OAuth updated | ✅ Complete |
| Vercel env vars confirmed | ✅ All set — ENCRYPTION_KEY, PLAID_*, STRIPE_*, VITE_* |
| CORS — `https://www.lumiereledger.com` | ✅ Already in ALLOWED_ORIGINS |
| APP_URL — invoices.js | ✅ Already `https://www.lumiereledger.com` |
| Mailer fallback addresses | ✅ Fixed v7.8.4 — no more support@lumiereledger.com |
| AI Brain — Phase 2 Steps 1–4 | ✅ Complete |
| Stripe billing infrastructure | ✅ Built — routes, webhook, UpgradeGate, tier system |
| Stripe env vars + price IDs | ✅ Confirmed |
| Plaid — LIVE with billing gate | ✅ Live v7.7.8 — 402 gate + $0.50/account fee disclosure |
| Plaid — ENCRYPTION_KEY | ✅ Set in Vercel |
| Plaid — sync stores plaid_account_id | ✅ v7.8.4 — new transactions tagged per sub-account |
| Accounts page | ✅ Full build v7.7.0–7.8.4 — cache, dedup fix, savings type, sub-account filtering |
| Onboarding checklist | ✅ v7.7.8 |
| Landing page | ✅ v7.7.7 — matches marketing page |
| Terms of Service | ✅ v7.8.0 — 25 sections, TN law, AAA arbitration |
| RLS multi-tenant audit | ✅ Complete — all 17 tables verified |
| Post-hardening validation | ✅ Complete — all 11 tests passed |

---

## 🔴 Must Do Before Launch

| Item | File | Notes |
|------|------|-------|
| **Run DB migration 001** | Supabase SQL Editor | `api/migrations/001_plaid_account_id.sql` — adds `plaid_account_id` column + index. Run once, then trigger a manual Plaid sync to backfill. |
| **Stripe — end-to-end test** | Stripe CLI | Checkout → webhook fires → `plan_type` updates in Supabase → `UpgradeGate` drops. Use Stripe test card. Never verified live. |
| **Supabase schema migration** | Supabase SQL Editor | `ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT, ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ` — required for Stripe webhook to write correctly. |
| **Grandfathered users `admin_tier` fix** | Supabase SQL Editor | `UPDATE user_subscriptions SET admin_tier = 'studio' WHERE plan_type IN ('free_beta','lifetime') AND admin_tier IS NULL` — grants Studio limits to all beta users. Run now. |

---

## 🟡 Next Sprint — High Value

| Item | Notes |
|------|-------|
| **Stripe — ProfileTab billing section** | Plan badge (Free / Core / Pro / Studio), "Manage Billing" → Stripe portal, upgrade CTA for Free users. Currently users can't see their plan in-app. **Highest priority remaining feature.** |
| **Michelle Gornichec UUID in PLAID_BILLING_EXEMPT** | Add her Supabase UUID to `PLAID_BILLING_EXEMPT` Set in both `api/routes/plaid.js` and `api/routes/stripe.js`. She will be billed on Plaid connect until this is done. |
| **Account → Transaction count tile click (Plaid card)** | The USAA Plaid card's "Transactions: 31" stat tile doesn't navigate because `txSource = null` for plaid source. Should navigate to `/transactions?source=plaid`. |
| **Brain — Chart/Analysis Popup (Phase 2 Step 5)** | Chart.js modal when AI requests visual analysis. Structured chart data returned alongside text. |
| **Maps Autopilot** | Google Maps A→B→A mileage round-trip — in progress |

---

## 🟢 Good to Have

| Item | Notes |
|------|-------|
| Invoice PDF formatting | Known formatting issues — not blocking launch |
| Client invoice history | CRM should consolidate repeat clients — Phase 5 |
| Bank Import UI cleanup | Remove emojis, demote niche banks, surface Rocket Money as recommended |
| Brain — Invoice creation tool (Step 5) | `create_invoice_draft` write tool with confirmation card |
| REDIS_URL in Vercel | Required to activate email queueing (currently using direct Resend fallback — works fine) |
| Rate limiting on `/subscription/redeem` | Backlog |
| Error tracking (Sentry / Logtail) | Backlog |

---

## ✅ Completed This Sprint (v7.7.0 → v7.8.4)

| Version | What shipped |
|---------|-------------|
| v7.7.0–7.7.5 | Accounts page full build — groups, live balances, Plaid badge, sort/filter, rename/hide, sync button |
| v7.7.6 | Live Sync always on top, Unsync button, clickable transaction counts, logout scroll fix |
| v7.7.7 | Landing page rebuilt to match marketing page |
| v7.7.8 | Plaid billing gate (CRITICAL), onboarding checklist, nav reorder, login/profile/email cleanup |
| v7.7.9 | Auth emails via Resend — no more Supabase rate limits |
| v7.8.0 | Terms of Service — 25 sections, TN law, AAA arbitration, Plaid no-refund clause |
| v7.8.1 | Sub-account drill-down, per-sub-account 👁 hide |
| v7.8.2 | Stale-while-revalidate cache for accounts + Plaid balances — instant page loads |
| v7.8.3 | Live Sync dedup fix, Plaid Linked back in type groups, Unlink button per CSV account |
| v7.8.4 | `plaid_account_id` sync + per-sub-account filtering, savings account type + filter, mailer fallback fix |
| v7.8.5 | Accounts page filter fix — Live Sync section no longer disappears when type filter (Credit/Checking/Savings/Manual) is active |
| v7.8.6 | Filter pills now filter Plaid sub-account rows in real-time; Account Plans nav fixed to route to profile/billing tab |
| v7.8.7 | 3-page onboarding wizard (Welcome → Data Import Guide → Setup Checklist); fix trigger bug (subscription null for new users) |

---

## 🧠 Phase 2: AI Agentic Capabilities — Remaining

> **Status: Paused after Step 4** — Brain is stable. Resuming post-launch.

- [x] Step 1–4 ✅ shipped — read tools, write tools, confirmation UI, edit transactions
- [ ] **Step 5 — Invoice Creation** (deferred) — `create_invoice_draft` write tool
- [ ] **Step 6 — Chart/Analysis Output Popup** (deferred) — Chart.js modal + Download CSV

---

## 📷 Phase 3: Computer Vision & RAG

- [x] **Fast Receipt Processing** ✅ shipped v7.5.9
- [ ] RAG — index uploaded PDFs; extract serial #s, term dates, interest rates
- [ ] Smart Receipt Scanner (deferred) — OpenCV.js edge detection + perspective warp

---

## 🚀 Phase 4: Semantic Memory & Predictive Forecasting

- [ ] Semantic Search — pgvector embeddings for natural language ledger recall
- [ ] Burn Rate Alerts — proactive warnings when spend exceeds historical average

---

## 🏦 Phase 5: Enterprise Integrations & Account Management

- [x] **Plaid Live Bank Sync** ✅ Live v7.6.8 — billing gate, encryption, per-sub-account tagging
- [ ] **User-Defined Accounts** — named accounts with type, institution, last 4
- [ ] **Stripe Billing end-to-end** — checkout, webhooks, subscription lifecycle, Customer Portal

---

## 🧩 Phase 6: Add-On Platform

- [ ] Photography Website Builder
- [ ] Client Portal — invoices, quote approval, deliverable downloads
- [ ] Contract E-Sign
- [ ] Add-On Billing

---

## 🔭 Backlog

- Rate limiting on `/subscription/redeem`
- Error tracking (Sentry / Logtail)
- Automated test suite (unit + integration)
- `mailer.js` — stream large attachments instead of buffering

---

## 🚩 Clean Up / Technical Debt

- **⚠️ Dependency Hygiene Protocol** — Any `api/package.json` change must regenerate `api/package-lock.json` in the same commit. Stale lock file = Vercel silent-skip = Lambda crash. Root cause of v7.6.7 outage. See Rule 10 in CLAUDE.md.
- **Invoice PDF formatting** — Known issues, not blocking. Good to Have.
- **`plaid_account_id` backfill** — Existing Plaid transactions have NULL until next sync after migration 001 runs.

---

> All AI features use **Gemini exclusively** (BYOB model). No OpenAI or other providers.
> All commits are Joshua Deuermeyer / Through The Lens Media only. No Co-Authored-By trailers.
