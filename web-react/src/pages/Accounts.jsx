import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../api';

// ─── Source metadata ───────────────────────────────────────────────────────────
const SOURCE_META = {
    manual:        { label: 'Manual Entry',       type: 'manual',   institution: 'Direct Entry' },
    checking:      { label: 'Checking',           type: 'checking', institution: 'Bank Account' },
    plaid:         { label: 'Plaid (Auto-Sync)',  type: 'checking', institution: 'Live Bank Sync' },
    rocketmoney:   { label: 'Rocket Money',       type: 'checking', institution: 'Rocket Money' },
    chase:         { label: 'Chase Bank',         type: 'checking', institution: 'Chase' },
    usbank:        { label: 'US Bank',            type: 'checking', institution: 'US Bank' },
    bankofamerica: { label: 'Bank of America',    type: 'checking', institution: 'Bank of America' },
    wellsfargo:    { label: 'Wells Fargo',        type: 'checking', institution: 'Wells Fargo' },
    applecard:     { label: 'Apple Card',         type: 'credit',   institution: 'Goldman Sachs' },
    capitalone:    { label: 'Capital One',        type: 'credit',   institution: 'Capital One' },
    usaa:          { label: 'USAA',               type: 'checking', institution: 'USAA' },
    navyfcu:       { label: 'Navy Federal',       type: 'checking', institution: 'Navy Federal CU' },
    wise:          { label: 'Wise',               type: 'checking', institution: 'Wise' },
    delta_amex:    { label: 'Delta Amex',         type: 'credit',   institution: 'American Express' },
    amex_gold:     { label: 'Amex Gold',          type: 'credit',   institution: 'American Express' },
    amex_platinum: { label: 'Amex Platinum',      type: 'credit',   institution: 'American Express' },
    amex_blue:     { label: 'Amex Blue Cash',     type: 'credit',   institution: 'American Express' },
};

const TYPE_BADGE = {
    checking: { label: 'Checking / Bank', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
    credit:   { label: 'Credit Card',     color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
    manual:   { label: 'Manual',          color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
};

function getMeta(source) {
    const key = (source || '').toLowerCase();
    if (SOURCE_META[key]) return SOURCE_META[key];
    const isCreditish = ['card','amex','credit','visa','mastercard','discover'].some(k => key.includes(k));
    return {
        label:       key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        type:        isCreditish ? 'credit' : 'checking',
        institution: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    };
}

function fmt(cents) {
    if (cents === null || cents === undefined) return '—';
    return '$' + Math.abs(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
    if (!d) return '—';
    const [yr, mo, dy] = d.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(mo,10)-1]} ${parseInt(dy,10)}, ${yr}`;
}

function trendArrow(thisMonth, lastMonth) {
    if (!lastMonth || Math.abs(lastMonth) < 50) return null;
    const diff = thisMonth - lastMonth;
    const pct  = Math.abs(Math.round((diff / Math.abs(lastMonth)) * 100));
    if (Math.abs(diff) < 50) return null;
    return {
        up:    diff > 0,
        pct,
        color: diff > 0 ? '#ef4444' : '#10b981',
        label: `${diff > 0 ? '↑' : '↓'} ${pct}% vs last month`,
    };
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function Accounts() {
    const navigate = useNavigate();
    const [data,    setData]    = useState(null);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiGet('/accounts/summary');
            setData(res);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Sort: highest this-month spend first, manual last
    const accounts = [...(data?.accounts || [])].sort((a, b) => {
        if (a.source === 'manual' && b.source !== 'manual') return 1;
        if (b.source === 'manual' && a.source !== 'manual') return -1;
        return b.this_month_cents - a.this_month_cents;
    });

    const totalMonth    = data?.total_month_cents  || 0;
    const checkingTotal = data?.checking_cents     || 0;
    const creditTotal   = data?.credit_cents       || 0;

    return (
        <div style={{ width: '100%', padding: '0 0 48px' }}>

            {/* ── Header ── */}
            <div style={{ marginBottom: 24, padding: '0 4px' }}>
                <h1 style={{ fontSize: 26, fontWeight: 900, color: 'white', margin: 0 }}>Accounts</h1>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: '4px 0 0', fontWeight: 600 }}>
                    Spending by account — this month, last month, year-to-date
                </p>
            </div>

            {/* ── Summary bar ── */}
            {data && !loading && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: 10,
                    marginBottom: 20,
                }}>
                    {[
                        { label: 'Total This Month', value: fmt(totalMonth),    color: '#38bdf8' },
                        { label: 'Bank / Checking',  value: fmt(checkingTotal), color: '#4ade80' },
                        { label: 'Credit Cards',     value: fmt(creditTotal),   color: '#f97316' },
                    ].map(s => (
                        <div key={s.label} style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 14, padding: '16px 18px',
                        }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{s.label}</div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── States ── */}
            {loading && (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
                    Loading accounts…
                </div>
            )}
            {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '16px 20px', color: '#ef4444', fontSize: 13, marginBottom: 20 }}>
                    {error}
                    <button onClick={load} style={{ marginLeft: 12, fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
                </div>
            )}

            {/* ── Empty state ── */}
            {!loading && !error && accounts.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.4)' }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🏦</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>No accounts yet</div>
                    <div style={{ fontSize: 13, marginBottom: 20 }}>Import your first bank export or add a transaction manually to get started.</div>
                    <button onClick={() => navigate('/import')} className="btn sm primary">Go to Bank Import</button>
                </div>
            )}

            {/* ── Account cards ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {accounts.map(acct => {
                    const meta  = getMeta(acct.source);
                    const badge = TYPE_BADGE[meta.type] || TYPE_BADGE.checking;
                    const trend = trendArrow(acct.this_month_cents, acct.last_month_cents);
                    const pct   = totalMonth > 0 ? Math.round((acct.this_month_cents / totalMonth) * 100) : 0;

                    return (
                        <div key={acct.source} style={{
                            width: '100%',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 16,
                            padding: '18px 20px',
                            boxSizing: 'border-box',
                        }}>
                            {/* Card header */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px 16px', marginBottom: 16 }}>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 16, fontWeight: 900, color: 'white', marginBottom: 2 }}>{meta.label}</div>
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{meta.institution}</div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                    {trend && (
                                        <span style={{ fontSize: 11, fontWeight: 800, color: trend.color }}>
                                            {trend.label}
                                        </span>
                                    )}
                                    <span style={{ fontSize: 10, fontWeight: 800, color: badge.color, background: badge.bg, border: `1px solid ${badge.color}30`, borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>
                                        {badge.label}
                                    </span>
                                </div>
                            </div>

                            {/* Stats grid — auto-fit wraps to 2 cols on mobile */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                                gap: 8,
                                marginBottom: 14,
                            }}>
                                {[
                                    { label: 'This Month',   value: fmt(acct.this_month_cents), highlight: true },
                                    { label: 'Last Month',   value: fmt(acct.last_month_cents) },
                                    { label: 'YTD',          value: fmt(acct.ytd_cents) },
                                    { label: 'Transactions', value: acct.total_count.toLocaleString() },
                                ].map(s => (
                                    <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px' }}>
                                        <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{s.label}</div>
                                        <div style={{ fontSize: 15, fontWeight: 900, color: s.highlight ? '#38bdf8' : 'rgba(255,255,255,0.8)' }}>{s.value}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Progress bar + meta */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                <div style={{ flex: '1 1 80px', height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', minWidth: 60 }}>
                                    <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: badge.color, borderRadius: 2, transition: 'width 0.6s ease' }} />
                                </div>
                                <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>{pct}% of month</span>
                                <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>Last: {fmtDate(acct.last_date)}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Connect a Bank CTA ── */}
            {!loading && (
                <div style={{
                    marginTop: 20,
                    background: 'rgba(56,189,248,0.06)',
                    border: '1px solid rgba(56,189,248,0.2)',
                    borderRadius: 16,
                    padding: '18px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                }}>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 900, color: 'white', marginBottom: 3 }}>Live Bank Sync via Plaid</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                            Connect your bank to auto-import transactions — no more CSV exports.
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/import')}
                        className="btn sm primary"
                        style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                        Connect a Bank
                    </button>
                </div>
            )}
        </div>
    );
}
