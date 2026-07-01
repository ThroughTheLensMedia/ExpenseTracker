# Lumière Ledger — Connected Services

**Rule:** Do not add a new service without first checking if an existing service can cover the need.

---

## Active Services

### Supabase
**Purpose:** PostgreSQL database, user auth (email + Google OAuth), file storage (receipts), Realtime (lead notifications)
**Plan:** Free tier — 500MB DB, 1GB storage, pauses after 7 days inactivity (UptimeRobot prevents this)
**Dashboard:** https://supabase.com/dashboard/project/uccjeqnzusnribdzmveo
**Used for:** Everything. The core data layer. Cannot be removed.

---

### Vercel
**Purpose:** Hosting and auto-deploy. Pushes to `main` trigger a build automatically.
**Plan:** Free (Hobby)
**Dashboard:** https://vercel.com/throughthelensmedias-projects/expense-tracker
**Used for:** Frontend (React/Vite) + backend (Express API as serverless function). Runtime logs visible in dashboard.

---

### Plaid
**Purpose:** Bank account connections — transaction sync and live balances
**Plan:** Production — pay-per-use
**Rates:** Balance $0.10/call · Transactions $0.30/account/month · Recurring $0.15/account/month
**Dashboard:** https://dashboard.plaid.com
**Used for:** Plaid Link flow, `/api/plaid/*` routes, live balances on Accounts page
**⚠️ Cost risk:** Balance endpoint is called per page load. Caching required to control cost.

---

### Resend
**Purpose:** Transactional email — invoices, receipt confirmations, admin alerts, beta invitations
**Plan:** Free tier (3,000 emails/month)
**Dashboard:** https://resend.com/overview
**Sending domain:** `throughthelens.media` (verified) — do NOT send from `lumiereledger.com`, it is not verified
**Used for:** `api/utils/mailer.js`, `api/utils/emailQueue.js`

---

### Postmark
**Purpose:** Inbound email only — receives forwarded receipts at `receipts+{token}@lumiereledger.com`
**Plan:** Free inbound (100 inbound emails/month free)
**Dashboard:** https://account.postmarkapp.com
**MX record:** `inbound.postmarkapp.com` on `lumiereledger.com`
**Used for:** `api/routes/emailInbound.js` — receipt extraction pipeline
**⚠️ Webhook URL must be:** `https://www.lumiereledger.com/api/receipts/email-inbound?token=<POSTMARK_INBOUND_TOKEN>`
**⚠️ Wrong URL = 401:** `/api/receipts` (without `/email-inbound`) is auth-protected — Postmark gets 401, no receipt is processed, no confirmation email is sent. Root cause of Jun 2026 outage.
**Raw inbound address:** `b1eedb087c80679a30142ee1f36b7aa4@inbound.postmarkapp.com` (shown in IntegrationTab.jsx)

---

### Google Gemini
**Purpose:** AI financial assistant (Brain), receipt parsing from email/PDF, batch categorization, RAG document indexing
**Model:** Gemini 2.5 Flash
**Plan:** BYOB — users supply their own API key. Stored per-user in settings table.
**Dashboard:** https://aistudio.google.com
**Used for:** `api/routes/brain.js`, `api/utils/gemini.js`, `api/utils/receiptEmailParser.js`

---

### Sentry
**Purpose:** Frontend error tracking — React crashes, unhandled rejections, API errors with user context and stack traces
**Plan:** Free (5,000 errors/month)
**Dashboard:** https://through-the-lens-media.sentry.io
**Used for:** `web-react/src/main.jsx`, `web-react/src/components/ErrorBoundary.jsx`, `web-react/src/api/index.js`
**Note:** Backend uses `console.error` → Vercel runtime logs. No separate backend logging service needed.

---

### Google Cloud Console
**Purpose:** Google OAuth (sign-in) + Google Maps API (mileage tracking)
**Plan:** Free tier (Maps has usage limits)
**Dashboard:** https://console.cloud.google.com
**Used for:** Supabase Google OAuth provider, `VITE_GOOGLE_MAPS_API_KEY`

---

### Stripe
**Purpose:** User billing — self-serve Core/Studio subscription checkout, subscription gate for Plaid access
**Plan:** Pay-per-transaction (no monthly fee)
**Dashboard:** https://dashboard.stripe.com
**Used for:** `api/routes/stripe.js`, Plaid billing gate in `api/routes/plaid.js`
**Status:** ✅ Live — self-serve checkout confirmed as a real, intentional flow (2026-07-01). See `STRIPE_ROADMAP.md`.

---

### Cloudflare
**Purpose:** DNS + reverse proxy for `lumiereledger.com` (active Zone, confirmed via dashboard 2026-07-01 — not just DNS/MX); Turnstile bot-challenge widget on the signup form (added v7.10.14)
**Plan:** Free
**Dashboard:** https://dash.cloudflare.com
**Used for:** `web-react/index.html` (Turnstile script), `web-react/src/pages/Login.jsx` (widget), `api/server.js` (`POST /verify-turnstile`)
**Note:** Turnstile secret key must be set as `TURNSTILE_SECRET_KEY` in Vercel to activate server-side verification — fails open (harmless) until set.

---

### UptimeRobot
**Purpose:** External uptime monitoring — pings `/api/health` every 5 minutes. Also prevents Supabase free tier from pausing due to inactivity.
**Plan:** Free
**Dashboard:** https://uptimerobot.com
**Used for:** Monitoring only. No code integration.

---

### GitHub
**Purpose:** Source code hosting and Vercel deploy trigger
**Repo:** https://github.com/ThroughTheLensMedia/ExpenseTracker
**Plan:** Free (public repo)

---

## Not In Use / Removed

| Service | Reason |
|---------|--------|
| BetterStack / Logtail | Removed — caused API startup crash on Vercel. Replaced by Vercel runtime logs. |
| Redis | Never activated — `REDIS_URL` not set. Email queue falls back to direct Resend. |

---

## Decision Log

| Date | Decision |
|------|----------|
| 2026-06-06 | Removed Logtail/pino from backend. Vercel logs + Sentry covers monitoring needs without new dependencies. |
| 2026-06-06 | Sentry kept for frontend only — React crashes, stack traces from minified bundles. |
| 2026-07-01 | Added Cloudflare Turnstile for bot signup protection — reused existing Cloudflare zone already proxying the domain rather than adding a new service. |
| 2026-07-01 | Confirmed self-serve Stripe checkout (no invite code) is an intentional, real flow — not just an invite-only beta. Informs future access-gate changes: don't lock down `licensing.js` further without checking this first. |
