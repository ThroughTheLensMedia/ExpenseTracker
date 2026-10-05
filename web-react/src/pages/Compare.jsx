import React, { useEffect } from 'react';
import { NavLink, useParams, Navigate } from 'react-router-dom';

// Public comparison pages. Approved to publish 2026-10-04.
// Prices below match the live homepage pricing table (Home.jsx PLANS), confirmed
// in the production bundle at https://lumiereledger.com on 2026-10-04.
// $4.99/mo is the Sync plan (live bank sync), not the only paid plan.

const PRICE = 'Free to start. Bank sync $4.99/mo. Core $9/mo, Studio $19/mo.';

const PROFILES = 'Photographer, Freelancer, Small Business, or Personal / Side Hustle';

const OTHERS = [
  { slug: 'quickbooks-solopreneur', name: 'QuickBooks Solopreneur' },
  { slug: 'freshbooks', name: 'FreshBooks' },
  { slug: 'wave', name: 'Wave' },
  { slug: 'bonsai', name: 'Bonsai' },
  { slug: 'honeybook', name: 'HoneyBook' },
];

const PAGES = {
  'quickbooks-solopreneur': {
    title: 'Lumière Ledger vs QuickBooks Solopreneur for freelancers',
    description: 'Compare Lumière Ledger and QuickBooks Solopreneur for solo freelancers. Profile-based tools, optional bank sync, free to start with bank sync at $4.99/mo — without full accounting software.',
    h1: 'Lumière Ledger vs QuickBooks Solopreneur',
    competitor: 'QuickBooks Solopreneur',
    angle: 'QuickBooks Solopreneur is still QuickBooks-shaped: one toolbox for everyone. Lumière Ledger changes the screen by the kind of work you do, so a freelancer is not wading through accountant features to find an invoice or a mileage log.',
    tradeoffTitle: 'Where each one wins',
    tradeoff: 'QuickBooks wins if you need deep accounting, payroll, or a bookkeeper who already lives in QuickBooks. Lumière Ledger wins if you want a thin books layer you actually open.',
    columns: ['Lumière Ledger', 'QuickBooks Solopreneur'],
    rows: [
      ['Shows only tools for your work', 'Yes (profiles)', 'No, same toolkit'],
      ['Invoices and expenses', 'Yes', 'Yes'],
      ['Bank sync', 'Optional', 'Core'],
      ['Mileage and gear', 'Built in', 'Varies / add-ons'],
      ['Price', PRICE, 'Higher QuickBooks price'],
      ['CPA replacement', 'No', 'No'],
    ],
  },
  freshbooks: {
    title: 'Lumière Ledger vs FreshBooks for freelancers',
    description: 'See how Lumière Ledger compares to FreshBooks for invoicing, expenses, and tax-ready records — with profiles that hide tools you don’t need.',
    h1: 'Lumière Ledger vs FreshBooks',
    competitor: 'FreshBooks',
    angle: 'FreshBooks is strong on invoicing and client billing. Lumière Ledger is a fuller day-to-day ledger — mileage, gear depreciation, and tax review — that stays lighter than accounting software.',
    tradeoffTitle: 'Where each one wins',
    tradeoff: 'FreshBooks wins for heavy billing and time tracking. Lumière Ledger wins when the pain is scattered books more than polished invoices.',
    columns: ['Lumière Ledger', 'FreshBooks'],
    rows: [
      ['Profile UI', 'Yes', 'No'],
      ['Invoicing', 'Yes', 'Strong'],
      ['Ledger', 'Yes', 'Yes'],
      ['Mileage and gear', 'Yes', 'Limited'],
      ['Tax review', 'Yes', 'Partial'],
      ['Price', PRICE, 'Higher paid plans'],
    ],
  },
  wave: {
    title: 'Lumière Ledger vs Wave for freelancers',
    description: 'Compare Lumière Ledger and Wave for free or cheap freelancer bookkeeping. Profiles, mileage, and gear tracking without a bloated accounting suite.',
    h1: 'Lumière Ledger vs Wave',
    competitor: 'Wave',
    angle: 'Wave is free accounting with a classic books screen. Lumière Ledger is freemium and profile-shaped: fewer menus, and a clearer sense of what fits your work.',
    tradeoffTitle: 'Where each one wins',
    tradeoff: 'Wave wins for free full double-entry accounting. Lumière Ledger wins if free accounting still feels like too much software.',
    columns: ['Lumière Ledger', 'Wave'],
    rows: [
      ['Start cost', PRICE, 'Free core'],
      ['Profiles', 'Yes', 'No'],
      ['Invoicing', 'Yes', 'Yes'],
      ['Accounting depth', 'Light', 'Deeper'],
      ['Mileage and gear', 'Built in', 'Not the focus'],
      ['Best for', 'One-person freelancers who want less UI', 'People who want free traditional books'],
    ],
  },
  bonsai: {
    title: 'Lumière Ledger vs Bonsai for freelancers',
    description: 'Lumière Ledger vs Bonsai: books and tax-ready records vs contracts, proposals, and client ops. Pick based on whether your gap is money tracking or client paperwork.',
    h1: 'Lumière Ledger vs Bonsai',
    competitor: 'Bonsai',
    angle: 'These are different jobs. Bonsai is freelance operations: contracts, proposals, and client workflow. Lumière Ledger is the money side: a transaction ledger, mileage, gear depreciation, and tax review. If your gap is paperwork with clients, Bonsai is the closer fit. If your gap is the books, this is.',
    tradeoffTitle: 'Where each one wins',
    tradeoff: 'Bonsai wins for contracts, proposals, and CRM. Lumière Ledger wins if you already have clients and need cleaner books for taxes. Lumière Ledger does not do contracts or proposals.',
    columns: ['Lumière Ledger', 'Bonsai'],
    rows: [
      ['Contracts and proposals', 'No', 'Yes'],
      ['Invoicing', 'Yes', 'Yes'],
      ['Tax-ready ledger', 'Yes', 'Secondary'],
      ['Mileage and gear', 'Yes', 'No'],
      ['Profiles', 'Yes', 'No'],
      ['Price', PRICE, 'Bonsai subscription'],
    ],
  },
  honeybook: {
    title: 'Lumière Ledger vs HoneyBook for freelancers',
    description: 'Lumière Ledger vs HoneyBook: books, mileage, and tax-ready records vs proposals, contracts, and client management. Pick based on whether your gap is the books or client paperwork.',
    h1: 'Lumière Ledger vs HoneyBook',
    competitor: 'HoneyBook',
    angle: 'These are different jobs. HoneyBook is client operations: proposals, contracts, invoices, scheduling, and a client list. Lumière Ledger is the money side: a transaction ledger, mileage, gear depreciation, and tax review. If your gap is booking and paperwork with clients, HoneyBook is the closer fit. If your gap is the books, this is.',
    tradeoffTitle: 'Where each one wins',
    tradeoff: 'HoneyBook wins for proposals, contracts, scheduling, and client management. Lumière Ledger wins if you already have clients and need cleaner books for taxes. Lumière Ledger does not do contracts, proposals, or scheduling.',
    columns: ['Lumière Ledger', 'HoneyBook'],
    rows: [
      ['Contracts and proposals', 'No', 'Yes'],
      ['Invoicing', 'Yes', 'Yes'],
      ['Scheduling and client management', 'No', 'Yes'],
      ['Tax-ready ledger', 'Yes', 'Not the focus'],
      ['Mileage and gear', 'Yes', 'No'],
      ['Profiles', 'Yes', 'No'],
      ['Price', PRICE, 'HoneyBook subscription'],
    ],
  },
};

const FEATURES = [
  'Business profiles',
  'Invoicing',
  'Transaction ledger',
  'Bank import',
  'Mileage',
  'Gear depreciation',
  'Tax review',
];

function usePageMeta(title, description) {
  useEffect(() => {
    const prevTitle = document.title;
    const meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta ? meta.getAttribute('content') : null;
    document.title = title;
    if (meta && description) meta.setAttribute('content', description);
    return () => {
      document.title = prevTitle;
      if (meta && prevDesc != null) meta.setAttribute('content', prevDesc);
    };
  }, [title, description]);
}

function Shell({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at top right, #1e293b, #0f172a)',
      color: 'white',
      padding: '28px 20px 64px',
    }}>
      <div style={{ width: '100%', maxWidth: 980, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
          <NavLink to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'white' }}>
            <img src="/icon.png" alt="" width="36" height="36" style={{ borderRadius: 10 }} />
            <span className="title" style={{ fontWeight: 950, letterSpacing: '-0.02em' }}>Lumière Ledger</span>
          </NavLink>
          <NavLink to="/compare" style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>
            ALL COMPARISONS
          </NavLink>
        </div>
        {children}
      </div>
    </div>
  );
}

function StartFree() {
  return (
    <div style={{
      marginTop: 36,
      background: 'radial-gradient(circle at top left, rgba(76,125,255,0.16), rgba(76,125,255,0.03))',
      border: '1px solid rgba(76,125,255,0.28)',
      borderRadius: 20,
      padding: '28px 24px',
      textAlign: 'center',
    }}>
      <div style={{ fontFamily: 'var(--display)', fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 650, marginBottom: 8 }}>
        Start free
      </div>
      <p style={{ margin: '0 auto 18px', maxWidth: 520, color: 'rgba(255,255,255,0.6)', fontWeight: 600, lineHeight: 1.55, fontSize: 14 }}>
        Open Lumière Ledger and pick a profile first — {PROFILES}. You only see the tools that fit. No credit card to start.
      </p>
      <NavLink to="/login?signup=1" className="btn primary" style={{ display: 'inline-block', padding: '14px 28px', borderRadius: 14, textDecoration: 'none', fontWeight: 900 }}>
        Start free
      </NavLink>
    </div>
  );
}

function OtherLinks({ current }) {
  const rest = OTHERS.filter(p => p.slug !== current);
  return (
    <div style={{ marginTop: 28, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {rest.map(p => (
        <NavLink key={p.slug} to={`/compare/${p.slug}`} className="card glass" style={{
          textDecoration: 'none',
          color: 'white',
          padding: '12px 14px',
          fontSize: 13,
          fontWeight: 800,
        }}>
          vs {p.name}
        </NavLink>
      ))}
    </div>
  );
}

function FeatureRow() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '22px 0 8px' }}>
      {FEATURES.map(f => (
        <span key={f} style={{
          fontSize: 12,
          fontWeight: 800,
          color: 'rgba(255,255,255,0.72)',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 999,
          padding: '6px 10px',
        }}>{f}</span>
      ))}
    </div>
  );
}

function CompareTable({ columns, rows }) {
  return (
    <div style={{ overflowX: 'auto', marginTop: 22 }}>
      <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '12px 10px', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }} />
            {columns.map(col => (
              <th key={col} style={{ textAlign: 'left', padding: '12px 10px', fontSize: 13, fontWeight: 900, borderBottom: '2px solid rgba(76,125,255,0.45)' }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row[0]} style={{ background: i % 2 ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{
                  padding: '13px 10px',
                  fontSize: 14,
                  fontWeight: ci === 0 ? 800 : 600,
                  color: ci === 0 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.68)',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  verticalAlign: 'top',
                  lineHeight: 1.45,
                }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Compare() {
  const { slug } = useParams();
  if (!slug) return <CompareHub />;
  const page = PAGES[slug];
  if (!page) return <Navigate to="/compare" replace />;
  return <CompareArticle page={page} slug={slug} />;
}

function CompareArticle({ page, slug }) {
  usePageMeta(page.title, page.description);
  return (
    <Shell>
      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>
        For freelancers and creatives
      </div>
      <h1 style={{ fontFamily: 'var(--display)', fontSize: 'clamp(2rem, 5vw, 3.1rem)', fontWeight: 650, letterSpacing: '-0.03em', lineHeight: 1.12, margin: '0 0 16px' }}>
        {page.h1}
      </h1>
      <p style={{ fontSize: 17, lineHeight: 1.6, color: 'rgba(255,255,255,0.68)', fontWeight: 600, margin: '0 0 14px', maxWidth: 740 }}>
        {page.angle}
      </p>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,0.55)', fontWeight: 600, margin: 0, maxWidth: 740 }}>
        Lumière Ledger sits between a basic expense tracker and full accounting software. Pick a profile — {PROFILES} — and only the tools for that work stay in front of you. Bank sync is optional. Hand entry works. It is not a replacement for a CPA.
      </p>
      <FeatureRow />
      <CompareTable columns={page.columns} rows={page.rows} />
      <div className="card glass" style={{ marginTop: 22, padding: '22px 22px' }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>{page.tradeoffTitle}</div>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, fontWeight: 650, color: 'rgba(255,255,255,0.82)' }}>{page.tradeoff}</p>
      </div>
      <p style={{ marginTop: 18, fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,0.4)', fontWeight: 600, maxWidth: 740 }}>
        Built in Las Vegas for a photography business, then opened to other kinds of work. Prices above are Lumière Ledger’s own plans as shown on lumiereledger.com: Free, Sync at $4.99/mo for live bank sync, Core at $9/mo, and Studio at $19/mo. This page does not quote {page.competitor}’s current price.
      </p>
      <StartFree />
      <OtherLinks current={slug} />
    </Shell>
  );
}

function CompareHub() {
  usePageMeta(
    'Compare Lumière Ledger for freelancers',
    'Side-by-side looks at Lumière Ledger versus QuickBooks Solopreneur, FreshBooks, Wave, Bonsai, and HoneyBook for freelancers and creatives.'
  );
  return (
    <Shell>
      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>
        For freelancers and creatives
      </div>
      <h1 style={{ fontFamily: 'var(--display)', fontSize: 'clamp(2rem, 5vw, 3.1rem)', fontWeight: 650, letterSpacing: '-0.03em', lineHeight: 1.12, margin: '0 0 14px' }}>
        Compare Lumière Ledger
      </h1>
      <p style={{ fontSize: 16, lineHeight: 1.6, color: 'rgba(255,255,255,0.62)', fontWeight: 600, maxWidth: 680, margin: '0 0 8px' }}>
        Simpler than full accounting software, and more useful than a basic expense tracker. These pages are honest about what Lumière Ledger does not do.
      </p>
      <FeatureRow />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 22 }}>
        {OTHERS.map(p => (
          <NavLink key={p.slug} to={`/compare/${p.slug}`} className="card glass card-hover" style={{ textDecoration: 'none', color: 'white', padding: '22px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Lumière Ledger vs</div>
            <div style={{ fontFamily: 'var(--display)', fontSize: 22, fontWeight: 650 }}>{p.name}</div>
          </NavLink>
        ))}
      </div>
      <StartFree />
    </Shell>
  );
}
