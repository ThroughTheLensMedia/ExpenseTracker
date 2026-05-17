import React from 'react';

const RELEASES = [
    { version: '7.5.4', date: 'MAY 17, 2026', color: '#a78bfa', items: [
        '<strong>Brain — Conversation Memory:</strong> The Assistant now remembers what you were just talking about. Follow-up questions like "what about in 2026?" or "break that down by month" carry the context of your prior question — no need to repeat yourself.',
        '<strong>Brain — Cleaner Spending Breakdown:</strong> Internal Transfers and Credit Card Payments no longer appear in your top spending categories. Financial analysis now shows real business expense categories only.',
    ]},
    { version: '7.5.3', date: 'MAY 17, 2026', color: '#10b981', items: [
        '<strong>Brain — Category Search Fixed:</strong> "How much have I spent on travel?" now returns correct results. The Brain was searching for "Travel" (exact) but your ledger uses "Travel & Vacation" — fixed to use partial matching so any reasonable keyword finds the right category.',
        '<strong>Brain — Search Before Create:</strong> When you mention past purchases ("I bought Delta tickets, gas, hotels"), the Brain now searches your existing ledger first before offering to create new records. It will also retry with broader search terms before telling you a category has zero spending.',
    ]},
    { version: '7.5.2', date: 'MAY 17, 2026', color: '#10b981', items: [
        '<strong>Brain — Smarter Purchase Analysis:</strong> Credit card payments (AMEX EPAYMENT, ACH PMT, AUTOPAY, etc.) are no longer reported as purchases. When you ask "what\'s my biggest purchase?" the Brain now skips balance transfers and payment transactions — only real vendor purchases count.',
    ]},
    { version: '7.5.1', date: 'MAY 17, 2026', color: '#f97316', items: [
        '<strong>Brain — Invoice Total Fix:</strong> Invoices don\'t store a pre-computed total column — the total is calculated from your line items. The Brain now computes totals correctly from your invoice items, tax rate, and discount. Previously this caused a database error on every invoice lookup or status update.',
        '<strong>Brain — Mark Paid Simplified:</strong> Marking an invoice paid now sends only the status change — no phantom payment amount field that doesn\'t exist on the invoice record.',
    ]},
    { version: '7.5.0', date: 'MAY 17, 2026', color: '#f97316', items: [
        '<strong>Brain — Invoice Query Fix:</strong> Resolved a schema mismatch that caused "error retrieving invoice" on every invoice lookup. Client names are stored in a linked table, not a direct column — all three invoice tools now use the correct join.',
    ]},
    { version: '7.4.9', date: 'MAY 17, 2026', color: '#f97316', items: [
        '<strong>Brain — Multi-Invoice Fix:</strong> "Mark invoice 0428 and 1001 as paid" now works correctly. The Brain calls get_invoice separately for each number instead of combining them into a single broken query.',
        '<strong>Brain — Deeper Reasoning:</strong> The function-calling loop raised from 3 to 6 rounds — multi-step requests (look up 2 invoices, update both) no longer stall midway.',
        '<strong>Brain — Transaction Safety:</strong> Creating a transaction without a vendor, amount, or date now prompts you for the missing info instead of silently creating a $0 record.',
        '<strong>Brain — Link Transactions to Leads:</strong> Transaction search results now include IDs, enabling the Brain to link a specific expense to a CRM lead.',
    ]},
    { version: '7.4.8', date: 'MAY 17, 2026', color: '#38bdf8', items: [
        '<strong>Brain — Invoice Actions:</strong> You can now ask the Assistant to mark invoices as paid, sent, or draft. "Mark invoice #2026-0428 and #1001 as paid" — the Brain looks up both invoices, pulls the totals, and surfaces confirmation cards before changing anything.',
        '<strong>Brain — Multi-Invoice Support:</strong> Multiple invoice numbers in a single request are each resolved and queued as separate confirmation cards — approve or reject individually.',
    ]},
    { version: '7.4.7', date: 'MAY 17, 2026', color: '#10b981', items: [
        '<strong>Brain — Live Page Refresh:</strong> After you approve an action (update lead, add transaction, link records), the page you\'re on automatically reloads the affected data — no manual refresh needed.',
        '<strong>Brain — Multiline Input:</strong> The assistant chat now supports multi-line messages. Use <strong>Shift+Enter</strong> to add a new line; Enter alone sends the message. Input auto-expands as you type.',
    ]},
    { version: '7.4.6', date: 'MAY 17, 2026', color: '#f97316', items: [
        '<strong>AI Brain — CRM Write Fix:</strong> "Mark as Completed/Booked/Lost" now works correctly. The Brain was finding the lead but not passing its unique ID to the update action — lead ID is now included in all CRM lookups so write tools can execute.',
        '<strong>Greeting Personalization:</strong> The Assistant sidebar now greets you by your first name (from your contact or business name in settings).',
    ]},
    { version: '7.4.5', date: 'MAY 17, 2026', color: '#a78bfa', items: [
        '<strong>AI Brain — Confirmation UI:</strong> Write actions (update lead status, add transaction, link records) now surface Approve / Reject confirmation cards before anything is saved — no accidental changes.',
        '<strong>AI Brain — Account Tool:</strong> Ask "What accounts do I have?" or "List accounts with 2026 transactions" — the Brain now queries your actual sources from the ledger.',
        '<strong>Chat Formatting:</strong> The Assistant now renders bold text, bullet lists, and inline code in its responses instead of raw markdown symbols.',
    ]},
    { version: '7.4.4', date: 'MAY 17, 2026', color: '#a78bfa', items: [
        '<strong>AI Brain Upgrade — Live Data Queries:</strong> The Lumière Assistant now uses Gemini function calling to pull real data from your ledger on demand. Ask specific questions like "What did I spend on camera gear this year?" and the Brain queries your actual transactions instead of working from a pre-loaded summary.',
        '<strong>Four Live Tools:</strong> Search Transactions (filter by category, vendor, date, tax status), Financial Metrics Snapshot (YTD totals, burn rate, top categories), Invoice Summary (revenue, outstanding balances), and CRM Pipeline (lead status, booked value).',
        '<strong>Faster & More Accurate:</strong> Replaced a 3,000-token upfront data dump with targeted queries — responses are faster, answers reference exact figures from your live ledger.',
    ]},
    { version: '7.4.3', date: 'MAY 17, 2026', color: '#10b981', items: [
        '<strong>What\'s New Button:</strong> A new "WHAT\'S NEW" button now appears in the header after each update. Click it to see release notes — it dismisses automatically and reappears only when a new version ships.',
        '<strong>AI Engine — Tier 1 Quota Panel:</strong> The Brain Connectivity panel now correctly reflects your Tier 1 limits (1,000 RPM / 1M TPM / 10,000 RPD) under the StudioTracker project. Previous panel showed incorrect Free Tier limits.',
        '<strong>AI Engine — Gemini Version Fix:</strong> Retroactive Ledger Repair now correctly identifies as Gemini 2.5 Flash (was showing 2.0 Flash).',
    ]},
    { version: '7.4.2', date: 'MAY 16, 2026', color: '#10b981', items: [
        '<strong>Update Notifications Fixed:</strong> The "Update Available" banner in the header was stuck and had not fired since v7.0.0. Version tracking is now live — you\'ll see a prompt to refresh within 5 minutes of any new release going live.',
        '<strong>Update Banner:</strong> Cleaner text, no emoji. Checks every 5 minutes instead of every 60 seconds.',
    ]},
    { version: '7.4.1', date: 'MAY 16, 2026', color: '#a8b6dd', items: [
        '<strong>Ledger Control Center — Polish:</strong> Tab pills now text-only, matching the nav. "Studio License Lock" renamed to "License Activation." Stale version string removed and replaced with current version.',
        '<strong>Integration Tab:</strong> Intake URL updated to <code>www.lumiereledger.com/api/intake</code>. Emojis removed from the tab.',
    ]},
    { version: '7.4.0', date: 'MAY 16, 2026', color: '#38bdf8', items: [
        '<strong>Navigation Redesign:</strong> Dropdown menu rebuilt — emojis removed, items grouped into labeled sections (Financials, Operations, Client Work, Settings). Cleaner and faster to scan.',
        '<strong>Ledger Control Center — Performance:</strong> LCC now loads in a fraction of the time. Previously fired 7–11 API calls on open; now fires 2. Heavy data loads only when you navigate to a tab that needs it.',
        '<strong>System Status Panel:</strong> Replaced the stat count cards with a real-time system status strip — Database connection, Email/SMTP readiness, last-checked time, and a manual Refresh button.',
        '<strong>Loading Skeleton:</strong> If a tab takes more than a second to load, animated placeholder bars appear so the page never looks empty or broken.',
    ]},
    { version: '7.3.9', date: 'MAY 16, 2026', color: '#38bdf8', items: [
        '<strong>Mark Paid on Draft Invoices:</strong> Portal-paid clients (e.g., FotoFetch) can now be marked paid directly from draft status — no unwanted email send required.',
        '<strong>Edit Restored on Paid Invoices:</strong> Paid invoice records are now fully editable again. Access Edit on any invoice regardless of status for corrections and record-keeping.',
    ]},
    { version: '7.3.8', date: 'MAY 16, 2026', color: '#4ade80', items: [
        '<strong>Client Override Fix:</strong> Fixed a bug where typing a new client name in the invoice form could silently reuse a prior client\'s record (Boris bug). Client fields now clear the linked ID on manual change.',
        '<strong>CRM Import — Duplicate Disambiguation:</strong> The leads dropdown now shows shoot type and date alongside the name — so duplicate-named leads (e.g., two "FotoFetch" entries) are distinguishable at a glance.',
        '<strong>Save &amp; Send Email:</strong> New single-step button in the invoice form footer. Saves the draft and immediately sends the client email — eliminates the two-step save → find → send workflow.',
    ]},
    { version: '7.3.5', date: 'MAY 16, 2026', color: '#f97316', items: [
        '<strong>Domain Migration — CORS:</strong> <code>www.lumiereledger.com</code> added to allowed origins. Auth calls from the new domain no longer fail.',
        '<strong>Pay Portal Links:</strong> Invoice email payment links now point to <code>www.lumiereledger.com</code> instead of the old domain.',
        '<strong>Email Reliability:</strong> Hardcoded fallback from-addresses corrected to the verified Resend sending domain — eliminates silent email delivery failures if the env var is ever missing.',
    ]},
    { version: '7.1.0', date: 'MAY 6, 2026', color: '#38bdf8', items: [
        '<strong>Website Lead Capture:</strong> Booking form submissions on your photography website now route directly into the CRM pipeline in real time — no Zapier, no manual imports.',
        '<strong>Client Deduplication:</strong> Returning clients are automatically matched by email and linked to their existing profile. No duplicate contact cards.',
        '<strong>Real-Time Notifications:</strong> New leads trigger an instant in-app toast notification and a red badge counter on the CRM nav link — so you know the moment a client books.',
        '<strong>Multi-Tenant Intake Keys:</strong> Every user can generate their own API key to connect their website. Keys are labeled, rotatable, and manageable from the new Integrations tab.',
        '<strong>Integrations Tab:</strong> New tab in the Ledger Control Center with full setup instructions — copy your intake URL, secret key, and code snippet in one place.',
        '<strong>Add-Ons Marketplace:</strong> New <code>/addons</code> page surfaces available platform extensions. Website Lead Capture is live; Website Builder, Client Portal, and Contract E-Sign are in development.',
    ]},
    { version: '7.0.0', date: 'MAY 1, 2026', color: '#f97316', items: [
        '<strong>Lumière Ledger Rebrand:</strong> The platform is officially Lumière Ledger! Overhauled the UI, replaced all instances of the old branding, and implemented the new premium app icon.',
        '<strong>Layer 2 System Watchdog:</strong> Added an hourly internal cron job to test DB/SMTP health and alert the admin if degraded.',
        '<strong>Layer 1 Uptime Monitoring:</strong> Configured external HTTP ping via UptimeRobot to ensure public API availability.'
    ]},
    { version: '6.3.0', date: 'APRIL 8, 2026', color: '#f59e0b', items: [
        '<strong>Persistent Ignoral:</strong> You can now explicitly IGNORE/RESTORE noise or generic recurring vendors directly from the intelligence view. These rules automatically persist in the backend.',
        '<strong>Multi-Timeframe Analytics:</strong> Top Expense Drivers and analytical projections can now be seamlessly evaluated across <em>Full Year</em>, <em>Last Year</em>, <em>YTD</em>, and <em>Current Month</em> arrays with native zero-latency switching.',
        '<strong>Pagination Defenses:</strong> Surmounted strict database truncation limits. The metrics engine now auto-paginates, pulling 100% of your data rows for completely accurate multi-year reporting.',
        '<strong>Contextual Accuracy:</strong> Relabeled subscription mathematics to intelligently align with overarching "Recurring Vendors" analysis, protecting footprint totals.'
    ]},
    { version: '6.2.0', date: 'APRIL 8, 2026', color: '#10b981', items: [
        '<strong>Operational Intelligence Revamp:</strong> Complete rewrite of the recurring vendor tracking center. Removed legacy static cards and replaced them with a responsive 4-metric summary strip.',
        '<strong>Action-Driven Filters:</strong> New filter controls allow one-click table narrowing for "Review Candidates", "Duplicates", and "Unused" subscriptions.',
        '<strong>Top Offenders Snapshot:</strong> Automatic detection and isolation of the three highest monthly recurring expenses for immediate visibility.',
        '<strong>Streamlined Table:</strong> Cleaned up the Operational Intelligence table with uniform 25% column spacing and unified pill flags, directly mapping to standard database truths.'
    ]},
    { version: '6.1.0', date: 'APRIL 8, 2026', color: '#818cf8', items: [
        '<strong>Maps Autopilot:</strong> Rebuilt the Mileage Tracker with Google Maps integration. Address autocomplete (Google Places) for both Start (A) and End (B) fields.',
        '<strong>Auto Distance Calculation:</strong> Google Distance Matrix API instantly computes the exact driving miles between any two addresses — no manual counting.',
        '<strong>Dark Route Preview:</strong> A styled dark-mode map renders the A\u2192B route with a purple polyline for visual confirmation before logging.',
        '<strong>Flexible Multi-Stop Logging:</strong> Each trip is logged as a single one-way segment. Log multiple trips per day with different clients and destinations.',
        '<strong>Smart Trip History:</strong> The Trip History table now parses and displays the Trip Name, Route, and Notes as separate structured lines for clean IRS-compliant records.',
    ]},
    { version: '6.0.0-SECURITY', date: 'APRIL 8, 2026', color: '#ef4444', items: [
        '<strong>Security Lockdown (Critical):</strong> Activated Row-Level Security (RLS) across all Supabase tables to enforce strict hardware-level data isolation between studios.',
        '<strong>Multi-Tenant Integrity:</strong> Audited and hardened 40+ backend endpoints (Mileage, Assets, Rules, Invoices) to ensure per-request <code>user_id</code> filtering.',
        '<strong>Defense-in-Depth:</strong> Every database query now combines both RLS policy protection and explicit backend owner-checking for redundant security.',
        '<strong>Admin Transparency:</strong> Re-pathed SaaS telemetry and engagement tracking to the Service Layer to maintain operational visibility without exposing user data.',
    ]},
    { version: '5.4.0', date: 'APRIL 5, 2026', color: '#a855f7', items: [
        '<strong>Financial Insight Strip:</strong> Six live analytical signals embedded inside Monthly Performance \u2014 powered by server-side math, zero added DB queries.',
        '<strong>Margin Quality:</strong> Net margin % MTD with delta vs prior month and Healthy/Watch/Risk classification.',
        '<strong>Cash Reality:</strong> Invoice collection rate (collected vs open) as a single actionable percentage.',
        '<strong>Expense Pressure:</strong> Fixed vs variable cost split using recurring vendor inference \u2014 flags cost structure risk above 70%.',
        '<strong>Revenue Quality:</strong> Detects single-source dependency \u2014 flags concentration risk above 60% of total revenue.',
        '<strong>Burn Rate + Runway:</strong> 3-month trailing average spend with months-of-runway from cash-on-hand.',
        '<strong>Short-Term Signal:</strong> Current month revenue velocity vs prior month as a leading growth/contraction indicator.',
    ]},
    { version: '5.3.1', date: 'APRIL 5, 2026', color: '#38bdf8', items: [
        '<strong>One-Tap Asset Capture:</strong> Rewired the Transaction Drawer for field use. Staging a receipt during a new transaction save now auto-sequences the database entry and the image upload in a single atomic action.',
        '<strong>Mobile Analytics Fix:</strong> Added horizontal overflow protection and minimum data-width logic to the Operating Intelligence table. Recurring vendor amounts and flags no longer clip on small screens.',
        '<strong>Brand Stabilization:</strong> Replaced the global text-only "LUMIÈRE LEDGER" placeholder in the main header with the official 3D brand icon. Unified the icon across the Dashboard V2 and PWA home-screen manifest.',
        '<strong>Interactive Vendor Auditing:</strong> All recurring vendor rows are now clickable triggers that jump directly to the transaction ledger filtered by provider name.',
        '<strong>Deterministic Forecasting:</strong> Expanded the YTD Projector with granular inflation/creep variables for 2%, 3%, and 7% scenarios.'
    ]},
    { version: '5.3.0', date: 'APRIL 4, 2026', color: '#4ade80', items: [
        '<strong>Dashboard V2 Architecture (Beta):</strong> A complete rebuild of the Executive Analytics dashboard, focusing on data clarity, performance, and actionable intelligence over aesthetics.',
        '<strong>Backend Metrics Engine:</strong> Centralized calculations for YTD/MTD Revenue, Net Profit, and Operating Expenses entirely on the server. Reduces browser memory overhead and ensures 100% data consistency everywhere.',
        '<strong>Performance Combo Chart & Ghost Bars:</strong> Removed confusing independent line graphs. Added a unified HTML-native visual overlaying Monthly Revenue vs. Expense vs. Net Profit, along with reclaimed UI space for quick-hit Fixed/Variable sub calculations.',
        '<strong>Interactive KPIs:</strong> All top-level snapshot cards (Revenue, Expenses, Receivables) are now interactive routing modules that jump directly to the pre-filtered core data ledger.',
        '<strong>Obligations & Invoice Health 2.0:</strong> We now dynamically digest the invoice ledger to provide 4-column cash-flow insight: Exact uncollected totals, strict calculation of overdue dollars, upcoming expectation forecasts (next 7 days), and average historical collection time.',
        '<strong>Recurring Vendor Inference:</strong> AI Brain logic is now backed by a deterministic backend algorithm. Automatically detects and flags recurring subscriptions and potential <em>Personal Leakage</em> directly on the dashboard.'
    ]},
    { version: '5.2.0', date: 'APRIL 3, 2026', color: '#38bdf8', items: [
        '<strong>AI Category Segregation:</strong> Deep-linked Dividend and Interest income categories into the Brain logic. No more generic "Side Income" tagging for asset yields.',
        '<strong>Executive Dashboard Sort:</strong> Enabled multi-column sorting (Invoice #, Date, Client, Status) on the global invoice matrix.',
        '<strong>Print Isolation Hub:</strong> Native 1" margin PDF generation now clears the viewport and isolates only the invoice for professional A4/Letter accuracy.',
        '<strong>ROAMAP: Phase 1 Deep Context:</strong> Brain now looks at multi-year comparatives for trend analysis (YTD/Prior Yr).',
        '<strong>ROADMAP: Phase 2 Tool Integration:</strong> [PLANNED] Giving the AI "Hands" to create invoices and update CRM statuses via voice/chat commands.',
        '<strong>ROADMAP: Phase 3 Vision RAG:</strong> [PLANNED] Direct analysis of uploaded PDF receipts, contracts, and manual ledger attachments.',
    ]},
    { version: '5.1.0', date: 'APRIL 2, 2026', color: '#f97316', items: [
        '<strong>Invoice Cloning:</strong> Added a one-click "Clone" button on the invoice dashboard to instantly duplicate proposals or bill new clients with identical parameters.',
        '<strong>Attachment URLs:</strong> You can now attach a direct URL (like Google Drive or Pixieset) to any invoice. It automatically prints on the PDF and the Client Email as an interactive button.',
        '<strong>Dynamic Email Senders:</strong> Outbound emails securely adopt your Official Business Name. Furthermore, any client replies are intelligently routed directly back to your personal Business Email account.',
        '<strong>Intelligent Discount Scaling:</strong> Completely rebuilt the discount processing engine backend to guarantee 100% precision on scaled percentages across PDFs, Emails, and the Pay Portal.',
        '<strong>Visual & PDF Refinements:</strong> Cleaned up empty quantity rows on the PDF generator and optimized layout spacing dynamically. The Lumière Ledger logic gracefully prevents blank rows from bleeding lines onto the formal file.'
    ]},
    { version: '5.0.0', date: 'APRIL 1, 2026', color: 'var(--accent)', items: [
        '<strong>Pay Now Portal:</strong> Clients receive a branded payment link (<code>/pay/:token</code>) — no login required. Shows invoice summary, payment handles, and e-signature capture.',
        '<strong>Dual E-Signatures:</strong> Photographers check "I authorize this invoice" in the creator. Clients type their full name to approve on the Pay Portal — timestamp and signature stored permanently.',
        '<strong>Premium Invoice Email:</strong> Fully redesigned client email with inline line-item table, studio logo, conditional notes, orange Pay Now CTA button, and PDF attachment.',
        '<strong>Photographer Approval Notification:</strong> When a client signs, the photographer receives a dark-mode branded email with signature details, payment handles shown to client, and a deep-link back into Lumière Ledger.',
        '<strong>Payment Handles:</strong> Business Profile now stores Venmo, Zelle, CashApp, and Stripe Publishable Key — surfaced on the Pay Portal with tap-to-open links.',
        '<strong>Tax Exempt Toggle:</strong> Invoice creator now includes a one-click toggle to zero out tax for exempt projects.',
        '<strong>Customer Notes:</strong> Dedicated notes section on invoices for shoot details, thank-you messages, and special instructions — only appears in email and Pay Portal when filled in.',
        '<strong>Qty Guard:</strong> Line items without a quantity no longer show unit price or total — but still contribute to subtotal calculations.',
        '<strong>Smart Dedup Merge Engine:</strong> CSV import now merges bank transactions with matching manual entries (±2 day window, same amount) instead of skipping — keeps your category, notes, and receipt; updates source to the bank.',
        '<strong>Retroactive Duplicate Scanner:</strong> New tool in Bank Data Import — scan your entire ledger for existing duplicates with side-by-side review, one-click merge, or auto-merge high-confidence pairs.',
        '<strong>AI Brain Modal:</strong> Welcome popup is now evergreen (no version number) and suppressed automatically if you have already configured your own Gemini API key.',
    ]},
    { version: '4.3.0', date: 'MARCH 27, 2026', color: 'var(--accent)', items: [
        '<strong>CORS Hardened:</strong> API now restricted to app.throughthelens.media only.',
        '<strong>Support Email:</strong> All outbound mail now routes through support@throughthelens.media.',
        '<strong>IRS Rates Auto-Seeded:</strong> Mileage rates 2020–2026 auto-populate on first load — no manual entry needed.',
        '<strong>Mileage Intelligence:</strong> Brain AI now reads real IRS rate from DB per year instead of hardcoded value.',
        '<strong>Supabase RLS Hardening:</strong> Enabled Row Level Security on all unprotected tables; function search_paths locked.',
    ]},
    { version: '4.0.0', date: 'MARCH 18, 2026', color: 'var(--accent)', items: [
        '<strong>Your Assistant:</strong> Initial release of the floating AI assistant for real-time financial consultation.',
        '<strong>Gemini 1.5 Flash:</strong> Migrated whole-studio intelligence to the latest Google Flash model for 2x speed.',
        '<strong>Privacy Lockdown:</strong> Implemented Row Level Security (RLS) for AI settings; bringing "your own key" now isolates data.',
        '<strong>Dashboard Grid:</strong> Precision calibration for Intelligence cards (9-card desktop grid).',
        '<strong>Smart Recurring:</strong> Improved detection patterns for operational burn that ignores one-off equipment transfers.',
    ]},
    { version: '3.9.3', date: 'MARCH 16, 2026', color: 'var(--accent)', items: [
        '<strong>Pro Entry Integrated:</strong> Released Google OAuth (One-Tap login) as the primary studio entry method.',
        '<strong>Automated Expiration Logic:</strong> Studio licenses now auto-recalculate (Annual 365D, Pro 999D) upon plan change.',
        '<strong>Identity Fix:</strong> Resolved sync issue between License Records and Profiles; display names now persist correctly.',
        '<strong>Pulse Resilience:</strong> Switched engagement telemetry to Service Layer to ensure 100% visibility in SaaS Dashboard regardless of RLS.',
        '<strong>Smarter Bills:</strong> Improved detection patterns for operational overhead (Fitness, Software, Licenses).',
    ]},
    { version: '3.8', date: 'MARCH 14, 2026', color: 'var(--accent)', items: [
        '<strong>SaaS Control Center:</strong> Integrated real-time engagement pulse and user activity reporting.',
        '<strong>Enhanced User Mgmt:</strong> Added ability to edit invites and active session details (name, plan type).',
        '<strong>License Health:</strong> Visual color-coded alerts (Green/Yellow/Red) for expiring access sessions.',
        '<strong>Auto-Update Core:</strong> Aggressive cache-busting and version synchronization for all users.',
        '<strong>Cloud Parity:</strong> Fully decommissioned NAS modules in favor of Supabase/Vercel resilience.',
    ]},
    { version: '3.7', date: 'MARCH 13, 2026', color: '#fff', items: [
        '<strong>Documentation Refresh:</strong> Integrated the "Change Log" repository for real-time feature tracking.',
        '<strong>Widescreen Optimization:</strong> Expanded Onboarding and FAQ containers to 1400px for better data density.',
        '<strong>Branding Evolution:</strong> Increased "LUMIÈRE LEDGER" brand presence in the primary command bar.',
        '<strong>Executive Symmetry:</strong> Precision grid calibration for dashboard controls (CHARTS, YEAR, SYNC).',
        '<strong>Dual Trajectory:</strong> Split profitability tracking into dual modules for "Margin %" and "Net Income Pulse".',
        '<strong>Inventory Density:</strong> Optimized Equipment Locker for 40% higher visibility per scroll.',
    ]},
    { version: '3.6.1', date: 'MARCH 12, 2026', color: '#fff', items: [
        '<strong>Mobile Command Bar:</strong> Initial release of the PWA bottom navigation for field usage.',
        '<strong>Visual Pulse:</strong> Added color-coded "Data Age" indicators to ensure sync health.',
        '<strong>Performance:</strong> Global implementation of <code>fadeIn</code> page transitions.',
    ]},
    { version: '3.5', date: 'MARCH 11, 2026', color: '#fff', items: [
        '<strong>Pipeline-to-Invoice:</strong> Direct lead conversion engine for rapid billing.',
        '<strong>Receipt Forensics:</strong> Integrated file storage for equipment serialized assets.',
        '<strong>Security Core:</strong> Role-based restriction for administrator-only studio management.',
    ]},
];

export default function ChangeLogModal({ onClose }) {
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="card glass glow-blue" style={{ width: '100%', maxWidth: '700px', padding: '40px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                    <h2 style={{ fontSize: '1.8rem', margin: 0 }}>System Intelligence Update Log</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '35px' }}>
                        {RELEASES.map(r => (
                            <section key={r.version}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                                    <div style={{ fontWeight: 950, fontSize: '1.4rem', color: r.color }}>{r.version}</div>
                                    <div style={{ fontWeight: 800, opacity: 0.6, fontSize: '12px' }}>{r.date}</div>
                                </div>
                                <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '15px' }}>
                                    {r.items.map((item, i) => (
                                        <li key={i} style={{ fontSize: '14px', lineHeight: '1.5' }} dangerouslySetInnerHTML={{ __html: item }} />
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>
                </div>
                <button className="btn primary glow-blue" onClick={onClose} style={{ marginTop: '30px', width: '100%', padding: '15px' }}>CLOSE UPDATES</button>
            </div>
        </div>
    );
}
