# Lumière Ledger — Master Roadmap

**Version:** v7.25.1 | **Last reviewed:** 2026-08-12  
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
| npm audit (api/ + web-react/) | ✅ Re-run 2026-07-01 (v7.10.19) — api/ 2 high fixed (form-data, multer), file-type moderate deferred (ESM-only); web-react/ all 5 vulns cleared |
| Dashboard customization | ✅ v7.9.1 — role selector in onboarding, widget toggles, gear panel, smart empty states, Dashboard tab in Control Center |
| Dependabot | ✅ v7.9.0 — `.github/dependabot.yml` live; weekly Monday scans; majors ignored for 6 risky packages |
| Open public signup | ✅ v7.9.5 — free-tier open signup (no code required); invite-code path validates + auto-redeems after email confirmation; `GET /api/subscription/validate-code/:code` public endpoint |
| SaaS Admin — member enrichment | ✅ v7.9.5 — Active Ledger Members now shows tier badge, estimated monthly revenue, Plaid account count, join date |
| Docs consolidation | ✅ 2026-07-01 — `SPEC.md` merged into `CLAUDE.md` and deleted. Was silently drifting because its update trigger was conditional; CLAUDE.md's update rule is unconditional and read first every session. |
| Plaid — Sync plan 5-account cap | ✅ v7.9.6 — `create-link-token` enforces limit; 403 `plaid_account_limit` error; upgrade UI in PlaidLink |
| Signup — password strength enforcement | ✅ v7.9.6 — 5-rule client-side validation + live strength meter; PROCESSING freeze fixed |
| Landing page — broader audience + SEO | ✅ v7.9.5/7.9.6 — hero copy, pricing comparison table, gear icon fix, OG/Twitter/canonical tags |
| Plaid Amex duplicate transactions | ✅ v7.10.9 — pending→posted transactions now merge in place via `pending_transaction_id` instead of insert+unlink; auto-flags remaining possible duplicates after every sync |
| Plaid connection health visibility | ✅ v7.10.9 — `needs_reauth`/`last_item_error` columns + `itemGet` check on sync; "⚠️ Reconnect" badge + update-mode Link on Accounts page (known gap: doesn't catch every Plaid-side failure mode — see Plaid webhook item below) |
| `profiles` table (never existed) — reports were broken | ✅ v7.10.12 — `api/utils/userDirectory.js` uses Supabase Auth admin API instead; fixed monthly/weekly/daily reports + watchdog |
| Activity pulse race condition | ✅ v7.10.12 — concurrent-tab duplicate-key error fixed with conflict fallback |
| Hardcoded ADMIN_UUID / PLAID_BILLING_EXEMPT (6 + 3 copies) | ✅ v7.10.11 — consolidated into `api/constants.js` (backend) + `web-react/src/constants/billing.js` (frontend) |
| Sync-plan users showing as "free" tier in UI | ✅ v7.10.11 — `deriveTier()` drift between stripe.js/AuthContext.jsx/SaasTab.jsx fixed |
| Spam/bot signups getting full active accounts | ✅ v7.10.13 — trial only grants after `email_confirmed_at` is set (confirmed: self-serve Stripe checkout without a code stays untouched — real design, not a bug) |
| Cloudflare Turnstile on signup | ✅ v7.10.14 — needs `TURNSTILE_SECRET_KEY` added to Vercel env panel to activate (fails open, harmless, until set) |
| Admin SaaS panel reorganized into tabs | ✅ v7.10.14 — Active Members / Invite Codes / Engagement Pulse, matching System Logs' tab pattern |
| `TURNSTILE_SECRET_KEY` added to Vercel | ✅ Confirmed by Joshua 2026-07-01 — Turnstile bot-challenge is now actually active, not just deployed |
| Security Review — Vercel links broken | ✅ v7.10.15 — 3 links used wrong org slug (`through-the-lens-media`), 404ing on every weekly check. Fixed. |
| Stripe checkout → webhook → tier gate | ✅ Confirmed end-to-end 2026-07-01 — Joshua ran a real test transaction + refund. `STRIPE_ROADMAP.md` was frozen at its pre-build planning state since 2026-05-18 despite this being live since v7.6.5/v7.8.27 — fully updated. |
| Plaid webhook support | ✅ v7.10.16-18 — real-time `ITEM` webhook (`ERROR`/`PENDING_EXPIRATION`/`USER_PERMISSION_REVOKED`/`LOGIN_REPAIRED`), JWT-verified. Backfill confirmed 2026-07-01 — all 8 active connections (Credit One Bank, Capital One ×2, Navy Federal, America First Credit Union, American Express, Venmo, USAA) registered via a temporary admin endpoint (ENCRYPTION_KEY is marked Sensitive in Vercel, couldn't run the standalone script locally). Endpoint removed after confirming. |
| Quarterly Security Review | ✅ v7.10.20 — first-ever run. Safe dep updates (both dirs), fixed the phantom-tables checklist grep itself (was silently missing double-quoted `.from()` calls), fixed 7 highest-risk silent-DB-failure sites, fixed a real `sync_monthly`/`sync_annual` gap in admin.js's plan-type list. Logged in `security_reviews` table. |
| Annual Security Review | ✅ v7.10.21 — first-ever run. Full RLS re-audit on all 25 public tables found and fixed a real gap: `user_daily_activity` had a redundant, overly-permissive `qual: true` policy alongside the correct per-user one — RLS OR's permissive policies together, so it would have won for any future code path using the anon client. Dropped. Confirmed `system_logs`/`security_reviews` intentionally have zero policies (service-role-only access, safe by design). |

---

## 🔴 Active — Fix Before Continuing

| Item | Notes |
|------|-------|
| **Receipt email body parse — re-test** | v7.8.96 hardened the prompt and error logging but the "Total Paid: $XX.XX" case was never re-tested with a live email forward. Send a test and verify System Logs show extracted amount. |
| **Security Review — dependency tier still overdue** | Weekly, monthly, quarterly, and annual all re-run 2026-07-01 (v7.10.15/19/20/21). Only the dependency tier has never been run once (it's a subset of what quarterly already covers — `npm audit`/`npm audit fix` in both dirs — low urgency). |
| **Stripe/Plaid ToS review + Google OAuth consent screen check** | Two annual-checklist items that need Joshua's own read, not something verifiable from code: Stripe Services Agreement / Plaid Legal for payment-processor policy changes, and Google Cloud Console → OAuth Consent Screen re-verification status. |
| **✅ Operational Intelligence accuracy fix — all 3 phases shipped (v7.20.1 → v7.21.0)** | Phase 1: `billing_cycle` column + `vendor_aliases` table. Phase 2: cadence-aware recurring-vendor math shared between the dashboard and weekly digest, `PUT/DELETE /api/vendors/alias`. Phase 3 (v7.21.0): Transaction Drawer "Billing Cycle" select (shown when Recurring is checked); Operational Intelligence table's inline MERGE action. **Still to do (not code — a manual data step):** merge Starlink + Starlink Internet, Apple + Apple Services + Apple iCloud, and set Hover's Billing Cycle to Annual, using the new UI. |

---

## 🌱 Growth & Polish Initiative (approved 2026-07-02)

Competitive gap analysis vs. QuickBooks Solopreneur / Keeper / Wave / FreshBooks: feature parity is there — the gaps are time-to-value, trust signals, and visual polish. Full plan approved by Joshua 2026-07-02.

### Phase A — Convert (Need)

| Item | Notes |
|------|-------|
| **A1 — "Money Story" import results screen** | ✅ v7.12.0 — fires after every successful CSV import / Plaid connect / sync (Joshua chose summary mode over first-import-only). `MoneyStoryModal.jsx` + shared `ModalShell.jsx`; opt-out persists to `settings.money_story_optout`. Onboarding wizard copy updated. |
| **A2 — "Deductions found ≈ tax savings" dashboard hero stat** | ✅ v7.14.0 — 5th KPI card on the executive snapshot: "$X deductions found (YTD) ≈ $Y off your tax bill." Savings = deductions × `settings.estimated_tax_rate` (same rate B1's Tax Set-Aside widget uses). `/api/metrics/summary` now computes `ytdDeductibleCents` using the exact same formula as `tax.js`'s Schedule C math — no separate calculation to drift out of sync. |
| **A3 — Home.jsx trust pass** | ✅ v7.12.0 — CSS product mockup (labeled "illustrative data"), founder's note, persona scenario cards (deliberately NOT fake named testimonials — FTC fake-review rule; swap in real quotes when available), security strip with `/security-policy` links. |

### Phase B — Retain (✅ shipped v7.13.0)

| Item | Notes |
|------|-------|
| **B1 — Quarterly tax set-aside widget** | ✅ `TaxSetAsideWidget.jsx` — "Set aside $X for Q3" = YTD net profit × `estimated_tax_rate` (user-editable in ProfileTab, default 30%). Deadlines match `brain.js`'s existing quarterly dates. **v7.15.2: fixed — `estimated_tax_rate` (and 5 other settings columns) were never actually migrated into the DB; the field silently failed to persist since it shipped. Real column now exists.** |
| **B2 — Subscriptions radar widget** | ✅ `SubscriptionsRadarWidget.jsx` — "$X/mo across N subscriptions", top 3 vendors. Reuses `metrics.analytics.recurringVendors` already fetched for Operational Intelligence — no extra API call. |
| **B3 — Weekly digest email** | ✅ built, live, and verified end-to-end (v7.15.3) — `GET /api/cron/weekly-report`. **Incident 2026-07-06 (fully resolved): sent 100+ real emails to Joshua over several hours.** Root cause was NOT the `force`/de-dupe flag logic (fixed in v7.15.1, insufficient alone) — the actual cause was `settings` missing 6 columns this route depends on, so the de-dupe `SELECT` errored silently and the guard never engaged. Migration `add_missing_settings_columns_v7_15_2` applied directly to production; both settings queries now fail closed on any DB error (v7.15.3) instead of silently proceeding. **Verified via database record:** `last_weekly_digest_sent_at = 2026-07-06 12:09:43 UTC` — the one send that landed in the gap between migration and the v7.15.2 pause deploying, the first time the stamp ever saved successfully. A manual verification call afterward was correctly blocked ("already sent this week"), confirming the de-dupe holds. Zero emails since; next send governed by the same 5-day/Monday rules as before. Admin-only gate (`ADMIN_UUID` filter, v7.13.2) remains in place underneath. |
| **B4 — Re-engagement email (14-day inactive)** | ✅ built, ⚠️ **disabled (v7.13.2)** — `GET /api/cron/reengagement-report` returns early with no sends. Joshua is handling re-engagement manually for now. Underlying logic (14-day inactivity query, 30-day de-dupe via `settings.last_reengagement_sent_at`, opt-out `settings.reengagement_email_optout`) now has real DB columns to write to (v7.15.2 migration) — was previously also silently broken the same way as B3, just never triggered live sends since it launched already-disabled. |
| **B5 — First-invoice-paid celebration moment** | ✅ In-app modal only (`InvoicePaidCelebration.jsx`), no email — fires when an invoice PATCH to `status=paid` makes the user's paid-invoice count exactly 1. |

### Phase C — Compete (Good to Have)

| Item | Notes |
|------|-------|
| **C1 — P&L / income-first dashboard view** | Invoices + Plaid deposits + profit line as a first-class view. |
| **C2 — Receipt auto-match** | Snap/forward a receipt → suggest matching transaction by amount+date, one-tap confirm. |

### Design Pass

| Item | Status |
|------|--------|
| **D1–D4 — Brand pass** (Fraunces display font incl. modals, refined accent via CSS vars, lucide-react icons replace emoji, tabular-nums money typography) | ✅ v7.11.0 — shipped 2026-07-02 |
| **D5 — Micro-polish** | ✅ v7.12.0 — `.skeleton` shimmer, `.empty-state` (applied to Transactions + Accounts zero-data), `.card-hover`, semantic `.amt-income/.amt-expense/.amt-danger/.amt-deduction` classes. Wider adoption of amt-* classes stays opportunistic. |
| **D6 — Inline-style consolidation** | ◐ In progress, opportunistic — v7.12.0 extracted shared `ModalShell.jsx`; continue per touched file in Phases B–C |

---

## 🟡 Address Soon — Technical Debt

| Item | Notes |
|------|-------|
| **`file-type` moderate vuln** | `receipts.js` uses `require('file-type')`. v22 is ESM-only — needs dynamic `import()` refactor. Near-zero real risk (ASF audio files only). Deferred. |
| **Silent DB failures — remaining lower-risk sites** | v7.10.20 fixed the 7 highest-risk sites (see CHANGELOG). Still unchecked, all lower stakes (best-effort cleanup or cosmetic): `documents.js` orphan-file delete, `receipts.js`/`import.js` pending-receipt and dedup cleanup deletes, `import.js` auto-vendor-name correction, `tax.js` bulk tax_deductible toggle, `invoices.js` line-item replace-on-edit, `mileage.js` IRS-rate seed upsert, `admin.js` beta-code notes update, `plaid.js` source-key-repair loop. Re-run the silent-DB-failures grep next quarter — it may surface new sites as the codebase grows. |
| **REDIS_URL — remove or wire up** | Bull was removed v7.8.90. Direct Resend fallback is intentional and working. Either set `REDIS_URL` and re-enable queue layer, or remove dead queue code from `emailQueue.js`. |
| **`plaid_account_id` backfill** | Pre-v7.8.4 Plaid transactions have NULL `plaid_account_id`. Sub-account spending breakdown won't work on historical data until users re-sync. Document or prompt user to sync. |
| **`rotate-plaid-tokens.js` references stale schema** | Found 2026-07-01 while building the webhook backfill script: `api/scripts/rotate-plaid-tokens.js` queries a `plaid_items` table with an `encrypted_access_token` column — current schema is `plaid_connections`/`access_token`. Verify and fix before ever actually running an `ENCRYPTION_KEY` rotation. |
| **`@google/generative-ai` SDK is EOL** | Found 2026-08-05 while scoping Brain reasoning tuning: pinned at v0.24.1, and Google permanently stopped shipping updates to this package on Aug 31, 2025. No `thinkingConfig`/thinking-budget support, and Gemini 3.x model compatibility isn't confirmed by Google's current docs — new development is pointed at the successor `@google/genai` package. Migration touches both Gemini call sites (`api/utils/gemini.js`, `api/routes/brain.js`) and needs its own testing pass. Prerequisite for the Gemini model picker below. |

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
| Client invoice history | ✅ v7.22.0–v7.23.0 — Clients tab (inside Invoicing) is a sortable/filterable table (name/email/phone/invoice count) with Merge (reassigns invoices + leads, deletes the duplicate), Delete (blocked if invoices are attached), and direct Email actions; clicking a client name opens a detail drawer with pipeline status + lifetime Total Paid/Outstanding. v7.23.0 added a **dedicated Clients page** (hamburger menu → Clients) with the same actions plus Open/Paid invoice counts, sortable Lifetime Value, and real edit-in-place (name/email/phone/address/notes — the first way to fix a client's info without deleting and re-adding). The two surfaces are intentionally kept separate, not merged. Remaining: create-time dedup by email so freehand invoice entry stops creating new duplicates in the first place (see Clean Up below), and full CRM/leads-directory unification — Phase 5. |
| Bank Import UI cleanup | Remove emojis, demote niche banks, surface Rocket Money as recommended |
| Apple Card CSV via email | Apple Card can't connect via Plaid. Detect `.csv` attachment in `emailInbound.js`, parse Apple Card format, bulk-insert with dedup. Workaround: manual CSV import. Build after email ingestion is stable. |
| 7-day unmatched receipt digest | Cron/UptimeRobot endpoint — email user list of `pending_receipts` older than 7 days |
| Account merging by last-4 digits | Auto-match CSV source to Plaid sub-account by institution + last 4 digits. Manual merge covers this for now. |
| AI Brain: Combine Similar Transactions | New AI action to detect and merge near-duplicate expense rows (pending+posted Plaid, CSV+Plaid overlap). Requires new action type in `AssistantSidebar.jsx`, backend merge route, and confirm UI before any writes. |
| AI Brain: user-selectable Gemini model | Let users pick their model in Settings (e.g. 2.5 Flash vs. a newer Flash tier) based on their own API key's budget/tier. Needs: `gemini_model` column on `settings` (idempotent migration, nullable, default `NULL` → `gemini-2.5-flash`), a small model registry in `api/constants.js`, and a dropdown in `IntelligenceTab.jsx` (reuse the existing `handleToggle` auto-save-on-change pattern already used there for `ai_silent_mode`/`ai_coaching_mode`). **Blocked on the `@google/generative-ai` SDK EOL item above** — a single-option picker has nothing to pick between until a second, verified-compatible model exists. |

---

## 🎛 Dashboard Customization (High Impact — Good to Have)

> Users pick which widgets appear on their dashboard. Removes photographer-specific clutter for non-photographers.

| Item | Notes |
|------|-------|
| **Widget visibility toggles** | User selects which tiles/charts appear — Equipment, Mileage, Category Breakdown, Forecast, KPIs, etc. Stored in `settings` table per user |
| **Drag-to-reorder** | Optional phase 2 — reorder widget position. Build toggles first. |
| **Non-photographer mode** | Preset that hides Camera & Equipment, Mileage, Photography category tiles in one click |

---

## ✅ Completed This Sprint (v7.7.0 → v7.10.21)

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
| v7.9.7 | SaaS admin — invite plan fix (plan_type now stored + redeemed correctly); invite notes field; Engagement Pulse tier badges; invite email shows assigned plan |
| v7.9.8 | Receipt email — Gemini 503 retry (3 attempts, backoff) on body parse; new ai_unavailable failure email with high-demand explanation |
| v7.9.9 | Receipt email — generate HTML receipt card for body-parse-only emails (no attachment); receipt_link now populated on matched expense |
| v7.10.0 | SaaS admin — tier badge fix (legacy annual/monthly → core); display name save fixed (upsert→update + error check); notes in edit modal (pre-filled, saveable) |
| v7.10.1 | Display name save root-cause fix — writes to `user_subscriptions` (the `profiles` table never existed); stale profiles join removed from GET /subscriptions |
| v7.10.2 | Stripe webhook error checking — failed subscription writes now return 500 so Stripe retries; no more silent billing state corruption |
| v7.10.3 | Code Drift Audit added to Quarterly Security Review — 3 grep checks: phantom tables, silent DB failures, stale plan-type lists |
| v7.10.4 | PWA AI sidebar mobile-nav clearance fix; onboarding re-entry from hamburger menu; nav label cleanup (Studio→Dashboard, Business Profile→Profile) |
| v7.10.5 | Plaid `/balances` backend 10-day DB-cached throttle — shared across devices, avoids per-load paid Plaid calls |
| v7.10.6 | User-managed categories — `user_categories` table, full CRUD, CategoriesTab, orphan freeform-category import banner |
| v7.10.7 | Categories bug fixes — orphan delete route ordering + NOT NULL constraint fix; parallel delete in CategoriesTab |
| v7.10.8 | Removed monthly spending summary modal (redundant with dashboard) |
| v7.10.9 | Plaid Amex duplicate-transaction fix (`pending_transaction_id` merge-in-place); auto duplicate-flagging after every sync; Plaid connection health (`needs_reauth`) + update-mode reconnect flow |
| v7.10.10 | Fixed "What's New" badge re-lighting after being read — `CURRENT_VERSION` was hardcoded twice with two different values |
| v7.10.11 | Consolidated hardcoded `ADMIN_UUID`/`PLAID_BILLING_EXEMPT` into `api/constants.js` + `web-react/src/constants/billing.js`; fixed Sync-plan tier showing as "free" in UI; fixed feedback.js's unverified email fallback domain |
| v7.10.12 | Fixed monthly/weekly/daily admin reports + watchdog — all depended on a `profiles` table that never existed; fixed via `listAllUsers()` (Supabase Auth admin API). Fixed activity-pulse race condition (concurrent-tab duplicate-key error) |
| v7.10.13 | Gated the automatic 30-day trial signup on email confirmation — stops scripted/bot signups from getting full active accounts with zero verification. `/subscription/redeem` upgraded to upsert |
| v7.10.14 | Cloudflare Turnstile added to signup form (needs `TURNSTILE_SECRET_KEY` in Vercel to activate); Admin SaaS panel split into tabs (Active Members / Invite Codes / Engagement Pulse) |
| v7.10.15 | Fixed broken Vercel dashboard links in Security Review checklist — wrong org slug on 3 links, found during weekly review |
| v7.10.16 | Plaid webhook for real-time connection health (`ITEM` events, JWT-verified) — replaces poll-only `needs_reauth` detection |
| v7.10.17 | Temporary admin endpoint to backfill Plaid webhook registration on existing connections (standalone script blocked by Vercel's Sensitive-flagged `ENCRYPTION_KEY`) |
| v7.10.18 | Removed temporary Plaid webhook backfill endpoint — all 8 connections confirmed registered |
| v7.10.19 | Monthly security audit — fixed 2 high vulns in api/ (form-data, multer), cleared all 5 in web-react/ |
| v7.10.20 | Quarterly security audit — safe dep updates both dirs, fixed the phantom-tables audit grep itself, fixed 7 silent DB-write failure sites, fixed sync_monthly/sync_annual gap in admin.js plan list |
| v7.10.21 | Annual security audit — removed an overly-permissive `qual: true` RLS policy on `user_daily_activity` that OR'd against the correct per-user policy |

---

## 🧠 Phase 2: AI Agentic Capabilities — Remaining

> **Status: Paused after Step 4** — Brain is stable. Resuming post-launch.

- [x] Step 1–4 ✅ shipped — read tools, write tools, confirmation UI, edit transactions
- [ ] **Step 5 — Invoice Creation** (deferred) — `create_invoice_draft` write tool
- [ ] **Step 6 — Chart/Analysis Output Popup** (deferred) — Chart.js modal + Download CSV

### Capability audit (2026-07-06) — where the Brain stands vs. market

Full inventory: `api/routes/brain.js` (11 tools — 6 read, 5 write, all writes require in-app approval before executing), `gemini-2.5-flash`, session-only chat memory (last 10 messages, resets on reload), document context injected as raw text (no embeddings — `getEmbedding()` exists but is never called), 50-txn-per-run batch ledger repair.

**Confirmed gaps vs. Keeper/QuickBooks Solopreneur/Cleo-style assistants:**
1. **No persistent memory** — every session starts cold, no rolling history across visits.
2. **No proactive insights** — Brain only answers when asked; the `ai_coaching_mode` toggle in `IntelligenceTab.jsx` is UI-only, backend never checks it.
3. **No receipt line-item parsing** — Vision use is limited to full-text transcription, not itemized extraction.
4. **No voice input.**
5. **Security gap, unrelated to competitive parity:** ✅ **Fixed v7.15.0** — BYOB Gemini keys now encrypted at rest (see Clean Up section above).

**Priority order (Joshua confirmed all four, 2026-07-06):**
1. ✅ **v7.15.0 — Encrypt `settings.gemini_api_key` at rest.** Shipped: `decryptOrPlain()` helper in `cryptoUtil.js`, encrypt-on-save/decrypt-on-read in `settings.js` and all 6 downstream read sites (`brain.js` ×2, `receipts.js`, `documents.js`, `import.js`, `emailInbound.js`), one-time migration script `api/scripts/encrypt-existing-gemini-keys.js` (idempotent, `--dry-run` supported). **v7.15.4:** `ENCRYPTION_KEY` is Sensitive in Vercel and can't be exported locally, so added a temporary admin route (`POST /admin/encrypt-gemini-keys`, `?dry_run=1` supported) to run the same migration server-side — same precedent as the v7.10.17 Plaid webhook backfill. **v7.15.5 — Complete:** migration executed against production, both users' keys confirmed encrypted via direct SQL (0 plaintext, 0 failures), temporary route removed.
2. ✅ **v7.16.0 — Persistent conversation memory.** New `brain_messages` table (RLS-scoped, `api/migrations/011_brain_messages.sql`); `GET /brain/messages` for frontend hydration; `POST /brain/ask` sources Gemini history server-side (last 10 messages) instead of trusting a client-supplied array; `AssistantSidebar.jsx` hydrates on mount. Both sides of each exchange persisted (awaited, not fire-and-forget, to survive Vercel's post-response function freeze).
3. **Next up — v7.17.0: Proactive coaching.** Planned 2026-07-06, not yet built. Piggybacks on the already-hardened weekly digest cron infra (Phase B) instead of building new delivery machinery — lowest-cost, highest-leverage of the three remaining items, since it reaches users already engaged with a system that's proven stable through the v7.15.x incident response.
   - **`api/utils/gemini.js`** — new `generateWeeklyInsight(apiKey, { incomeCents, spendCents, netCents, missingReceiptCount, taxSetAsideCents })`. Single-shot `model.generateContent(prompt)` call, same pattern as the existing `repairLedgerBatch()`. Prompt asks for ONE short (<200 char) coaching sentence — no tool-calling loop, no multi-step aggregation (the v7.16.1 lesson applies: keep this deterministic-input/single-output, not a chain the model has to reconcile itself).
   - **`api/routes/cron.js`** (`GET /cron/weekly-report`, inside the existing per-user loop) — add `ai_coaching_mode` to the settings `SELECT`. If the toggle is on AND a Gemini key is set AND there's real data to report: decrypt the key via the existing `decryptOrPlain()`, call `generateWeeklyInsight()` wrapped in try/catch. On any failure (bad key, Gemini 503, empty response), log and send the digest without the insight — the AI call must never block or break the email that's already been hardened through the v7.15.x incident.
   - **`api/utils/mailer.js`** (`sendWeeklyDigestEmail`) — add an optional `aiInsight` param; new template section slots in after the tax set-aside card, before the CTA button, matching the existing dark-card visual style.
   - **No new frontend work** — the `ai_coaching_mode` toggle and its copy already exist in `IntelligenceTab.jsx` and already save correctly; this just makes the backend finally read a flag that's been inert since it shipped.
   - **Verification plan:** trigger `?preview=1` on `/cron/weekly-report` with `ai_coaching_mode` on for a test account, confirm the insight text appears in the dry-run response payload with zero sends; then one real Monday-cycle send to confirm it renders correctly in the actual email.
   - **Files touched:** `api/utils/gemini.js`, `api/routes/cron.js`, `api/utils/mailer.js`. Docs to update alongside: `CHANGELOG.md`, `ROADMAP.md`, `ChangeLogModal.jsx`, `version.json`, `App.jsx` (standard SOP).
4. **Then — v7.18.0: Receipt line-item parsing.** Planned, not yet built. Smaller lift than it sounds — `/receipts/extract` already returns structured JSON (vendor, date, total, tax, tip, category), so this is a prompt extension, not new architecture.
   - **`api/routes/receipts.js`** (`/extract` prompt) — extend the existing JSON-extraction prompt to also request a `line_items` array: `[{ description, quantity, unit_price, amount }]`, `null`/`[]` when the receipt has no itemization (e.g. a subscription charge).
   - **New column** `expenses.line_items JSONB` (nullable, idempotent `ADD COLUMN IF NOT EXISTS` migration) — a proper structured home for this data rather than stuffing it into the existing free-text `notes` field.
   - **`web-react/src/components/TransactionDrawer.jsx`** — when `extracted.line_items` is present and non-empty, show a small read-only itemized list under the amount field before the user saves — informational, not editable in v1.
   - **Deferred, not blocking v1:** upgrading `@google/generative-ai` to 0.26+ for `responseSchema`-mode structured output (more reliable than prompt-only JSON) — a follow-up hardening step once v1 ships and real-world extraction reliability is observed.
   - **Verification plan:** upload a real itemized receipt image via a test transaction, confirm `line_items` populates and renders; confirm a non-itemized receipt (e.g. subscription) gracefully returns empty/null without breaking the existing extraction flow.

**✅ v7.16.1 — Fixed a real-world data-accuracy bug found while using v7.16.0.** Joshua asked "how much have I paid to credit cards this year" and Gemini returned fabricated per-account numbers that didn't match the ledger (confirmed via direct SQL). Root cause: `search_transactions` only took one category filter, so combining "Credit Card Payment" + "Internal Transfer" required Gemini to call it twice and manually sum the results in prose — an unreliable multi-step-arithmetic task for an LLM. Fixed by accepting a comma-separated category list matched via a single `.or()` query, so the total/breakdown are computed once in code. General lesson: any Brain answer requiring the model to combine numbers across multiple tool calls is a latent accuracy risk — prefer a single deterministic tool call over model-side aggregation wherever a query can be expressed that way.

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

- **✅ Dashboard data-consistency audit (v7.14.0)** — full pass across `DashboardV2.jsx`/`metrics.js` after the OpIntell/Subscriptions Radar dollar mismatch (v7.13.1) suggested more of the same bug class. Found and fixed: (1) `metrics.js` used a narrow 5-keyword substring filter to exclude transfers/refunds from YTD income/spend, while `cron.js`'s weekly digest used a fuller 16-category exact-match list (`NON_SPEND_CATS`) — the two disagreed on rows like "Refund" or "Reimbursement", producing different YTD totals on the dashboard vs. the email for the same data. Extracted the exclusion logic into `api/utils/spendCategories.js`, shared by both routes. (2) `OpIntellComponents.jsx` formatted cents with manual `.toLocaleString()` — `undefined`/`null` values rendered as `$NaN`; replaced with a safe `Intl.NumberFormat`-based helper. **Verified NOT a bug:** Operational Intelligence's "Expense Pressure" insight (all recurring vendors) vs. Subscriptions Radar (subscriptions only) are two intentionally different, clearly-labeled metrics — no fix needed. **Flagged, not yet fixed:** `tax.js`'s `/tax/summary` (Schedule C basis for the Tax page) applies **no category exclusion at all** — it sums every expense row into a bucket (including "Unassigned"), so an "Internal Transfer" or "Credit Card Payment" accidentally left uncategorized would inflate the Tax page's total spend/deductible figures. This touches tax-return-adjacent numbers, so it needs Joshua's explicit direction before changing — noted here rather than silently altered. **Follow-up bug found and fixed (v7.23.1):** the unified `NON_SPEND_CATS` set from this audit was itself the bug — it excluded real income categories (`Photo Income`, `Reimbursement`, etc.) from income totals, not just spend totals, silently dropping real income (confirmed: a Venmo `Photo Income` payment invisible to both the digest and dashboard). Split into `INCOME_CATS`/`TRANSFER_CATS` with a new `isNonIncomeRow()` check — see CHANGELOG.md.
- **✅ AI Brain — Gemini key encryption (v7.15.0)** — `settings.gemini_api_key` was stored unencrypted, inconsistent with the app's existing Plaid-token standard. Now encrypted the same way (libsodium, `ENCRYPTION_KEY`). **Action needed:** run `api/scripts/encrypt-existing-gemini-keys.js --dry-run` then for real against production (needs local `.env` with `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`ENCRYPTION_KEY`, same as the Plaid rotation runbook) to migrate existing plaintext keys — code is safe to run before this (falls back to plaintext until migrated).
- **⚠️ AI Brain — remaining gaps** — dead/inert code found in the same audit: `ai_silent_mode` (this one IS actually read, by `import.js`'s silent-mode repair) and `ai_coaching_mode` toggles in `IntelligenceTab.jsx` — `ai_coaching_mode` saves a setting the backend never reads. `classifyTransactions()` and `getEmbedding()` in `api/utils/gemini.js` are exported but never called by any route. See AI Brain roadmap section below for the full capability inventory and remaining priority order.
- **✅ Weekly digest resend incident (2026-07-06) — root cause + lesson, fully closed** — Phase B (v7.13.0) shipped code referencing 6 `settings` columns that were never actually migrated into the database (`estimated_tax_rate`, `weekly_digest_optout`, `reengagement_email_optout`, `last_weekly_digest_sent_at`, `last_reengagement_sent_at`, `money_story_optout`). The resulting `SELECT`/`upsert` calls in `cron.js` errored on every call — silently, because neither call site checked the returned `error` — so the de-dupe guard's settings map was always empty and 100+ real emails went out over several hours before being caught. Same bug class as the existing "Silent Supabase failure pattern" (`{ error }` never throws) already tracked from prior security reviews. **Fixed:** migration `add_missing_settings_columns_v7_15_2` applied directly to production. **Fixed (v7.15.3):** both settings queries in `cron.js` now fail closed (refuse to send, HTTP 500, logged loudly) on any DB error instead of silently proceeding — a future schema drift can no longer repeat this incident. **Verified:** database record confirms `last_weekly_digest_sent_at = 2026-07-06 12:09:43 UTC` — one legitimate send landed in the migration-to-pause gap and correctly stamped for the first time; a manual post-deploy check was correctly blocked by the de-dupe guard. **Process lesson:** any code referencing a new `settings` column needs its migration verified against the live schema (`information_schema.columns`), not assumed from the generic upsert accepting arbitrary JSON keys at the API layer.
- **⚠️ Dependency Hygiene Protocol** — Any `api/package.json` change must regenerate `api/package-lock.json` in the same commit. Stale lock file = Vercel silent-skip = Lambda crash. Root cause of v7.6.7 outage. See Rule 10 in CLAUDE.md.
- **`file-type` moderate vuln (GHSA-5v7r-6r5c-r473)** — Infinite loop on malformed ASF audio file header. Impact: near-zero (receipts.js only handles JPEG/PNG/PDF). Fix requires `file-type@22` which is ESM-only — needs `receipts.js` refactor to dynamic `import()`. Not blocking.
- **`plaid_account_id` backfill** — Existing pre-v7.8.4 Plaid transactions have NULL `plaid_account_id`. Historical sub-account breakdown unavailable until users re-sync.
- **✅ Client list/merge/delete/email + `invoice_number` scope fix (v7.22.0)** — Clients tab replaced (card grid → table with Merge/Delete/Email actions), prompted by real production duplicate client records with no cleanup tool. Also fixed two bugs found/left over while building this: (1) `fetchAllInvoices` (`web-react/src/api/index.js`) only ever fetched the first 50 invoices — never paginated despite the route supporting it; now pages through everything, same pattern as `fetchAllExpenses`. (2) `invoices.invoice_number` had a database-wide `UNIQUE` constraint instead of one scoped per user (`api/migrations/016_scope_invoice_number_unique_per_user.sql`, applied to production 2026-08-06) — two unrelated accounts could never share an invoice number, so every new user's suggested first invoice number (`INV-1001`) could only ever belong to one account, total.
- **⚠️ Client creation still doesn't dedup by email** — typing a client name/email freehand into the invoice form always inserts a new `clients` row, even if the name/email exactly match an existing client (only reused if you explicitly click an existing client first). This is the actual root cause of the duplicate-client mess Merge (above) cleans up after the fact. `api/routes/intake.js`'s lead-intake endpoint already has the right case-insensitive `ilike` email-lookup pattern to mirror into `handleCreateInvoice`'s client-creation branch in `Invoice.jsx`. Not yet built.
- **✅ `SaasTab.jsx` hardcoded values audit (v7.19.2)** — found while diagnosing the `dvaldivia2013` "CORE plan, no Stripe charge" question (v7.19.1). Fixed: (1) `isAdmin` now checks `user.id === ADMIN_UUID` (added to `web-react/src/constants/billing.js`) instead of a hardcoded login email — restores single-source-of-truth pattern from the v7.10.11 audit. (2) `PLAN_OPTIONS` now includes `sync_monthly`/`sync_annual` so Sync tier can be set from the Edit dropdown without SQL. (3) `90`-day invite/extend duration extracted to `INVITE_VALID_DAYS`/`EXTEND_DAYS` constants (still duplicated against `api/routes/admin.js`'s `/extend` route by hand — no shared package across the boundary). (4) Admin "Monthly Est." column now adds the 2.9%+$0.30 Stripe pass-through fee on top of the $0.50/account Plaid line item (confirmed against `PLAID_BILLING_SPEC.md` — base rate was already correct, just missing the fee layer that appears on real invoices). (5) `TIER_COLORS` gives Sync its own `.tag.accent` class (new, `var(--accent)`-based) instead of blending into Free's `secondary` gray. `PLAN_COST` price map left as-is per Joshua's call — display-only estimate, not worth deriving from Stripe.

---

> All AI features use **Gemini exclusively** (BYOB model). No OpenAI or other providers.  
> All commits are Joshua Deuermeyer / Through The Lens Media only. No Co-Authored-By trailers.
