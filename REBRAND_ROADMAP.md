# Lumière Ledger — Rebrand & Launch Roadmap

**Current Name:** Studio Tracker  
**New Name:** Lumière Ledger  
**Target Domain:** `lumiereleadger.com`  
**Target Launch:** May 2026  
**Current Domain:** `app.throughthelens.media` (remains live during transition)

---

## Overview

This document is the master plan for rebranding Studio Tracker to Lumière Ledger, migrating to a dedicated `.com` domain, hardening the platform foundation, and preparing for public SaaS launch. The rebrand coincides with a full UX audit and architecture cleanup sprint.

---

## Phase 1 — Foundation Hardening (Pre-Rebrand) 
**Target: Complete before any public-facing branding changes**

These must be solid before new users arrive under the new brand.

### 1A. Security Final Pass
- [ ] Activate Supabase RLS on all user tables (`supabase_schema_rls.sql`)
- [ ] Verify no data leaks between user accounts (multi-tenant audit)
- [ ] Run Phase 1 & 2 validation checklist in `FIX_ROADMAP.md`
- [ ] Replace `cryptoUtil.js` stub with warning log (not silent throw) until Plaid work begins

### 1B. Code Cleanup
- [ ] Remove all hardcoded dev bypass values from `auth.js` (or gate strictly to `localhost`)
- [ ] Audit all `console.log` calls — remove or convert to structured logging
- [ ] Remove dead `receiptUrl` variable references in Transactions.jsx (already done)
- [ ] Consolidate invoice notes parsing in `invoices.js`
- [ ] Standardize error response shapes across all routes (`{ error: string }`)

### 1C. Performance Pass
- [ ] Verify stale-while-revalidate cache works on all key pages (Transactions, Dashboard)
- [ ] Add loading skeleton states for cold-start pages (replace blank screens)
- [ ] Audit Chart.js render performance on large datasets (3,000+ transactions)

### 1D. Mobile / PWA Hardening
- [ ] End-to-end test: iOS receipt upload → save → view in ledger
- [ ] Verify PWA home screen icon uses correct manifest name
- [ ] Test offline behavior — what happens when the server is unreachable?

---

## Phase 2 — Domain & Infrastructure Setup
**Target: 2 weeks before rebrand launch**

### 2A. Domain
- [ ] Purchase `lumiereleadger.com` (or confirm ownership)
- [ ] Set up DNS records pointing to Vercel
- [ ] Add `lumiereleadger.com` as custom domain in Vercel Dashboard
- [ ] Verify SSL certificate auto-provisioned by Vercel

### 2B. Google Cloud Console Updates
- [ ] Rename GCP project to "Lumiere Ledger" (cosmetic)
- [ ] Update OAuth Consent Screen: app name, logo, homepage URL
- [ ] Add `lumiereleadger.com` to Authorized Domains
- [ ] Add `https://lumiereleadger.com/auth/callback` to Authorized Redirect URIs
- [ ] Add `lumiereleadger.com/*` to Google Maps API key allowed referrers
- [ ] ⚠️ Keep `app.throughthelens.media` entries active until old domain is retired

### 2C. Supabase Updates
- [ ] Settings → Auth → Add `https://lumiereleadger.com` as Site URL (or redirect)
- [ ] Add `https://lumiereleadger.com/**` to Redirect URLs allowlist
- [ ] Update email templates (Confirm Email, magic link) with new brand name and URL
- [ ] Keep old domain active in allowlist during parallel-run period

### 2D. Vercel Environment Variables
- [ ] Add/update `VITE_APP_URL=https://lumiereleadger.com` if referenced
- [ ] Confirm all existing env vars carry over to new domain automatically
- [ ] Add `REDIS_URL` if email queueing is needed before launch

---

## Phase 3 — Brand Assets
**Target: 1 week before rebrand launch**

### 3A. Logo & Identity
- [ ] Select final logo from 3 concepts (Concept 1: Gold Aperture, 2: Tech Mark, 3: Editorial)
- [ ] Export logo in: SVG (primary), PNG 512×512 (favicon/PWA), PNG 1024×1024 (OG image)
- [ ] Update `web-react/public/icon.png` with new logo
- [ ] Update `web-react/public/favicon.ico`
- [ ] Update `web-react/public/manifest.json`: `name`, `short_name`, `background_color`, `theme_color`

### 3B. Color & Typography (optional upgrade)
- [ ] Audit current CSS design tokens in `index.css`
- [ ] Decide: keep current palette or introduce Lumière accent color (warm gold `#D4AF37`?)
- [ ] Update `document.title` default in `index.html`

---

## Phase 4 — Code Rebrand (Find & Replace Sprint)
**Target: 3-5 days of focused work**

### 4A. Text Replacements (Priority Order)

| Location | Current Text | Replace With |
|----------|-------------|-------------|
| `web-react/index.html` | `Studio Tracker` | `Lumière Ledger` |
| `web-react/public/manifest.json` | `Studio Tracker` | `Lumière Ledger` |
| `Home.jsx` | `Studio Tracker` | `Lumière Ledger` |
| `Home.jsx` | `app.throughthelens.media` | `lumiereleadger.com` |
| All page `<h1>` headers | `Studio Tracker` | `Lumière Ledger` |
| `Backup.jsx` (Control Center) | `Studio Tracker` | `Lumière Ledger` |
| `SaasTab.jsx` | `Studio Tracker` | `Lumière Ledger` |
| `AssistantSidebar.jsx` | `Studio Assistant` persona | `Lumière Assistant` |
| Email templates (`mailer.js`) | `Studio Tracker` | `Lumière Ledger` |
| `ChangeLogModal.jsx` | All Studio Tracker refs | Lumière Ledger |
| `Privacy.jsx` & `Terms.jsx` | `Studio Tracker` | `Lumière Ledger` |
| `spec.md`, `README.md`, docs | All refs | Updated |
| `SPEC.md` tagline | `Intel for Today's Photographer` | `Intel for the Creative Professional` |

### 4B. `alt` Tags & Metadata
- [ ] All `<img alt="Studio Tracker Logo">` → `alt="Lumière Ledger Logo"`
- [ ] `<meta name="description">` in `index.html`
- [ ] `<meta property="og:title">` and `og:image`

### 4C. API / Backend Text
- [ ] AI persona in `brain.js` system prompt: "Studio Assistant" → "Lumière Assistant"
- [ ] Email subject lines in `mailer.js`
- [ ] Admin-facing logs (low priority — internal only)

---

## Phase 5 — Parallel Run & Migration
**Target: Launch day + 30 days**

### 5A. Dual Domain Period
- Run `lumiereleadger.com` and `app.throughthelens.media` simultaneously
- Both domains point to same Vercel deployment
- Beta testers notified of new URL via in-app banner + email
- Monitor error logs for any auth/redirect failures from old domain users

### 5B. User Communication
- [ ] In-app announcement banner: "We've moved to Lumière Ledger — bookmark lumiereleadger.com"
- [ ] Email to all active beta testers with new URL, new logo reveal
- [ ] Social media announcement (use Beta Marketing Kit as base)

### 5C. Domain Retirement (Day 60)
- [ ] Set up 301 redirect: `app.throughthelens.media` → `lumiereleadger.com`
- [ ] Remove old domain from Vercel as primary
- [ ] Remove old domain from Google Cloud Console and Supabase allowlists
- [ ] Keep DNS control of `throughthelens.media` for Through The Lens photography site

---

## Phase 6 — SaaS Launch Preparation
**Target: Post-rebrand, Q3 2026**

- [ ] Stripe integration for paid subscription tiers
- [ ] Subscription plans: Beta → Pro → Lifetime
- [ ] Upgrade `ChangeLogModal` to show "What's New" on login
- [ ] Public marketing site at `lumiereleadger.com` (separate from app at `app.lumiereleadger.com`)
- [ ] Plaid live bank sync (pending Plaid approval)
- [ ] Referral / invite-a-friend system

---

## Risk Register

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Beta testers can't log in after domain switch | Medium | Dual domain parallel run + email notice |
| Google OAuth breaks on new domain | Medium | Update redirect URIs before switching |
| Supabase auth emails send wrong URL | Medium | Update email templates + redirect allowlist first |
| `è` character causes URL encoding issues | Low | Use `lumiereleadger.com` (no accent) for actual domain |
| Logo not ready in time | Low | 3 concepts already created — decision needed |
| SEO loss from domain change | Low | 301 redirect from old domain |

---

## Decision Log

| Date | Decision | Rationale |
|------|---------|-----------|
| 2026-04-12 | Name selected: Lumière Ledger | Strongest branding, memorable, photography × finance |
| 2026-04-12 | Domain: `lumiereleadger.com` (no accent) | Standard domains don't support `è`; display name uses accent in UI |
| 2026-04-12 | 3 logo concepts created | Gold Aperture, Tech Mark, Editorial — awaiting selection |
| 2026-04-14 | Rebrand target: May 2026 | Gives 4 weeks for foundation hardening and asset prep |
| 2026-04-14 | Old domain: 301 redirect, not immediate drop | Protect existing beta testers during transition |

---

## Owner Checklist (Non-Technical)

- [ ] Purchase domain `lumiereleadger.com`
- [ ] Select final logo concept
- [ ] Decide color palette (keep current blue or add gold accent)
- [ ] Draft beta tester migration email
- [ ] Confirm social media handles available: `@lumiereleadger`
- [ ] Decide public marketing site strategy (sub-domain vs. separate)
