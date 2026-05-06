# 📙 Lumière Ledger: 2026 Product Roadmap

This document outlines the strategic evolution of Lumière Ledger from a financial ledger into an autonomous **AI Studio Manager**.

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
*   [ ] **AI Function Calling**:
    *   Grant the "Your Assistant" sidebar the ability to write to the database (create/update records).
    *   **Prompt**: *"I just finished the Miller shoot. Link the $500 deposit to their lead and mark it as Booked."*
*   [ ] **Automated CRM & Invoicing**:
    *   Voice/Chat command to automatically generate draft invoices based on quoted lead values.
    *   Trigger workflow automations natively without manual clicks.

---

## 📷 PHASE 3: COMPUTER VISION & RAG (DOCUMENT ANALYST)
*   [ ] **RAG (Retrieval-Augmented Generation)**:
    *   Direct indexing of uploaded PDF receipts, contracts, and lease agreements.
    *   Extract critical data (Serial #s, Term dates, Interest rates) instantly into the database.
*   [ ] **Fast Receipt Processing**:
    *   Drag-and-drop receipt capture in the transaction ledger that instantly logs vendor and amount via Vision models before the user even clicks "save".
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

## 🏦 PHASE 5: ENTERPRISE INTEGRATIONS & MAPPING (DELAYED)
*   [ ] **Strategic Account Mapping & Plaid Integration**:
    *   Map external financial sources to internal profiles.
    *   Connect live bank feeds via Plaid. (Pushed out to prioritize core platform autonomy).
*   [ ] **Paid Subscriptions / Saas Upgrades**:
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
