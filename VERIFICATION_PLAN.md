# Studio Tracker — Production Verification Plan

This document outlines the manual verification steps required to confirm the recent hardening fixes. Follow these instructions to verify the system's integrity and report back any discrepancies.

---

## 🔐 1. Vercel Environment Configuration
**Goal:** Ensure critical secrets are active and scoped correctly.

*   **Where to find:** [Vercel Dashboard](https://vercel.com/) → Your Project → **Settings** → **Environment Variables**.
*   **What to verify:**
    - [ ] `SUPABASE_SERVICE_ROLE_KEY`: Must be present and checked for **Production**.
    - [ ] `CRON_SECRET`: Must be present for **Production**.
    - [ ] `NODE_ENV`: Ensure it is explicitly set to `production`.
    - [ ] `SUPABASE_URL`: Ensure it matches your production Supabase project.

---

## 🚀 2. Server Startup & Architecture
**Goal:** Verify the database initialized with the correct privileges.

*   **Where to find:** [Vercel Dashboard](https://vercel.com/) → Your Project → **Logs**.
*   **Action:** Trigger a request to the API (e.g., visit `/api/health` in your browser).
*   **What to verify in Logs:**
    - [ ] Look for the log line: `[DB] Initialized with Service Role (ADMIN_PRIVILEGED).`
    - [ ] Ensure there are no `[DB] FATAL` or `[STARTUP]` error messages.

---

## 🛡️ 3. Security & Admin Hardening
**Goal:** Confirm admin routes and dev backdoors are locked down.

*   **Test Case A: Dev Bypass**
    - [ ] Open the app locally or on the preview URL.
    - [ ] Append `?bypass_login=true` to the URL.
    - [ ] **Expectation:** You should **NOT** be automatically logged in. (Validation that query param bypass is removed).
*   **Test Case B: Admin Guard**
    - [ ] Log in with an account that is **NOT** `joshua.deuermeyer@gmail.com`.
    - [ ] Attempt to visit any admin endpoint manually (e.g., `/api/admin/beta-codes`).
    - [ ] **Expectation:** You should receive a `403 Forbidden` response.

---

## 💰 4. Billing & Discount Logic
**Goal:** Confirm the "Double-Division" math bug is resolved.

*   **Action:** 
    1. Create a test invoice in the app.
    2. Add a line item for **$100.00** (10000 cents).
    3. Set the Discount to **10%** (Enter `10` in the discount field).
*   **What to verify:**
    - [ ] **Email/Pay Portal:** The discount should show as **$10.00**.
    - [ ] **Previously:** This would have shown as **$0.10** (the bug).
    - [ ] **Total:** Confirm the total is correctly calculated as **$90.00**.

---

## ⏰ 5. Cron & Daily Reports
**Goal:** Confirm Vercel can successfully trigger the automated reports.

*   **Where to find:** [Vercel Dashboard](https://vercel.com/) → Your Project → **Settings** → **Cron Jobs**.
*   **Action:** Click the "Run" or "Trigger" button for the `/api/admin/daily-report` job.
*   **What to verify:**
    - [ ] Check your email associated with the admin account.
    - [ ] **Expectation:** You receive the Daily Activity Report. (Verification that `x-vercel-cron` auth is working).

---

## 📧 6. Email UX & Links
**Goal:** Confirm client-facing emails are professional and 404-free.

*   **Action:** Mark a test invoice as "Sent" to trigger the client email.
*   **What to verify:**
    - [ ] Open the email.
    - [ ] **Expectation:** The "Download PDF" button should be **gone** (we removed the broken link).
    - [ ] **Action:** Click "View in Studio Tracker".
    - [ ] **Expectation:** It should take you to the correct client pay portal.

---

## 🔎 Research Checklist (If things go wrong)
If you see errors, check these specific locations:
1.  **Supabase Logs:** Under **Project Settings** → **Database** → **Logs**. Check for RLS violations if deletes fail.
2.  **Browser Console (F12):** Look for `[AUTH] Developer Bypass Enabled`. If you see this on Vercel, the `isLocalDev` fix failed.
3.  **Vercel Function Logs:** Filter for `503` errors. This indicates the new Fail-Closed licensing logic is active (meaning the DB is likely down).
