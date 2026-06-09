# Lumière Ledger — Master Roadmap

**Version:** v7.9.6 | **Last reviewed:** 2026-06-09  
Source of truth for all sprint work, security status, and product phases.

---

## 🚦 Current Status

| Area | State |
|------|-------|
| Security hardening (Passes 1–11) | ✅ Complete |
| Email pipeline (Resend + throughthelens.media) | ✅ Fixed — all mailer fallbacks point to correct domain |
| Supabase auth emails via Resend SMTP | ✅ Live v7.7.9 — no rate limits, branded sender |
| Domain + rebrand | ✅ Complete |
| Google OAuth updated | ✅ Complete |
| Vercel env vars confirmed | ✅ All set — ENCRYPTION_KEY, PLAID_*, STRIPE_*, VITE_*, VITE_SENTRY_DSN |
| CORS — `https://www.lumiereledger.com` | ✅ Already in ALLOWED_ORIGINS |
| APP_URL — invoices.js | ✅ Already `https://www.lumiereledger.com` |
| Mailer fallback addresses | ✅ Fixed v7.8.4 — no more support@lumiereledger.com |
| AI Brain — Phase 2 Steps 1–4 | ✅ Complete |
| Stripe billing infrastructure | ✅ Built — routes, webhook, UpgradeGate, tier system |
| Stripe env vars + price IDs | ✅ Confirmed |
| Plaid — LIVE with billing gate | ✅ Live v7.7.8 — 402 gate + Sync flat-fee disclosure |
| Plaid — ENCRYPTION_KEY | ✅ Set in Vercel |
| Plaid — sync stores plaid_account_id | ✅ v7.8.4 — new transactions tagged per sub-account |
| Accounts page | ✅ Full build v7.7.0–7.8.4 — cache, dedup fix, savings type, sub-account filtering |
| Onboarding checklist | ✅ v7.7.8 + receipt forwarding step v7.8.96 + role selector v7.9.1 |
| Landing page | ✅ v7.7.7 — matches marketing page |
| Terms of Service | ✅ v7.8.0 — 25 sections, TN law, AAA arbitration |
| RLS multi-tenant audit | ✅ Complete — all 17 tables verified |
| Post-hardening validation | ✅ Complete — all 11 tests passed |
| Email Receipt Forwarding (Phase 1 + 2) | ✅ Complete — per-user HMAC tokens, DB lookup, address in Integrations tab, v7.8.92 |
| Sentry error monitoring | ✅ Live — VITE_SENTRY_DSN set in Vercel, Claude API connected, user context wired v7.8.91 |
| Security Review Cadence tab | ✅ v7.8.95–7.8.98 — 5 tiers, copyable commands, dashboard links |
| npm audit (api/ + web-react/) | ✅ Both clean — api/ 3 high + 4 moderate fixed; web-react/ react-router high fixed; file-type moderate deferred (ESM-only) |
| Dashboard customization | ✅ v7.9.1 — role selector in onboarding, widget toggles, gear panel, smart empty states, Dashboard tab in Control Center |
| Dependabot | ✅ v7.9.0 — `.github/dependabot.yml` live; weekly Monday scans; majors ignored for 6 risky packages |
| Open public signup | ✅ v7.9.5 — free-tier open signup (no code required); invite-code path validates + auto-redeems after email confirmation; `GET /api/subscription/validate-code/:code` public endpoint |
| SaaS Admin — member enrichment | ✅ v7.9.5 — Active Ledger Members now shows tier badge, estimated monthly revenue, Plaid account count, join date |
| Plaid — Sync plan 5-account cap | ✅ v7.9.6 — `create-link-token` enforces limit; 403 `plaid_account_limit` error; upgrade UI in PlaidLink |
| Signup — password strength enforcement | ✅ v7.9.6 — 5-rule client-side validation + live strength meter; PROCESSING freeze fixed |
| Landing page — broader audience + SEO | ✅ v7.9.5/7.9.6 — hero copy, pricing comparison table, gear icon fix, OG/Twitter/canonical tags |

---

## 🔴 Active — Fix Before Continuing

| Item | Notes |
|------|-------|
| **Receipt email body parse — re-test** | v7.8.96 hardened the prompt and error logging but the "Total Paid: $XX.XX" case was never re-tested with a live email forward. Send a test and verify System Logs show extracted amount. |
| **Security Review — complete first-run** | Tab is live but all 5 tiers show NEVER RUN / OVERDUE. Weekly check done; Dependency check done (npm audit ran). Mark those done in the Security tab. |

---

## 🟡 Address Soon — Technical Debt

| Item | Notes |
|------|-------|
| **`file-type` moderate vuln** | `receipts.js` uses `require('file-type')`. v22 is ESM-only — needs dynamic `import()` refactor. Near-zero real risk (ASF audio files only). Deferred. |
| **REDIS_URL — remove or wire up** | Bull was removed v7.8.90. Direct Resend fallback is intentional and working. Either set `REDIS_URL` and re-enable queue layer, or remove dead queue code from `emailQueue.js`. |
| **`plaid_account_id` backfill** | Pre-v7.8.4 Plaid transactions have NULL `plaid_account_id`. Sub-account spending breakdown won't work on historical data until users re-sync. Document or prompt user to sync. |
| **Michelle Gornichec UUID** | Added v7.8.55 to `plaid.js` and `stripe.js`. CLAUDE.md still lists as a gap — update. |

---

## 🟢 Good to Have — Dashboard Charts (Post v7.9.1)

> Recommended next 2: Income by Client + Deductible vs Non-Deductible Split — both use existing DB data, no new tables.

| Chart | What it shows |
|-------|--------------|
| **Income by Client** | Pie/bar of revenue per client from invoices |
| **Deductible vs Non-Deductible Split** | Donut of tax_deductible expenses — actionable for tax prep |
| **Invoice Aging Buckets** | Current / 30 / 60 / 90+ days overdue |
| **Tax Liability Estimate** | Running YTD estimate based on net profit + entity type |
| **Expense Trend Line** | Rolling 3-month avg vs current month |
| **Income Seasonality** | Month-by-month heatmap across 2–3 years |
| **Mileage YTD** | Total miles + estimated IRS deduction |
| **Category Budget vs Actual** | Requires `budgets` table — bigger build |

---

## 🟢 Good to Have

| Item | Notes |
|------|-------|
| Invoice PDF formatting | Known formatting issues — not blocking launch |
| Client invoice history | CRM should consolidate repeat clients — Phase 5 |
| Bank Import UI cleanup | Remove emojis, demote niche banks, surface Rocket Money as recommended |
| Apple Card CSV via email | Apple Card can't connect via Plaid. Detect `.csv` attachment in `emailInbound.js`, parse Apple Card format, bulk-insert with dedup. Workaround: manual CSV import. Build after email ingestion is stable. |
| 7-day unmatched receipt digest | Cron/UptimeRobot endpoint — email user list of `pending_receipts` older than 7 days |
| Account merging by last-4 digits | Auto-match CSV source to Plaid sub-account by institution + last 4 digits. Manual merge covers this for now. |

---

## 🎛 Dashboard Customization (High Impact — Good to Have)

> Users pick which widgets appear on their dashboard. Removes photographer-specific clutter for non-photographers.

| Item | Notes |
|------|-------|
| **Widget visibility toggles** | User selects which tiles/charts appear — Equipment, Mileage, Category Breakdown, Forecast, KPIs, etc. Stored in `settings` table per user |
| **Drag-to-reorder** | Optional phase 2 — reorder widget position. Build toggles first. |
| **Non-photographer mode** | Preset that hides Camera & Equipment, Mileage, Photography category tiles in one click |

---

## ✅ Completed This Sprint (v7.7.0 → v7.8.99)

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
| v7.8.5 | Accounts page filter fix — Live Sync section no longer disappears when type filter is active |
| v7.8.6 | Filter pills now filter Plaid sub-account rows in real-time; Account Plans nav fixed |
| v7.8.7 | 3-page onboarding wizard (Welcome → Data Import Guide → Setup Checklist) |
| v7.8.8 | Fix upgrade plan flash; fix free_beta label → "Beta Access" vs lifetime → "Lifetime Free" |
| v7.8.9 | Fix build-breaking syntax error in OnboardingChecklist.jsx — all v7.8.7–7.8.8 fixes now live |
| v7.8.10 | Fix onboarding wizard closing on step nav click; show Core/Studio upgrade cards for beta users |
| v7.8.11 | Onboarding wizard minimizes to floating button on step nav |
| v7.8.12 | Fix onboarding checklist nav paths — AI Intelligence tab, Invoicing page |
| v7.8.13 | Business Profile — full-width responsive layout, pair orphaned fields, mobile breakpoint |
| v7.8.14 | Stripe setup — onboarding checklist step + in-profile 4-step guidance |
| v7.8.15 | Connect Bank auto-triggers Plaid popup via ?connect=true param |
| v7.8.16 | Beta/lifetime users bypass Plaid billing gate (full feature access during beta) |
| v7.8.17 | Revert beta bypass — all users pay for Plaid; inline billing gate UI |
| v7.8.18 | Sync tier ($4.99/mo) — Plaid-only flat plan; billing gate + upgrade cards + marketing pricing |
| v7.8.19–26 | Billing copy fixes, annual Sync pricing, filter + dedup improvements |
| v7.8.27 | Fix Stripe webhook 400 — mount before express.json(); subscription chain verified end-to-end |
| v7.8.28 | Billing section: Sync users see Core/Studio upgrade path |
| v7.8.29 | Bank Import page emoji cleanup |
| v7.8.30 | Account merging — linked_source in account_aliases; Merge/Unmerge UI |
| v7.8.31 | Account dropdown driven by live aliases — TransactionDrawer + filter |
| v7.8.32 | Bulk reassign account — PATCH /expenses/bulk-source; multi-select floating bar |
| v7.8.52 | Smart dedup — pre-insert Plaid match check; retroactive manual-to-plaid link; CSV no longer overwrites Plaid |
| v7.8.53 | Smart Receipt Scanner — tip detection + split-charge auto-merge |
| v7.8.55 | Michelle Gornichec UUID added to PLAID_BILLING_EXEMPT in plaid.js + stripe.js |
| v7.8.58 | Email Receipt Forwarding Phase 1 — hardcoded to Joshua |
| v7.8.59 | Sentry frontend SDK installed |
| v7.8.80–88 | Email receipt pipeline stability — retry, ack/result emails, pending receipts, system logs |
| v7.8.89 | Receipt upload 413 fix — client-side Canvas compression (max 1920px, JPEG 0.82) |
| v7.8.90 | Bull removed — replaced with inline withRetry() (3 attempts, linear backoff) |
| v7.8.91 | Sentry user context on page reload — getSession() block calls Sentry.setUser() |
| v7.8.92 | Email Receipt Phase 2 — per-user HMAC tokens; DB lookup; IntegrationTab unique address |
| v7.8.93 | pending_receipts auto-cleanup on manual receipt upload |
| v7.8.94 | ENCRYPTION_KEY rotation runbook — rotate-plaid-tokens.js script + CLAUDE.md docs |
| v7.8.95 | Security Review Cadence tab (admin) — 5 tiers, checklists, Mark Done, history |
| v7.8.96 | Receipt body parse hardening; security tab URL allowlist fix; onboarding receipt step |
| v7.8.97 | Fix security-reviews 404 — catch-all router.all("*") was before routes in admin.js |
| v7.8.98 | Security checklist — copyable terminal commands + clickable dashboard links |
| v7.8.99 | Flag for Review toggle in TransactionDrawer; npm audit fix (3 high + 4 moderate) |
| v7.9.0 | GitHub Dependabot — `.github/dependabot.yml`; weekly Monday scans of /api and /web-react; 6 major packages ignored |
| v7.9.1 | Dashboard customization — role selector in onboarding (4 roles, presets); widget toggles + gear panel on dashboard; DashboardTab in Control Center; smart empty states |
| v7.9.2 | Account Plans nav fix — dedicated `?tab=billing` tab; `billingOnly` prop on ProfileTab |
| v7.9.3 | LCC restructure — gear panel clipping fixed; pills alphabetical; Feedback merged into Help; 3 admin tabs → AdminTab w/ sub-nav; License Activation in billing tab; vendor autocomplete in Automation |
| v7.9.4 | Gear panel stacking context fix — header card zIndex outranks KPI tile grid |
| v7.9.5 | Open public signup; invite code auto-redeem; SaaS admin member enrichment (tier, cost, Plaid count, join date); landing page hero broadened; pricing comparison table; SEO overhaul |
| v7.9.6 | Sync plan 5-account Plaid cap + upgrade UI; password strength enforcement + PROCESSING freeze fix; gear depreciation icon fix; Sync pricing table badge |

---

## 🧠 Phase 2: AI Agentic Capabilities — Remaining

> **Status: Paused after Step 4** — Brain is stable. Resuming post-launch.

- [x] Step 1–4 ✅ shipped — read tools, write tools, confirmation UI, edit transactions
- [ ] **Step 5 — Invoice Creation** (deferred) — `create_invoice_draft` write tool
- [ ] **Step 6 — Chart/Analysis Output Popup** (deferred) — Chart.js modal + Download CSV

---

## 📷 Phase 3: Computer Vision & RAG

- [x] **Fast Receipt Processing** ✅ shipped v7.5.9
- [x] **Smart Receipt Scanner — tip detection + split-charge merge** ✅ v7.8.53
- [ ] **RAG — PDF indexing + semantic retrieval** — Enable pgvector in Supabase; embed uploaded PDFs; Brain answers questions about contracts, warranties, insurance. Requires: `vector` extension migration, `embeddings` table, chunking pipeline, cosine similarity query in Brain.

---

## 🚀 Phase 4: Semantic Memory & Predictive Forecasting

- [ ] Semantic Search — pgvector embeddings for natural language ledger recall
- [ ] Burn Rate Alerts — proactive warnings when spend exceeds historical average

---

## 🏦 Phase 5: Enterprise Integrations & Account Management

- [x] **Plaid Live Bank Sync** ✅ Live v7.6.8 — billing gate, encryption, per-sub-account tagging
- [x] **Stripe Billing end-to-end** ✅ Live v7.8.27 — checkout, webhooks, subscription lifecycle, Customer Portal
- [ ] **User-Defined Accounts** — named accounts with type, institution, last 4

---

## 🧩 Phase 6: Add-On Platform

- [ ] Photography Website Builder
- [ ] Client Portal — invoices, quote approval, deliverable downloads
- [ ] Contract E-Sign
- [ ] Add-On Billing

---

## 🔭 Backlog

- Rate limiting on `/subscription/redeem`
- Automated test suite (unit + integration)
- `mailer.js` — stream large attachments instead of buffering
- Account merging by last-4 digits (auto-match CSV → Plaid sub-account)

---

## 🚩 Clean Up / Technical Debt

- **⚠️ Dependency Hygiene Protocol** — Any `api/package.json` change must regenerate `api/package-lock.json` in the same commit. Stale lock file = Vercel silent-skip = Lambda crash. Root cause of v7.6.7 outage. See Rule 10 in CLAUDE.md.
- **`file-type` moderate vuln (GHSA-5v7r-6r5c-r473)** — Infinite loop on malformed ASF audio file header. Impact: near-zero (receipts.js only handles JPEG/PNG/PDF). Fix requires `file-type@22` which is ESM-only — needs `receipts.js` refactor to dynamic `import()`. Not blocking.
- **`plaid_account_id` backfill** — Existing pre-v7.8.4 Plaid transactions have NULL `plaid_account_id`. Historical sub-account breakdown unavailable until users re-sync.

---

> All AI features use **Gemini exclusively** (BYOB model). No OpenAI or other providers.  
> All commits are Joshua Deuermeyer / Through The Lens Media only. No Co-Authored-By trailers.
