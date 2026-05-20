import React from 'react';
import { NavLink } from 'react-router-dom';

const FEATURES = [
  {
    icon: '🤖',
    title: 'AI Financial Assistant',
    desc: 'Ask Lumière anything about your business. Powered by Google Gemini 2.5 Flash with access to your full transaction history.',
    badge: 'Gemini 2.5 Flash',
  },
  {
    icon: '🧾',
    title: 'Professional Invoicing',
    desc: 'Build and send polished invoices with line items, tax, and discounts. Clients e-sign directly on a branded Pay Portal.',
    badge: 'E-Signature Included',
  },
  {
    icon: '📊',
    title: 'Executive Dashboard',
    desc: 'Real-time gross revenue, net profit, burn rate, and cash flow forecasts.',
    badge: 'Live KPIs',
  },
  {
    icon: '🎯',
    title: 'CRM Pipeline',
    desc: 'Track every lead from first inquiry to final booking. Visual Kanban board.',
    badge: 'Bookings Pipeline',
  },
  {
    icon: '📷',
    title: 'Gear Depreciation',
    desc: 'Section 179 and Straight-Line depreciation calculated automatically.',
    badge: null,
  },
  {
    icon: '🏦',
    title: 'Smart CSV Import',
    desc: 'Drop exports from Chase, Amex, Bank of America, Wells Fargo, Rocket Money, and 6+ others.',
    badge: '11+ Bank Profiles',
  },
  {
    icon: '🗺️',
    title: 'Mileage Tracking',
    desc: 'Log trips at the current IRS standard rate.',
    badge: 'IRS Rate Auto-Applied',
  },
  {
    icon: '📎',
    title: 'Receipt Management',
    desc: 'Upload receipts from your camera roll, Files app, or iCloud Drive directly.',
    badge: 'Auto Missing-Doc Alerts',
  },
];

const PRICING = [
  {
    name: 'Free',
    price: 'Free',
    note: 'No credit card required',
    color: '#94a3b8',
    cta: 'Get Started Free',
    features: [
      'Full transaction ledger',
      'Schedule C & tax mapping',
      'Gear depreciation tracking',
      'Mileage log',
      'Receipt storage',
      'Executive dashboard',
      'CRM pipeline',
      'Invoicing (5/mo)',
      'PWA — works offline',
    ],
  },
  {
    name: 'Sync',
    price: '$4.99',
    per: '/mo',
    note: 'Live bank sync — unlimited accounts',
    color: '#38bdf8',
    cta: 'Start Sync',
    features: [
      'Everything in Free',
      '🏦 Live bank sync via Plaid',
      'Transactions auto-import daily',
      'All connected accounts included',
      'No per-account fees',
    ],
  },
  {
    name: 'Core',
    price: '$9',
    per: '/mo',
    note: 'Most popular',
    color: '#f97316',
    badge: 'MOST POPULAR',
    cta: 'Upgrade to Core',
    features: [
      'Everything in Sync',
      '🤖 AI Financial Assistant',
      'Ledger repair & batch categorize',
      'Receipt scanner (OCR)',
      '2,000 transactions/mo',
      '20 invoices/mo',
      'Priority support',
    ],
  },
  {
    name: 'Studio',
    price: '$19',
    per: '/mo',
    note: 'For full-time creators',
    color: '#a78bfa',
    cta: 'Upgrade to Studio',
    features: [
      'Everything in Core',
      'Unlimited transactions',
      'Unlimited invoices',
      '🚗 Mileage autopilot (A→B→A)',
      'Advanced analytics',
      'Client portal',
      'Contract templates',
    ],
  },
];

export default function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at top right, #1e293b, #0f172a)',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '40px 20px',
    }}>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', maxWidth: '820px', marginTop: '60px' }}>
        <img
          src="/icon.png"
          alt="Lumière Ledger"
          width="160"
          height="160"
          style={{ marginBottom: '28px', borderRadius: '32px', filter: 'drop-shadow(0 0 30px rgba(249,115,22,0.35))' }}
        />

        <h1 style={{ fontSize: 'clamp(2.4rem, 7vw, 3.8rem)', fontWeight: 950, letterSpacing: '-0.04em', marginBottom: '18px', lineHeight: 1.08 }}>
          Your Entire Business.<br />
          <span style={{ color: 'var(--accent)' }}>One Command Center.</span>
        </h1>

        <p style={{ fontSize: '18px', lineHeight: 1.65, maxWidth: '640px', margin: '0 auto 32px', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
          Financial intelligence, CRM pipeline, AI-powered tax automation, professional invoicing, and gear management — purpose-built for photographers and creative professionals.
        </p>

        {/* Badge pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 36 }}>
          {[
            { label: '11+ Bank CSV Profiles Supported', color: '#38bdf8' },
            { label: '$75 IRS Receipt Threshold — Auto-Flagged', color: '#10b981' },
            { label: 'AI Gemini-Powered Intelligence', color: '#f97316' },
            { label: 'PWA Installs on iPhone & Android', color: '#a78bfa' },
          ].map(b => (
            <span key={b.label} style={{ fontSize: 11, fontWeight: 800, color: b.color, background: `${b.color}18`, border: `1px solid ${b.color}40`, borderRadius: 20, padding: '5px 13px', whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>
              {b.label}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <NavLink to="/login" className="btn primary glow-orange" style={{ padding: '16px 38px', fontSize: '16px', borderRadius: '14px', textDecoration: 'none', fontWeight: 900 }}>
            Open Lumière Ledger →
          </NavLink>
          <NavLink to="/login" style={{ padding: '16px 30px', fontSize: '14px', borderRadius: '14px', textDecoration: 'none', fontWeight: 800, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}>
            Get Started Free
          </NavLink>
        </div>
      </div>

      {/* ── Everything You Need ─────────────────────────────────────────── */}
      <div style={{ width: '100%', maxWidth: 1060, marginTop: 96 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Platform</div>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 950, letterSpacing: '-0.03em', margin: 0 }}>Everything You Need</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16 }}>
          {FEATURES.map(f => (
            <div key={f.title} className="card glass" style={{ padding: '26px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: '1.8rem', lineHeight: 1 }}>{f.icon}</div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 5 }}>{f.title}</div>
                {f.badge && (
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#f97316', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 20, padding: '2px 9px', display: 'inline-block', marginBottom: 6 }}>
                    {f.badge}
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55, fontWeight: 600 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tax Automation ──────────────────────────────────────────────── */}
      <div style={{ width: '100%', maxWidth: 1060, marginTop: 72 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#10b981', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Schedule C Ready</div>
            <h2 style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)', fontWeight: 950, letterSpacing: '-0.03em', margin: '0 0 14px' }}>Tax Automation</h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: 600, lineHeight: 1.6, margin: '0 0 20px' }}>
              Everything mapped, flagged, and export-ready — so tax time is a printout, not a scramble.
            </p>
          </div>
          <div className="card glass" style={{ padding: '28px 30px' }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                'Real-time Schedule C category mapping across all expense types',
                'IRS $75 receipt threshold auto-flagged — missing docs surface immediately',
                'Accountant-ready CSV export with one click',
                'AI Ledger Repair — retroactively categorizes your entire import history in batch',
                'Near-duplicate detection prevents double-counted transactions on import',
              ].map(item => (
                <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ color: '#10b981', fontWeight: 900, flexShrink: 0, marginTop: 2 }}>✓</span>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: 600, lineHeight: 1.5 }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── Client Management ───────────────────────────────────────────── */}
      <div style={{ width: '100%', maxWidth: 1060, marginTop: 64 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, alignItems: 'center' }}>
          <div className="card glass" style={{ padding: '28px 30px', order: 0 }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                'Visual pipeline: New Lead → Quoted → Booked → Lost',
                'Invoice builder with line items, tax, discounts, and PDF export',
                'Public Pay Portal — clients sign and approve on any device, no login required',
                'Instant approval notifications sent to your inbox the moment a client signs',
                'CRM financials view — lifetime revenue and outstanding invoices per client',
              ].map(item => (
                <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ color: '#f97316', fontWeight: 900, flexShrink: 0, marginTop: 2 }}>✓</span>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: 600, lineHeight: 1.5 }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div style={{ order: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#f97316', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>CRM + Invoicing</div>
            <h2 style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)', fontWeight: 950, letterSpacing: '-0.03em', margin: '0 0 14px' }}>Client Management</h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: 600, lineHeight: 1.6, margin: 0 }}>
              Close bookings faster, get paid without friction, and know exactly where every deal stands.
            </p>
          </div>
        </div>
      </div>

      {/* ── AI Intelligence ─────────────────────────────────────────────── */}
      <div style={{ width: '100%', maxWidth: 1060, marginTop: 72 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: '#f97316', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Gemini 2.5 Flash</div>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)', fontWeight: 950, letterSpacing: '-0.03em', margin: '0 0 12px' }}>AI Intelligence</h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', fontWeight: 600, margin: '0 auto', maxWidth: 520 }}>Ask Lumière anything. It has your full transaction history, gear data, and invoicing records in context.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {[
            'What were my top expenses last month?',
            'Am I on track for my revenue goal?',
            'Which subscriptions am I paying that I don\'t use?',
            'Summarize my Q1 for my accountant',
            'Batch-categorize my entire import history',
            'Show me my burn rate trend',
          ].map(q => (
            <div key={q} className="card glass" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>💬</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)', lineHeight: 1.45, fontStyle: 'italic' }}>"{q}"</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <div style={{ width: '100%', maxWidth: 1060, marginTop: 80 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Plans</div>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 950, letterSpacing: '-0.03em', margin: 0 }}>Pricing</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {PRICING.map(p => (
            <div key={p.name} className="card glass" style={{ padding: '30px', border: `1px solid ${p.color}30`, borderTop: `3px solid ${p.color}`, display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: 'white' }}>{p.name}</div>
                  {p.badge && (
                    <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.08em', color: p.color, background: `${p.color}18`, border: `1px solid ${p.color}40`, borderRadius: 20, padding: '2px 8px', display: 'inline-block', marginTop: 4 }}>
                      {p.badge}
                    </span>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 26, fontWeight: 950, color: p.color }}>{p.price}</span>
                  {p.per && <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>{p.per}</span>}
                </div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', marginBottom: 20 }}>{p.note}</div>
              <ul style={{ listStyle: 'none', margin: '0 0 24px', padding: 0, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                {p.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ color: p.color, fontWeight: 900, flexShrink: 0, fontSize: 12 }}>✓</span>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 600, lineHeight: 1.4 }}>{f}</span>
                  </li>
                ))}
              </ul>
              <NavLink
                to="/login"
                style={{
                  display: 'block', textAlign: 'center', padding: '13px 20px',
                  borderRadius: 12, fontWeight: 900, fontSize: 13, textDecoration: 'none',
                  background: p.disabled ? 'rgba(255,255,255,0.05)' : p.color,
                  color: p.disabled ? 'rgba(255,255,255,0.3)' : '#0f172a',
                  border: `1px solid ${p.disabled ? 'rgba(255,255,255,0.08)' : p.color}`,
                  cursor: p.disabled ? 'default' : 'pointer',
                  pointerEvents: p.disabled ? 'none' : 'auto',
                }}
              >
                {p.cta}
              </NavLink>
            </div>
          ))}
        </div>
      </div>

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <div style={{ width: '100%', maxWidth: 1060, marginTop: 80 }}>
        <div style={{ background: 'radial-gradient(circle at top left, rgba(249,115,22,0.12), rgba(249,115,22,0.02))', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 24, padding: 'clamp(32px, 5vw, 60px)', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4.5vw, 2.8rem)', fontWeight: 950, letterSpacing: '-0.03em', margin: '0 0 16px', lineHeight: 1.1 }}>
            Stop Running Your Business<br />From Spreadsheets
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', fontWeight: 600, margin: '0 auto 32px', maxWidth: 560, lineHeight: 1.6 }}>
            Start free — no credit card required. Add live bank sync for $4.99/mo, or go all-in with Core or Studio.
          </p>
          <NavLink to="/login" className="btn primary glow-orange" style={{ padding: '18px 44px', fontSize: '16px', borderRadius: '14px', textDecoration: 'none', fontWeight: 900 }}>
            Open Lumière Ledger →
          </NavLink>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer style={{ marginTop: 80, paddingBottom: 60, display: 'flex', justifyContent: 'center', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', gap: 24, justifyContent: 'center' }}>
            <NavLink to="/privacy" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none', fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em' }}>PRIVACY POLICY</NavLink>
            <NavLink to="/terms" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none', fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em' }}>TERMS OF SERVICE</NavLink>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8 }}>
            <img src="/icon.png" alt="Lumière Ledger" style={{ width: 38, height: 38, borderRadius: 10 }} />
            <div style={{ textAlign: 'left' }}>
              <div className="title" style={{ fontSize: '1.3rem', fontWeight: 950, letterSpacing: '-0.02em', whiteSpace: 'nowrap', lineHeight: 1 }}>LUMIÈRE LEDGER</div>
              <div style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                © 2026 THROUGH THE LENS MEDIA · LUMIERELEDGER.COM
              </div>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
