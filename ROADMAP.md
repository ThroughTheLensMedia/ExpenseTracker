# Lumière Ledger — Master Roadmap

**Version:** v7.8.54 | **Last reviewed:** 2026-06-02  
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
| ~~**Run DB migration 001**~~ | ~~Supabase SQL Editor~~ | ✅ Done 2026-05-20 — `plaid_account_id` column + index live. |
| ~~**Stripe webhook fix**~~ | ~~`api/server.js`~~ | ✅ Done v7.8.27 — webhook mounted before `express.json()` on `app` directly. |
| ~~**Stripe — end-to-end test**~~ | ~~Stripe CLI~~ | ✅ Done 2026-06-02 — checkout → webhook 200 → `plan_type: sync_monthly` + `stripe_customer_id` + `stripe_subscription_id` written to Supabase. Full chain verified. |
| ~~**Supabase schema migration**~~ | ~~Supabase SQL Editor~~ | ✅ Done 2026-05-20 — `stripe_subscription_id` + `current_period_end` added to `user_subscriptions`. |
| ~~**Grandfathered users `admin_tier` fix**~~ | ~~Supabase SQL Editor~~ | ✅ Done 2026-05-20 — all beta/lifetime users granted Studio admin_tier. |
| ~~**Sync tier Stripe price IDs**~~ | ~~Stripe + Vercel~~ | ✅ Done — Sync product created in Stripe. `VITE_STRIPE_PRICE_SYNC_*` and `STRIPE_PRICE_SYNC_*` set in Vercel. |

---

## 🟡 Next Sprint — High Value

| Item | Status | Notes |
|------|--------|-------|
| ~~**Stripe — ProfileTab billing section**~~ | ✅ v7.8.28 | Sync users see Core/Studio upgrade cards; emoji removed from Manage Billing. |
| ~~**Account merging (linked_source)**~~ | ✅ v7.8.30 | CSV accounts can be merged into a target; absorbed accounts hidden; unmerge available. Pending SQL: `ALTER TABLE account_aliases ADD COLUMN IF NOT EXISTS linked_source TEXT;` |
| ~~**Account display names in ledger/drawer**~~ | ✅ v7.8.31 | TransactionDrawer + filter dropdown driven by /accounts/summary aliases. |
| ~~**Bulk reassign account**~~ | ✅ v7.8.32 | Multi-select → "Reassign account…" dropdown → Apply. PATCH /expenses/bulk-source. |
| ~~**Account → Transaction count tile click (Plaid card)**~~ | ✅ Confirmed done | Navigates to `/transactions?source=plaid`. |
| ~~**Manual vs Plaid duplicate transactions**~~ | ✅ v7.8.52 | Pre-insert Plaid match check in `POST /expenses`; retroactive `link-manual-to-plaid` pass; CSV import no longer overwrites Plaid rows. |
| ~~**Smart Receipt Scanner — tip detection**~~ | ✅ v7.8.53 | Gemini extracts subtotal/tip/tax/total; tip breakdown badge in drawer; split-charge auto-merge when bank posts meal + tip separately. |
| ~~**Maps Autopilot**~~ | ✅ Confirmed done | Google Maps A→B→A with waypoint, autocomplete, auto-populated miles. |
| **Account merging by last-4 digits** | ⬜ Backlog | Auto-match CSV source to Plaid sub-account by institution + last 4 digits. Manual merge covers this for now. |
| **Michelle Gornichec UUID in PLAID_BILLING_EXEMPT** | ⬜ Waiting | UUID unknown. Add to `api/routes/plaid.js` + `api/routes/stripe.js` when received. |
| **Brain — Chart/Analysis Popup (Phase 2 Step 5)** | ⬜ Post-launch | Chart.js modal when AI requests visual analysis. |
| **Brain — Invoice creation tool (Step 6)** | ⬜ Post-launch | `create_invoice_draft` write tool with confirmation card. |

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
| v7.8.8 | Fix upgrade plan flash (gate BillingSection on subscriptionReady); fix free_beta label → "Beta Access" vs lifetime → "Lifetime Free" |
| v7.8.9 | Fix build-breaking syntax error in OnboardingChecklist.jsx (unescaped apostrophe); first successful deploy since v7.8.6 — all v7.8.7–7.8.8 fixes now live |
| v7.8.10 | Fix onboarding wizard closing on step nav click; show Core/Studio upgrade cards for beta users |
| v7.8.11 | Onboarding wizard minimizes to floating button on step nav (instead of blocking overlay); beta users see upgrade plans |
| v7.8.12 | Fix onboarding checklist nav paths — AI Intelligence tab, Invoicing page, rename Help Docs step |
| v7.8.13 | Business Profile — full-width responsive layout, pair orphaned fields, compact textareas, mobile breakpoint |
| v7.8.14 | Stripe setup — onboarding checklist step + in-profile 4-step guidance with direct Stripe dashboard link |
| v7.8.15 | Connect Bank auto-triggers Plaid popup via ?connect=true param; better billing error message |
| v7.8.16 | Beta/lifetime users bypass Plaid billing gate (full feature access during beta); fix error banner wrapping |
| v7.8.17 | Revert beta bypass — all users pay for Plaid; inline billing gate UI with Core/Studio plan cards on 402 |
| v7.8.18 | Sync tier ($4.99/mo) — Plaid-only flat plan; updated billing gate (Sync featured first), upgrade cards (3-col), marketing pricing (4-tier + MOST POPULAR badge), CTA copy fix |
| v7.8.19 | Remove redundant hero pill badges from Home.jsx |
| v7.8.20 | Fix stale billing gate copy (remove "$0.50/account" language); annual Sync shows $49.99/yr total instead of per-month breakdown |
| v7.8.21 | Fix "Invalid price_id" checkout error — stripe.js PRICES map was missing Sync tier; add Sync to deriveTier() |
| v7.8.22 | Add keep-alive cron to vercel.json (reverted in v7.8.23 — Hobby plan blocks sub-daily crons) |
| v7.8.23 | Remove sub-daily cron — Vercel Hobby plan blocks `0 */6 * * *`; UptimeRobot covers keep-alive at 5-min intervals |
| v7.8.24 | Plaid transactions use real account name (e.g. "USAA Checking") instead of generic "plaid" source; auto-repair on sync |
| v7.8.25 | Fix Plaid account repair for NULL plaid_account_id rows (pass 2 fallback to institution name); date column nowrap; strip icons from ACCOUNT_LABELS |
| v7.8.26 | Plaid billing copy — remove $0.50/account language from 4 locations; Sync plan flat-fee messaging |
| v7.8.27 | Fix Stripe webhook 400 — mount before express.json(); remove duplicate apiRouter mount; manual SQL fix for deweyspath@gmail.com subscription |
| v7.8.28 | Billing section: Sync users see Core/Studio upgrade path; 2-col grid for Sync; remove emoji from Manage Billing button |
| v7.8.29 | Bank Import page emoji cleanup — headers, tips, nav buttons, Pro Tip label |
| v7.8.30 | Account merging — linked_source in account_aliases; Merge button on CSV cards; absorbed accounts hidden; target shows Includes badge; unmerge available |
| v7.8.31 | Account dropdown driven by live account aliases — TransactionDrawer + filter dropdown use /accounts/summary display_name; emoji stripped from SOURCE_LABELS |
| v7.8.32 | Bulk reassign account — PATCH /expenses/bulk-source; multi-select floating bar; fix route ordering (bulk-source before /:id); fix toast auto-dismiss |

---

## 🧠 Phase 2: AI Agentic Capabilities — Remaining

> **Status: Paused after Step 4** — Brain is stable. Resuming post-launch.

- [x] Step 1–4 ✅ shipped — read tools, write tools, confirmation UI, edit transactions
- [ ] **Step 5 — Invoice Creation** (deferred) — `create_invoice_draft` write tool
- [ ] **Step 6 — Chart/Analysis Output Popup** (deferred) — Chart.js modal + Download CSV

---

## 📷 Phase 3: Computer Vision & RAG

- [x] **Fast Receipt Processing** ✅ shipped v7.5.9
- [x] **Smart Receipt Scanner — tip detection + split-charge merge** ✅ v7.8.53 — Gemini extracts subtotal/tip/tax/total; auto-merges split bank charges; tip breakdown badge in drawer
- [ ] **RAG — PDF indexing + semantic retrieval** — Enable pgvector in Supabase; embed uploaded PDFs (contracts, warranties, insurance policies); Brain answers questions like "when does my equipment warranty expire?" or "what's my van loan rate?". Requires: `vector` extension migration, `embeddings` table, chunking pipeline on upload, cosine similarity query in Brain.

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
