import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPut } from '../api';

// ─── Source metadata ───────────────────────────────────────────────────────────
const SOURCE_META = {
    manual:        { label: 'Manual Entry',       type: 'manual',   institution: 'Direct Entry',      conn: 'manual' },
    checking:      { label: 'Checking',           type: 'checking', institution: 'Bank Account',       conn: 'csv' },
    plaid:         { label: 'Plaid (Auto-Sync)',  type: 'checking', institution: 'Live Bank Sync',     conn: 'plaid' },
    rocketmoney:   { label: 'Rocket Money',       type: 'checking', institution: 'Rocket Money',       conn: 'csv' },
    chase:         { label: 'Chase Bank',         type: 'checking', institution: 'Chase',              conn: 'csv' },
    usbank:        { label: 'US Bank',            type: 'checking', institution: 'US Bank',            conn: 'csv' },
    bankofamerica: { label: 'Bank of America',    type: 'checking', institution: 'Bank of America',    conn: 'csv' },
    wellsfargo:    { label: 'Wells Fargo',        type: 'checking', institution: 'Wells Fargo',        conn: 'csv' },
    applecard:     { label: 'Apple Card',         type: 'credit',   institution: 'Goldman Sachs',      conn: 'csv' },
    capitalone:    { label: 'Capital One',        type: 'credit',   institution: 'Capital One',        conn: 'csv' },
    usaa:          { label: 'USAA',               type: 'checking', institution: 'USAA',               conn: 'csv' },
    navyfcu:       { label: 'Navy Federal',       type: 'checking', institution: 'Navy Federal CU',    conn: 'csv' },
    wise:          { label: 'Wise',               type: 'checking', institution: 'Wise',               conn: 'csv' },
    delta_amex:    { label: 'Delta Amex',         type: 'credit',   institution: 'American Express',   conn: 'csv' },
    amex_gold:     { label: 'Amex Gold',          type: 'credit',   institution: 'American Express',   conn: 'csv' },
    amex_platinum: { label: 'Amex Platinum',      type: 'credit',   institution: 'American Express',   conn: 'csv' },
    amex_blue:     { label: 'Amex Blue Cash',     type: 'credit',   institution: 'American Express',   conn: 'csv' },
};

// Connection type display config
const CONN_CONFIG = {
    plaid:  { label: 'Live Sync',    color: '#10b981', bg: 'rgba(16,185,129,0.12)', dot: true,  hint: 'Auto-syncs from your bank' },
    csv:    { label: 'CSV Import',   color: '#38bdf8', bg: 'rgba(56,189,248,0.10)', dot: false, hint: 'Imported from bank export file' },
    manual: { label: 'Manual Entry', color: '#a78bfa', bg: 'rgba(167,139,250,0.10)', dot: false, hint: 'Hand-entered transactions' },
};

const TYPE_BADGE = {
    checking: { label: 'Checking / Bank', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
    credit:   { label: 'Credit Card',     color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
    manual:   { label: 'Manual',          color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
};

// Section definitions — order and appearance
const SECTIONS = [
    { key: 'plaid',  title: 'Connected Banks',   subtitle: 'Live sync via Plaid — updates automatically',    color: '#10b981' },
    { key: 'csv',    title: 'Imported Accounts', subtitle: 'Loaded from CSV exports — re-import to refresh', color: '#38bdf8' },
    { key: 'manual', title: 'Manual Entry',      subtitle: 'Transactions entered by hand',                   color: '#a78bfa' },
];

function getMeta(source) {
    const key = (source || '').toLowerCase();
    if (SOURCE_META[key]) return SOURCE_META[key];
    const isCreditish = ['card','amex','credit','visa','mastercard','discover'].some(k => key.includes(k));
    return {
        label:       key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        type:        isCreditish ? 'credit' : 'checking',
        institution: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        conn:        'csv',
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

// ─── Live dot animation ────────────────────────────────────────────────────────
const liveDotStyle = `
@keyframes ll-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.4; transform: scale(0.75); }
}`;

// ─── AccountCard ───────────────────────────────────────────────────────────────
function AccountCard({ acct, totalMonth, onAliasChange }) {
    const meta   = getMeta(acct.source);
    const label  = acct.display_name || meta.label;
    const badge  = TYPE_BADGE[meta.type] || TYPE_BADGE.checking;
    const conn   = CONN_CONFIG[meta.conn] || CONN_CONFIG.csv;
    const trend  = trendArrow(acct.this_month_cents, acct.last_month_cents);
    const pct    = totalMonth > 0 ? Math.round((acct.this_month_cents / totalMonth) * 100) : 0;

    const [editing, setEditing] = useState(false);
    const [editVal, setEditVal] = useState(label);
    const [saving,  setSaving]  = useState(false);

    useEffect(() => { setEditVal(acct.display_name || meta.label); }, [acct.display_name, meta.label]);

    async function saveName() {
        if (!editVal.trim()) return;
        setSaving(true);
        try {
            const trimmed = editVal.trim();
            const val = trimmed === meta.label ? null : trimmed;
            await apiPut('/accounts/alias', { source_key: acct.source, display_name: val });
            onAliasChange(acct.source, { display_name: val });
            setEditing(false);
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    }

    async function toggleVisible() {
        try {
            const next = !acct.visible;
            await apiPut('/accounts/alias', { source_key: acct.source, visible: next });
            onAliasChange(acct.source, { visible: next });
        } catch (e) { console.error(e); }
    }

    function onKeyDown(e) {
        if (e.key === 'Enter')  saveName();
        if (e.key === 'Escape') { setEditing(false); setEditVal(acct.display_name || meta.label); }
    }

    return (
        <div style={{
            width: '100%',
            background: acct.visible ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${acct.visible ? `${conn.color}22` : 'rgba(255,255,255,0.04)'}`,
            borderLeft: `3px solid ${acct.visible ? conn.color : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 16,
            padding: '16px 18px',
            boxSizing: 'border-box',
            opacity: acct.visible ? 1 : 0.5,
        }}>
            {/* Card header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px 12px', marginBottom: 14 }}>

                {/* Left: name + institution + source key */}
                <div style={{ minWidth: 0, flex: '1 1 140px' }}>
                    {editing ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                                autoFocus
                                value={editVal}
                                onChange={e => setEditVal(e.target.value)}
                                onKeyDown={onKeyDown}
                                style={{
                                    fontSize: 15, fontWeight: 800, color: 'white',
                                    background: 'rgba(255,255,255,0.08)',
                                    border: '1px solid rgba(56,189,248,0.5)',
                                    borderRadius: 8, padding: '4px 10px',
                                    outline: 'none', width: '100%', maxWidth: 220,
                                }}
                            />
                            <button onClick={saveName} disabled={saving}
                                style={{ background: '#38bdf8', border: 'none', borderRadius: 6, color: '#0f172a', fontWeight: 900, fontSize: 12, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                {saving ? '…' : 'Save'}
                            </button>
                            <button onClick={() => { setEditing(false); setEditVal(acct.display_name || meta.label); }}
                                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>✕</button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ fontSize: 15, fontWeight: 900, color: 'white' }}>{label}</div>
                            <button onClick={() => { setEditVal(acct.display_name || meta.label); setEditing(true); }}
                                title="Rename account"
                                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: 12, padding: '2px 4px', lineHeight: 1, flexShrink: 0 }}>✏</button>
                        </div>
                    )}
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 700, marginTop: 2 }}>
                        {meta.institution}
                        <span style={{ fontFamily: 'monospace', marginLeft: 6, opacity: 0.6 }}>{acct.source}</span>
                    </div>
                </div>

                {/* Right: connection type + account type + eye */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
                    {trend && (
                        <span style={{ fontSize: 11, fontWeight: 800, color: trend.color }}>{trend.label}</span>
                    )}

                    {/* Connection type — most important badge */}
                    <span title={conn.hint} style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 10, fontWeight: 800, color: conn.color,
                        background: conn.bg,
                        border: `1px solid ${conn.color}30`,
                        borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap',
                    }}>
                        {conn.dot && (
                            <span style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: conn.color, flexShrink: 0,
                                animation: 'll-pulse 2s ease-in-out infinite',
                                display: 'inline-block',
                            }} />
                        )}
                        {conn.label}
                    </span>

                    {/* Account type */}
                    <span style={{ fontSize: 10, fontWeight: 800, color: badge.color, background: badge.bg, border: `1px solid ${badge.color}30`, borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>
                        {badge.label}
                    </span>

                    {/* Visibility toggle */}
                    <button onClick={toggleVisible}
                        title={acct.visible ? 'Hide from Accounts page' : 'Show on Accounts page'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: '2px 4px', lineHeight: 1, opacity: acct.visible ? 0.6 : 0.25, flexShrink: 0 }}>
                        {acct.visible ? '👁' : '🙈'}
                    </button>
                </div>
            </div>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginBottom: 12 }}>
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

            {/* Progress bar + last date */}
            {acct.visible && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 80px', height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', minWidth: 60 }}>
                        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: conn.color, borderRadius: 2, transition: 'width 0.6s ease' }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>{pct}% of month</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
                        {meta.conn === 'plaid' ? 'Last sync:' : 'Last import:'} {fmtDate(acct.last_date)}
                    </span>
                </div>
            )}
        </div>
    );
}

// ─── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ section, count }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '24px 0 10px', padding: '0 2px' }}>
            <div style={{ width: 3, height: 18, background: section.color, borderRadius: 2, flexShrink: 0 }} />
            <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: 'white', letterSpacing: '0.02em' }}>
                    {section.title}
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)' }}>{count}</span>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600, marginTop: 1 }}>{section.subtitle}</div>
            </div>
        </div>
    );
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function Accounts() {
    const navigate = useNavigate();
    const [data,       setData]       = useState(null);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState(null);
    const [showHidden, setShowHidden] = useState(false);

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

    function handleAliasChange(sourceKey, patch) {
        setData(prev => {
            if (!prev) return prev;
            return { ...prev, accounts: prev.accounts.map(a => a.source === sourceKey ? { ...a, ...patch } : a) };
        });
    }

    const allAccounts = [...(data?.accounts || [])].sort((a, b) => {
        if (a.source === 'manual' && b.source !== 'manual') return 1;
        if (b.source === 'manual' && a.source !== 'manual') return -1;
        return b.this_month_cents - a.this_month_cents;
    });

    const visibleAccounts = allAccounts.filter(a => a.visible);
    const hiddenAccounts  = allAccounts.filter(a => !a.visible);

    // Group visible accounts by connection type
    const grouped = {
        plaid:  visibleAccounts.filter(a => getMeta(a.source).conn === 'plaid'),
        csv:    visibleAccounts.filter(a => getMeta(a.source).conn === 'csv'),
        manual: visibleAccounts.filter(a => getMeta(a.source).conn === 'manual'),
    };

    const totalMonth    = data?.total_month_cents || 0;
    const checkingTotal = data?.checking_cents    || 0;
    const creditTotal   = data?.credit_cents      || 0;

    return (
        <div style={{ width: '100%', padding: '0 0 48px' }}>
            {/* Inject keyframe for live dot */}
            <style>{liveDotStyle}</style>

            {/* ── Header ── */}
            <div style={{ marginBottom: 20, padding: '0 4px' }}>
                <h1 style={{ fontSize: 26, fontWeight: 900, color: 'white', margin: 0 }}>Accounts</h1>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: '4px 0 0', fontWeight: 600 }}>
                    Spending by account — rename with ✏, hide clutter with 👁
                </p>
            </div>

            {/* ── Summary bar ── */}
            {data && !loading && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 8 }}>
                    {[
                        { label: 'Total This Month', value: fmt(totalMonth),    color: '#38bdf8' },
                        { label: 'Bank / Checking',  value: fmt(checkingTotal), color: '#4ade80' },
                        { label: 'Credit Cards',     value: fmt(creditTotal),   color: '#f97316' },
                    ].map(s => (
                        <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 18px' }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{s.label}</div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── States ── */}
            {loading && (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Loading accounts…</div>
            )}
            {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '16px 20px', color: '#ef4444', fontSize: 13, marginBottom: 20 }}>
                    {error}
                    <button onClick={load} style={{ marginLeft: 12, fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
                </div>
            )}

            {/* ── Empty state ── */}
            {!loading && !error && allAccounts.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.4)' }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🏦</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>No accounts yet</div>
                    <div style={{ fontSize: 13, marginBottom: 20 }}>Import your first bank export or add a transaction manually.</div>
                    <button onClick={() => navigate('/import')} className="btn sm primary">Go to Bank Import</button>
                </div>
            )}

            {/* ── Grouped visible accounts ── */}
            {!loading && !error && visibleAccounts.length > 0 && (
                <>
                    {SECTIONS.map(section => {
                        const group = grouped[section.key];
                        if (!group.length) return null;
                        return (
                            <div key={section.key}>
                                <SectionHeader section={section} count={group.length} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {group.map(acct => (
                                        <AccountCard
                                            key={acct.source}
                                            acct={acct}
                                            totalMonth={totalMonth}
                                            onAliasChange={handleAliasChange}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </>
            )}

            {/* ── Hidden accounts ── */}
            {hiddenAccounts.length > 0 && (
                <div style={{ marginTop: 24 }}>
                    <button
                        onClick={() => setShowHidden(v => !v)}
                        style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 16px', color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{showHidden ? '▲' : '▼'}</span>
                        {showHidden ? 'Hide' : `Show ${hiddenAccounts.length} hidden account${hiddenAccounts.length === 1 ? '' : 's'}`}
                    </button>
                    {showHidden && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                            {hiddenAccounts.map(acct => (
                                <AccountCard key={acct.source} acct={acct} totalMonth={totalMonth} onAliasChange={handleAliasChange} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Connect a Bank CTA ── */}
            {!loading && grouped.plaid?.length === 0 && (
                <div style={{ marginTop: 24, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 16, padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 900, color: 'white', marginBottom: 3 }}>Live Bank Sync via Plaid</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Connect your bank to auto-import transactions — no more CSV exports.</div>
                    </div>
                    <button onClick={() => navigate('/import')} className="btn sm primary" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>Connect a Bank</button>
                </div>
            )}
        </div>
    );
}
