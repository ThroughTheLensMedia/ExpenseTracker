import React from 'react';
import { NavLink } from 'react-router-dom';
import { Bot, FileText, BarChart3, Target, Wrench, Landmark, Map, Paperclip, MessageCircle, ShieldCheck, Lock, KeyRound, BadgeCheck, Camera, Palette, Video, Quote } from 'lucide-react';
// Illustrative use-case scenarios — NOT customer testimonials. When real customer
// quotes arrive, swap these for a testimonial section (name, photo, quote, permission on file).
const PERSONAS = [
  {
    icon: Camera, accent: '#f97316', title: 'The Wedding Photographer',
    body: 'Tracks a $14k gear bag with automatic Section 179 depreciation, logs venue round-trips at the IRS rate, and hands their CPA a clean Schedule C export in January.',
  },
  {
    icon: Palette, accent: '#38bdf8', title: 'The Freelance Designer',
    body: 'Caught $200/mo in forgotten software subscriptions in the first import, and now every Adobe and Figma charge lands in the right tax bucket automatically.',
  },
  {
    icon: Video, accent: '#a78bfa', title: 'The Videographer',
    body: 'Sends branded invoices clients e-sign from their phone, watches the pipeline move from quote to booked, and knows exactly which client pays late.',
  },
];

const SECURITY_ITEMS = [
  { icon: ShieldCheck, title: 'Tenant isolation', body: 'Row-Level Security enforced at the database — your data is invisible to every other account, by architecture.' },
  { icon: Lock, title: 'Encrypted bank tokens', body: 'Bank credentials never touch our servers. Plaid tokens are encrypted with libsodium; everything rides TLS.' },
  { icon: KeyRound, title: 'Your AI, your key', body: 'Bring-your-own-key AI: your financial data goes to your Gemini key — it never trains anyone’s model.' },
  { icon: BadgeCheck, title: 'SOC 2 Type II infrastructure', body: 'Built on Vercel, Supabase, and Plaid — all SOC 2 Type II certified providers.' },
];

// Faux-dashboard mockup data (illustrative)
const MOCK_BARS = [34, 52, 41, 68, 59, 82, 74, 90, 66, 78, 95, 88];

const FEATURES = [
  {
    icon: Bot,
    title: 'AI Financial Assistant',
    desc: 'Ask Lumière anything about your business. Powered by Google Gemini 2.5 Flash with access to your full transaction history.',
    badge: 'Gemini 2.5 Flash',
  },
  {
    icon: FileText,
    title: 'Professional Invoicing',
    desc: 'Build and send polished invoices with line items, tax, and discounts. Clients e-sign directly on a branded Pay Portal.',
    badge: 'E-Signature Included',
  },
  {
    icon: BarChart3,
    title: 'Executive Dashboard',
    desc: 'Real-time gross revenue, net profit, burn rate, and cash flow forecasts.',
    badge: 'Live KPIs',
  },
  {
    icon: Target,
    title: 'CRM Pipeline',
    desc: 'Track every lead from first inquiry to final booking. Visual Kanban board.',
    badge: 'Bookings Pipeline',
  },
  {
    icon: Wrench,
    title: 'Gear Depreciation',
    desc: 'Section 179 and Straight-Line depreciation calculated automatically.',
    badge: null,
  },
  {
    icon: Landmark,
    title: 'Smart CSV Import',
    desc: 'Drop exports from Chase, Amex, Bank of America, Wells Fargo, Rocket Money, and 6+ others.',
    badge: '11+ Bank Profiles',
  },
  {
    icon: Map,
    title: 'Mileage Tracking',
    desc: 'Log trips at the current IRS standard rate.',
    badge: 'IRS Rate Auto-Applied',
  },
  {
    icon: Paperclip,
    title: 'Receipt Management',
    desc: 'Upload receipts from your camera roll, Files app, or iCloud Drive directly.',
    badge: 'Auto Missing-Doc Alerts',
  },
];

const PLANS = [
  { name: 'Free',   price: 'Free',  per: '',    note: 'No credit card required',            color: '#94a3b8', cta: 'Get Started Free'   },
  { name: 'Sync',   price: '$4.99', per: '/mo', note: 'Live bank sync',                      color: '#38bdf8', cta: 'Start Sync',  badge: null },
  { name: 'Core',   price: '$9',    per: '/mo', note: 'Most popular',                        color: '#f97316', cta: 'Upgrade to Core',  badge: 'MOST POPULAR' },
  { name: 'Studio', price: '$19',   per: '/mo', note: 'For full-time creators',              color: '#a78bfa', cta: 'Upgrade to Studio' },
];

// null = not available, true = included, string = limit/detail
const FEATURE_ROWS = [
  { label: 'Transaction ledger',         values: [true,   true,       true,       true]   },
  { label: 'Schedule C tax mapping',     values: [true,   true,       true,       true]   },
  { label: 'CSV bank import',            values: [true,   true,       true,       true]   },
  { label: 'Receipt storage',            values: [true,   true,       true,       true]   },
  { label: 'Mileage log',                values: [true,   true,       true,       true]   },
  { label: 'CRM pipeline',               values: ['10 leads', '10 leads', 'Unlimited', 'Unlimited'] },
  { label: 'Invoicing',                  values: ['5/mo', '5/mo',    '20/mo',    'Unlimited'] },
  { label: 'Gear depreciation',          values: ['5 items', '5 items', 'Unlimited', 'Unlimited'] },
  { label: 'Executive dashboard',        values: [null,   null,       true,       true]   },
  { label: 'Live bank sync (Plaid)',      values: [null,   'Up to 5 accounts', true, true] },
  { label: 'AI Financial Assistant',     values: [null,   null,       true,       true]   },
  { label: 'Receipt scanner (OCR)',      values: [null,   null,       true,       true]   },
  { label: 'Batch AI categorization',    values: [null,   null,       null,       true]   },
  { label: 'Mileage autopilot (A→B→A)',  values: [null,   null,       null,       true]   },
  { label: 'Unlimited transactions',     values: [null,   null,       null,       true]   },
  { label: 'Priority support',           values: [null,   null,       true,       true]   },
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
          Financial intelligence, CRM pipeline, AI-powered tax automation, professional invoicing, and gear management — built for freelancers and creative professionals. Photographers are why we built it. Everyone else is welcome too.
        </p>

        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 0 }}>
          <NavLink to="/login" className="btn primary glow-orange" style={{ padding: '16px 38px', fontSize: '16px', borderRadius: '14px', textDecoration: 'none', fontWeight: 900 }}>
            Open Lumière Ledger →
          </NavLink>
          <NavLink to="/login?signup=1" style={{ padding: '16px 30px', fontSize: '14px', borderRadius: '14px', textDecoration: 'none', fontWeight: 800, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}>
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
              <div style={{ lineHeight: 1 }}><f.icon size={28} style={{ color: 'var(--accent)' }} /></div>
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

      {/* ── Product Mockup (illustrative data, pure CSS) ────────────────── */}
      <div style={{ width: '100%', maxWidth: 900, marginTop: 64 }}>
        <div className="card glass" style={{ padding: 0, overflow: 'hidden', borderRadius: 18 }}>
          {/* Browser chrome */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(0,0,0,0.35)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', opacity: 0.7 }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fcd34d', opacity: 0.7 }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#4ade80', opacity: 0.7 }} />
            <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '3px 12px' }}>www.lumiereledger.com</span>
          </div>
          {/* Mock KPIs */}
          <div style={{ padding: 'clamp(16px, 3vw, 28px)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
              {[
                { k: 'GROSS REVENUE', v: '$48,210', cls: 'amt-income' },
                { k: 'DEDUCTIONS FOUND', v: '$12,384', cls: 'amt-deduction' },
                { k: 'NET PROFIT', v: '$31,077', cls: 'amt-income' },
              ].map(s => (
                <div key={s.k} className="stat">
                  <div className="k">{s.k}</div>
                  <div className={`v money ${s.cls}`}>{s.v}</div>
                </div>
              ))}
            </div>
            {/* Mock bar chart */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 90, padding: '0 4px' }}>
              {MOCK_BARS.map((h, i) => (
                <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: '4px 4px 0 0', background: `linear-gradient(180deg, color-mix(in srgb, var(--accent) 70%, transparent), color-mix(in srgb, var(--accent) 25%, transparent))` }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em' }}>
              <span>JAN</span><span>MAR</span><span>MAY</span><span>JUL</span><span>SEP</span><span>NOV</span>
            </div>
          </div>
        </div>
        <p style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.2)', marginTop: 10, letterSpacing: '0.06em' }}>ILLUSTRATIVE DATA</p>
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
              <MessageCircle size={18} style={{ flexShrink: 0, color: 'var(--accent)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)', lineHeight: 1.45, fontStyle: 'italic' }}>"{q}"</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Founder's Note ──────────────────────────────────────────────── */}
      <div style={{ width: '100%', maxWidth: 760, marginTop: 80 }}>
        <div className="card glass" style={{ padding: 'clamp(28px, 4vw, 44px)', textAlign: 'center' }}>
          <Quote size={26} style={{ color: 'var(--accent)', marginBottom: 14 }} />
          <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Built by a Working Photographer</div>
          <p style={{ fontFamily: 'var(--display)', fontSize: 'clamp(1.2rem, 2.6vw, 1.6rem)', fontWeight: 600, lineHeight: 1.5, margin: '0 0 18px', color: 'rgba(255,255,255,0.9)' }}>
            "I built Lumière Ledger because I needed it — a photographer drowning in receipts, mileage, and gear write-offs.
            You focus on the shot. We'll focus on the finances."
          </p>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.6)' }}>Joshua Deuermeyer</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)' }}>Founder — Through The Lens Media, Las Vegas</div>
        </div>
      </div>

      {/* ── Made For How You Work (illustrative scenarios) ──────────────── */}
      <div style={{ width: '100%', maxWidth: 1060, marginTop: 56 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Made For How You Work</div>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)', fontWeight: 950, letterSpacing: '-0.03em', margin: 0 }}>One Ledger, Every Kind of Creative</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {PERSONAS.map(p => (
            <div key={p.title} className="card glass card-hover" style={{ padding: '26px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p.icon size={24} style={{ color: p.accent }} />
              <div style={{ fontWeight: 900, fontSize: 15 }}>{p.title}</div>
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, fontWeight: 600 }}>{p.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <div style={{ width: '100%', maxWidth: 1100, marginTop: 80 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Plans &amp; Pricing</div>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 950, letterSpacing: '-0.03em', margin: '0 0 12px' }}>Simple, Transparent Pricing</h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', fontWeight: 600, margin: 0 }}>Start free — no credit card required. Upgrade anytime.</p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {/* Feature label column */}
                <th style={{ width: '28%', padding: '0 0 24px 0', textAlign: 'left', verticalAlign: 'bottom' }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Features</span>
                </th>
                {PLANS.map(p => (
                  <th key={p.name} style={{ width: '18%', padding: '0 8px 24px', textAlign: 'center', verticalAlign: 'bottom', borderTop: `3px solid ${p.color}`, background: `${p.color}08`, borderRadius: '8px 8px 0 0' }}>
                    {p.badge && (
                      <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.08em', color: p.color, background: `${p.color}20`, border: `1px solid ${p.color}40`, borderRadius: 20, padding: '3px 10px', display: 'inline-block', marginBottom: 8 }}>
                        {p.badge}
                      </div>
                    )}
                    <div style={{ fontSize: 15, fontWeight: 900, color: 'white', marginBottom: 4 }}>{p.name}</div>
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 24, fontWeight: 950, color: p.color }}>{p.price}</span>
                      {p.per && <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.35)' }}>{p.per}</span>}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>{p.note}</div>
                    <NavLink
                      to="/login"
                      style={{
                        display: 'block', textAlign: 'center', padding: '10px 12px',
                        borderRadius: 10, fontWeight: 900, fontSize: 12, textDecoration: 'none',
                        background: p.color, color: '#0f172a',
                      }}
                    >
                      {p.cta}
                    </NavLink>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row, i) => (
                <tr key={row.label} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                  <td style={{ padding: '13px 0', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>{row.label}</td>
                  {row.values.map((val, pi) => (
                    <td key={pi} style={{ padding: '13px 8px', textAlign: 'center', background: `${PLANS[pi].color}06` }}>
                      {val === null ? (
                        <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: 16 }}>—</span>
                      ) : val === true ? (
                        <span style={{ color: PLANS[pi].color, fontSize: 15, fontWeight: 900 }}>✓</span>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 800, color: PLANS[pi].color, background: `${PLANS[pi].color}15`, borderRadius: 20, padding: '3px 9px', display: 'inline-block' }}>{val}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {/* Bottom CTA row */}
              <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <td style={{ padding: '24px 0' }} />
                {PLANS.map(p => (
                  <td key={p.name} style={{ padding: '24px 8px', textAlign: 'center', background: `${p.color}06` }}>
                    <NavLink
                      to="/login"
                      style={{
                        display: 'block', textAlign: 'center', padding: '12px 14px',
                        borderRadius: 10, fontWeight: 900, fontSize: 12, textDecoration: 'none',
                        background: p.color, color: '#0f172a',
                      }}
                    >
                      {p.cta}
                    </NavLink>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Security Strip ──────────────────────────────────────────────── */}
      <div style={{ width: '100%', maxWidth: 1060, marginTop: 72 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: '#10b981', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Your Data Is Yours</div>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)', fontWeight: 950, letterSpacing: '-0.03em', margin: 0 }}>Bank-Grade Security, Solo-Business Simple</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
          {SECURITY_ITEMS.map(s => (
            <div key={s.title} className="card glass" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <s.icon size={22} style={{ color: '#10b981' }} />
              <div style={{ fontWeight: 900, fontSize: 14 }}>{s.title}</div>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55, fontWeight: 600 }}>{s.body}</p>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <NavLink to="/security-policy" style={{ fontSize: 12, fontWeight: 800, color: '#10b981', textDecoration: 'none', borderBottom: '1px solid rgba(16,185,129,0.35)', paddingBottom: 2 }}>
            Read our full Information Security Policy →
          </NavLink>
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
            <NavLink to="/security-policy" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none', fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em' }}>SECURITY</NavLink>
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
