# 📙 Studio Tracker: 2026 Product Roadmap

This document outlines the strategic evolution of Studio Tracker from a financial ledger into an autonomous **AI Studio Manager**.

---

## ✅ PHASE 0: FOUNDATION & INVOICING (COMPLETED v5.2.0)
*   **Professional Invoicing Core**: Native 1" margin PDF generation, Invoice Cloning, and Pay Portal.
*   **Digital Signatures**: Dual e-signature capture for photographers and clients.
*   **Executive Dashboard**: Real-time Gross/Net/Burn tracking with multi-column sorting.
*   **AI Category Segregation**: Recognition of Dividend and Interest income.
*   [x] **Infrastructure Lockdown**: ✅ RLS fully activated. 40+ backend endpoints hardened (v6.0.0-SECURITY).

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

> [!NOTE]
> All AI features are powered by **Gemini** to ensure 100% data sovereignty, speed, and cost-efficiency.
