# 📙 Lumière Ledger: 2026 Product Roadmap

This document outlines the strategic evolution of Lumière Ledger from a financial ledger into an autonomous **AI Studio Manager**.

---

## 🏃 ACTIVE SPRINT — May 2026

> Last reviewed: 2026-05-13

### 🔥 NOW — Unblock & Ship
These are blocking the public SaaS launch. Nothing else starts until these are closed.

| Item | Owner | Notes |
|------|-------|-------|
| **Rebrand launch** — domain, OAuth, Supabase, code | Joshua | Target was May 2026 — in progress. See `REBRAND_ROADMAP.md` |
| **Purchase `lumiereleadger.com`** | Joshua | Domain not yet confirmed purchased |
| **Logo concept selection** | Joshua | 3 concepts ready — decision needed |
| **Google OAuth redirect updated** | Joshua | Add new domain to GCP Console before switching |
| **Supabase auth redirect updated** | Joshua | Add `lumiereleadger.com` to allowlist before switching |
| **Vercel: `REDIS_URL` env var** | Joshua | Required to activate email queueing |
| **RLS full activation verification** | Dev | Policies written — final multi-tenant audit pending |
| **Security validation checklist** | Dev | See `LAUNCH_FIXES.md` — Post-Hardening tests not yet run |

### ⏭ NEXT — After Rebrand Ships
| Item | Notes |
|------|-------|
| Maps Autopilot (mileage) | In progress — Google Maps A→B→A round-trip |
| Stripe billing integration | Deferred until launch hardening complete |
| Fast Receipt Processing (Phase 3) | Drag-drop + Vision model auto-extract |
| User-Defined Accounts (Phase 5) | See feature spec below |

### 🔭 LATER — Backlog
| Item | Notes |
|------|-------|
| AI Function Calling (Phase 2) | Write to DB from chat |
| RAG document indexing (Phase 3) | PDF receipts + contracts |
| Semantic search / pgvector (Phase 4) | Natural language ledger recall |
| Plaid live bank sync | Pending Plaid approval + `cryptoUtil.js` real impl |
| Website Builder add-on (Phase 6) | Post-SaaS launch |

---

## ✅ PHASE 0: FOUNDATION & INVOICING (COMPLETED v5.2.0)
*   **Professional Invoicing Core**: Native 1" margin PDF generation, Invoice Cloning, and Pay Portal.
*   **Digital Signatures**: Dual e-signature capture for photographers and clients.
*   **Executive Dashboard**: Real-time Gross/Net/Burn tracking with multi-column sorting.
*   **AI Category Segregation**: Recognition of Dividend and Interest income.
*   [x] **Infrastructure Lockdown**: ✅ RLS fully activated. 40+ backend endpoints hardened.
*   [x] **System Reliability Watchdog**: ✅ Hourly internal cron job to test DB/SMTP health with automated email alerts.
*   [x] **Uptime Monitoring**: ✅ Layer 1 external HTTP ping via UptimeRobot to ensure public API availability.

---

## ✅ PHASE 1: INTELLIGENCE HUB & FIELD SPEED (COMPLETED v5.2.0)
*   [x] **Global Archive Awareness**: AI Brain now fetches across 3,200+ historical entries (3+ years) for every query.
*   [x] **AI Retry Mechanism**: Hardened "Forensic Scan" handles Gemini 503 high-demand errors automatically.
*   [x] **Mobile Field Speed**: Numeric/Decimal keyboards and visible dark-mode calendars for rapid field logging.
*   [x] **Operational Intelligence Revamp**: Complete rebuild of the recurring subscription tracking layout with action-filters and top-offender snapshots.
*   [x] **Manual Transaction Sovereignty**: First-class support for logging Venmo, Cash, and Apple Pay directly to the ledger.
*   [x] **Admin Diagnostic Transparency**: Real-time service key validation and "Key Hint" dashboard for SaaS owners.
*   [ ] **Maps Autopilot (IN PROGRESS)**: Google Maps A→B→A round-trip integration for mileage tracking with auto-calculated distance.

### Phase 1 — Mobile UX Patch (2026-05-13)
*Fixes applied during mobile field-testing sprint.*

*   [x] **Import clock integrity**: Days-since-import badge now ignores manual entries — only reflects actual bank/CSV imports.
*   [x] **Calendar icon visibility**: `filter: brightness(0) invert(1)` forces white icon regardless of OS color scheme. Tap area padded to 18×18px minimum.
*   [x] **Amount field UX**: New transactions open with empty amount field (not pre-filled `0.00`). Field also self-clears on focus if value is zero.
*   [x] **Checkbox row layout**: "Tax Deductible" and "Recurring" flags now render on one line with `flex-nowrap`. No wrapping on any screen width.
*   [x] **Dynamic account source dropdown**: Source selector now builds itself from the logged-in user's own imported data via `useFilterOptions`. Zero hardcoded card names. Each user sees only their own accounts. New users see a hint to import or connect Plaid. (See Phase 5 for User-Defined Accounts upgrade path.)
*   [x] **Receipt upload — gallery + file access**: Removed `capture="environment"` which forced camera-only on mobile. Users can now select from photo library, Files app, iCloud Drive, or saved email attachments.
*   [x] **Missing doc threshold**: MISSING DOC badge now only appears on transactions where `amount > $75` AND tax deductible AND no receipt. Applied consistently to both mobile card view and desktop table Doc column.
*   [x] **PWA session persistence**: Supabase client initialized with `autoRefreshToken: true`, `persistSession: true`, and stable `storageKey`. Added `visibilitychange` listener to refresh token on every app foreground — eliminates forced logout when PWA is closed and re-opened.

---

## ✅ PHASE 1.5: WEBSITE LEAD CAPTURE & ADD-ON PLATFORM (COMPLETED v7.1.0)

*Bridges the TTLM public website and Lumière Ledger in real time. Establishes the add-on revenue layer.*

*   [x] **Real-Time Lead Intake**: `POST /api/intake` — public server-to-server endpoint receives booking form submissions. Validates per-user API key, inserts lead, returns `ok: true` within milliseconds.
*   [x] **Client Deduplication**: Email-based lookup before insert. Returning clients link to existing record — no duplicate cards. `isReturning` flag appended to lead notes.
*   [x] **Multi-Tenant Intake Keys**: `intake_keys` table stores per-user API keys. Each user generates their own `ll-xxxx` key in the Integrations tab. Keys are rotatable (revoke + re-generate). Service role bypasses RLS for server-side key lookup.
*   [x] **Legacy Env Fallback**: Single-owner setup using `LUMIERE_INTAKE_SECRET` env var still works without DB migration for existing users.
*   [x] **Real-Time In-App Notifications**: Supabase Realtime `postgres_changes` subscription fires on `leads` INSERT filtered by `user_id`. Delivers slide-in toast (8s auto-dismiss, click → CRM) and badge counter on nav + dropdown.
*   [x] **Integrations Tab**: Control Center tab at `?tab=integration` for key management — generate, label, copy, revoke, view env var setup panel and code snippet.
*   [x] **Add-On Marketplace (`/addons`)**: Surfaces available add-ons (Website Lead Capture — active) and coming-soon add-ons (Website Builder, Client Portal, Contract E-Sign). Accessible from main nav dropdown.
*   [x] **TTLM Form Worker Updated**: `functions/api/form.js` v2.0.0 — success gate is Turnstile + owner email only. GAS, D1, customer email, and Lumière intake are all fire-and-forget via `context.waitUntil`. Non-blocking.

---

## 🧠 PHASE 2: AI AGENTIC CAPABILITIES ("STUDIO HANDS")

> **Implementation order is fixed — do not skip steps. Each step is a safety gate for the next.**

### Step 1 — Read-Only Tool Calls (backend only, zero write risk)
*Files: `api/routes/brain.js`, `api/utils/gemini.js`*
- [ ] Wire Gemini function calling API into `brain.js` with `tools` declarations
- [ ] Define 4 read tools: `search_transactions`, `get_lead`, `get_invoice_summary`, `get_metrics_snapshot`
- [ ] Handle `functionCall` response parts: execute → return `functionResponse` → get final answer
- [ ] No UI changes needed — AI answers questions using live data mid-conversation
- [ ] Deliverable: prompt "What did I spend on meals this quarter?" returns real DB data

### Step 2 — Confirmation UI (frontend only, before any writes exist)
*Files: `web-react/src/components/AssistantSidebar.jsx`*
- [ ] API returns `pendingActions[]` array alongside text response when a write is requested
- [ ] Sidebar renders action cards: what AI wants to do, exact data it would write, Approve / Reject buttons
- [ ] Approve → `POST /api/brain/execute-action` with signed action payload
- [ ] Reject → nothing executes, AI is notified via follow-up message
- [ ] Safety rule: **no write tool goes live until this UI is tested and confirmed**

### Step 3 — Write Tools (gated by Step 2 confirmation)
*Files: `api/routes/brain.js`, new `api/routes/brain-execute.js`*
- [ ] `create_transaction(date, vendor, amount, category, tax_deductible)` → POST /expenses
- [ ] `update_lead_status(lead_id, new_status)` → PATCH /leads/:id
- [ ] `link_transaction_to_lead(transaction_id, lead_id)` → PATCH /expenses/:id
- [ ] All writes route through existing authenticated Express endpoints — no new DB logic
- [ ] Deliverable: *"I just finished the Miller shoot. Link the $500 deposit to their lead and mark them as Booked."* executes correctly with confirmation

### Step 4 — Invoice Generation
*Files: `api/routes/brain-execute.js`, `web-react/src/components/AssistantSidebar.jsx`*
- [ ] `create_invoice_draft(client_name, line_items, due_date)` → POST /invoices
- [ ] Most complex: invoice data is structured (line items, client, due date, tax)
- [ ] Implement last, after Steps 1–3 are stable and battle-tested
- [ ] Deliverable: *"Draft an invoice for the Miller wedding — $2,400 for full-day coverage, due in 30 days."*

---

## 📷 PHASE 3: COMPUTER VISION & RAG (DOCUMENT ANALYST)
*   [ ] **Fast Receipt Processing** *(NEXT SPRINT)*:
    *   Drag-and-drop receipt capture in the transaction ledger that instantly logs vendor and amount via Vision models before the user even clicks "save".
*   [ ] **RAG (Retrieval-Augmented Generation)**:
    *   Direct indexing of uploaded PDF receipts, contracts, and lease agreements.
    *   Extract critical data (Serial #s, Term dates, Interest rates) instantly into the database.
*   [ ] **Smart Receipt Scanner (DEFERRED)**:
    *   Adobe Scan-style edge detection using WebAssembly (OpenCV.js) for mobile camera capture.
    *   Perspective warp + contrast enhancement before uploading. ~1.5MB load cost.

---

## 🚀 PHASE 4: SEMANTIC MEMORY & PREDICTIVE FORECASTING
*   [ ] **Semantic Search (Vector Embeddings)**:
    *   Implement pgvector/embeddings for lifetime transaction recall.
    *   Enable natural language search across notes, equipment, or leads ("Find that weird AWS charge from two years ago").
*   [ ] **Burn Rate Predictive Alerts**:
    *   Proactive warnings when current monthly velocity exceeds historical averages.

---

## 🏦 PHASE 5: ENTERPRISE INTEGRATIONS & ACCOUNT MANAGEMENT

### Strategic Account Mapping & Plaid Integration (Deferred)
*   [ ] Connect live bank feeds via Plaid. Pushed out to prioritize core platform autonomy.
*   [ ] `cryptoUtil.js` — Replace stub with real `libsodium-wrappers` async implementation before Plaid goes live.
*   [ ] Add `ENCRYPTION_KEY` to Vercel production env.

### User-Defined Accounts *(Option 3 — Planned)*

> **Context:** The current account source dropdown is dynamically built from each user's imported data (Option 2, shipped 2026-05-13). Option 3 replaces that with user-managed named accounts — the right architecture for a mature multi-user product.

**Why this matters at scale:**
- At 100+ users, everyone has different cards and accounts. A dynamic read from import data works, but users can't *name* their accounts in a way that's meaningful to them.
- "delta_amex" in the ledger is a code key — "Delta SkyMiles Amex Business" is what the user wants to see everywhere in the UI.
- User-defined accounts also enables future features: per-account spend limits, per-account tax rules, account-level reconciliation.

**Feature spec:**
*   [ ] **Accounts settings page** (Control Center → Accounts tab):
    *   Add account: name, type (checking / savings / credit card / cash), last 4 digits (optional), institution.
    *   Each account generates a stable internal key used as the `source` field value.
    *   Edit and delete accounts (with guard if transactions reference the account).
*   [ ] **Source dropdown migration**:
    *   Replace `useFilterOptions` dynamic extraction with a fetch from the user's saved accounts.
    *   Preserve backward compatibility — any legacy source key not in the accounts table falls back to the label map and raw key display (no data loss).
*   [ ] **Account reconciliation view** (Phase 5 stretch):
    *   Per-account transaction list with running balance.
    *   Flag when imported statement balance diverges from ledger total.
*   [ ] **Plaid account linking** (Phase 5, post-Plaid approval):
    *   Link a user-defined account to a live Plaid account ID.
    *   Auto-tag imported Plaid transactions with the correct user-defined account.

**Implementation order:**
1. `accounts` table in Supabase (idempotent migration, RLS-secured per user_id)
2. Accounts tab in Control Center (CRUD UI)
3. Source dropdown reads from accounts table
4. Backward-compatible fallback for legacy source keys
5. Plaid account linking (deferred until Plaid work begins)

*   [ ] **Paid Subscriptions / SaaS Upgrades**:
    *   Advanced tiering and paywalls for premium functionality.

---

## 🧩 PHASE 6: ADD-ON PLATFORM & PHOTOGRAPHER WEBSITE BUSINESS

*Revenue expansion — Lumière Ledger becomes the backend for a photography website business.*

*   [x] **Phase 6 Foundation**: Intake key infrastructure + Add-On Marketplace page shipped.
*   [ ] **Photography Website Builder**: Conversion-optimized Cloudflare Pages template pre-wired to Lumière intake. One product sale = one live website + one active integration key.
*   [ ] **Website Builder Pricing Tier**: Subscription add-on billed through Lumière Ledger. Admin assigns key + domain on purchase.
*   [ ] **Client Portal**: Branded portal for clients to review invoices, approve quotes, and download deliverables. Syncs status back to CRM automatically.
*   [ ] **Contract E-Sign**: Send, sign, and store contracts directly from the CRM pipeline. Pre-built photography contract templates included.
*   [ ] **Add-On Billing**: Stripe integration for per-add-on recurring charges. Admin dashboard tracks revenue per add-on per user.

---

> [!NOTE]
> All AI features are powered by **Gemini** to ensure 100% data sovereignty, speed, and cost-efficiency.
