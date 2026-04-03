import React from 'react';

const RELEASES = [
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
        '<strong>Visual & PDF Refinements:</strong> Cleaned up empty quantity rows on the PDF generator and optimized layout spacing dynamically. The Studio Tracker logic gracefully prevents blank rows from bleeding lines onto the formal file.'
    ]},
    { version: '5.0.0', date: 'APRIL 1, 2026', color: 'var(--accent)', items: [
        '<strong>Pay Now Portal:</strong> Clients receive a branded payment link (<code>/pay/:token</code>) — no login required. Shows invoice summary, payment handles, and e-signature capture.',
        '<strong>Dual E-Signatures:</strong> Photographers check "I authorize this invoice" in the creator. Clients type their full name to approve on the Pay Portal — timestamp and signature stored permanently.',
        '<strong>Premium Invoice Email:</strong> Fully redesigned client email with inline line-item table, studio logo, conditional notes, orange Pay Now CTA button, and PDF attachment.',
        '<strong>Photographer Approval Notification:</strong> When a client signs, the photographer receives a dark-mode branded email with signature details, payment handles shown to client, and a deep-link back into Studio Tracker.',
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
        '<strong>Branding Evolution:</strong> Increased "STUDIO TRACKER" brand presence in the primary command bar.',
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
