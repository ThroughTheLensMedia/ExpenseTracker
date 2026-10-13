import React from 'react';
import { NavLink, useParams, Navigate } from 'react-router-dom';

import { FOR_PAGES, PLAN_LINE } from './forData';
import { OTHERS } from './compareData';
import { Shell, StartFree, ForLinks } from './Compare';
import { usePageMeta } from '../utils/usePageMeta';

// Public /for/photographers, /for/freelancers, /for/small-business pages.
// Pre-rendered at build by scripts/prerender-compare.js (same as /compare).
export default function ForProfile() {
  const { profile } = useParams();
  const page = FOR_PAGES[profile];
  if (!page) return <Navigate to="/compare" replace />;
  return <ForArticle page={page} slug={profile} />;
}

function ForArticle({ page, slug }) {
  usePageMeta(page.title, page.description);
  return (
    <Shell>
      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>
        Lumière Ledger by line of work
      </div>
      <h1 style={{ fontFamily: 'var(--display)', fontSize: 'clamp(2rem, 5vw, 3.1rem)', fontWeight: 650, letterSpacing: '-0.03em', lineHeight: 1.12, margin: '0 0 16px' }}>
        {page.h1}
      </h1>
      <p style={{ fontSize: 17, lineHeight: 1.6, color: 'rgba(255,255,255,0.68)', fontWeight: 600, margin: '0 0 22px', maxWidth: 740 }}>
        {page.intro}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        {page.sections.map(sec => (
          <div key={sec.h} className="card glass" style={{ padding: '20px 20px', margin: 0 }}>
            <h2 style={{ fontSize: 17, fontWeight: 850, margin: '0 0 8px' }}>{sec.h}</h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, fontWeight: 600, color: 'rgba(255,255,255,0.68)' }}>{sec.p}</p>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 22, fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.55)', fontWeight: 600, maxWidth: 740 }}>
        {PLAN_LINE} Hand entry works on every plan, and bank sync is optional. Lumière Ledger is not a replacement for a CPA.
      </p>
      <StartFree />
      <ForLinks current={slug} />
      <div style={{ marginTop: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>
          Compare
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <NavLink to="/" className="card glass" style={{ textDecoration: 'none', color: 'white', padding: '12px 14px', fontSize: 13, fontWeight: 800 }}>Home</NavLink>
          <NavLink to="/compare" className="card glass" style={{ textDecoration: 'none', color: 'white', padding: '12px 14px', fontSize: 13, fontWeight: 800 }}>All comparisons</NavLink>
          {OTHERS.map(p => (
            <NavLink key={p.slug} to={`/compare/${p.slug}`} className="card glass" style={{ textDecoration: 'none', color: 'white', padding: '12px 14px', fontSize: 13, fontWeight: 800 }}>
              vs {p.name}
            </NavLink>
          ))}
        </div>
      </div>
    </Shell>
  );
}
