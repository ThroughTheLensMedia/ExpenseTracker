# Studio Tracker v4.2 Engineering Specification 📸🏛️

### Objective
To build the world's most elite, AI-driven financial "First-Class" command center specifically for professional photographers. The application enables automated expense forensics, retroactive ledger repair, and strategic business advice using a private "Bring Your Own Brain" (BYOB) architecture.

---

### Constraints
1. **Architecture**: Full-stack Node.js (Express API) + React (Frontend).
2. **Database**: Supabase / Postgres with Row-Level Security (RLS) for 100% data isolation.
3. **AI Engine**: Google Gemini 2.5 Flash. Users must provide their own Gemini API keys for privacy and cost control.
4. **Design System**: Vanilla CSS with modern Glassmorphism, deep dark mode, and high-performance micro-animations.
5. **Security**: LIVE studio-wide metrics (Burn Rate, Top Purchases) are strictly limited to the site owner; standard users access high-level advisory only.

---

### File Map
#### 🧠 AI & Backend
- `/api/routes/brain.js`: The "Intelligence Hub" handling Chat & Ledger Repair.
- `/api/utils/gemini.js`: Core Gemini 2.5 Flash integration with 503-retry logic.
- `/api/routes/expenses.js`: Master ledger CRUD and CSV export/import.
- `/api/routes/settings.js`: Persistent user configuration (AI Keys, Studio Defaults).

#### 🖥️ UI (web-react/src/pages/)
- `Dashboard.jsx`: Executive summary, burn-rate projections, and ROI tracking.
- `Transactions.jsx`: High-performance ledger with AI forensic repair triggers and manual entry.
- `Backup.jsx`: Intelligence Tab / Setup Hub (API Key management, forensic quota links).
- `Invoice.jsx`: Professional client billing and accounts receivable management.

---

### Acceptance Criteria
- [ ] **Data Integrity**: Newest transactions are always processed first during AI repairs.
- [ ] **Privacy**: User A can NEVER see User B's financial metadata or AI responses.
- [ ] **Mobile Speed**: Decimal/Numeric keyboards trigger for currency/date fields; white calendar icons visible on dark theme.
- [ ] **Resilience**: Gemini 503 "High Demand" errors trigger automatic retries before failing.
- [ ] **Branding**: All error messages and AI feedback must use "Studio Assistant" persona, not raw technical JSON strings.

---

### Non-Goals
- Global data sharing or anonymous benchmarking (until Phase 4).
- Hosting user-uploaded high-res raw photo galleries (metadata tracking only).
- Real-time stock portfolio tracking.

---

### Commands for Development & Build
1. **Local Backend**: `cd api && npm start`
2. **Local Frontend**: `cd web-react && npm run dev`
3. **Production Build**: `cd web-react && npm run build`
4. **Environment Check**: Ensure `.env` includes `SUPABASE_KEY`, `SUPABASE_URL`, and `JWT_SECRET`.
