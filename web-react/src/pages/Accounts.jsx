import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiPut, apiDelete } from '../api';

// ─── Source metadata ───────────────────────────────────────────────────────────
const SOURCE_META = {
    manual:        { label: 'Manual Entry',      institution: 'Direct Entry' },
    checking:      { label: 'Checking',          institution: 'Bank Account' },
    plaid:         { label: 'Live Sync',         institution: 'Plaid' },
    rocketmoney:   { label: 'Rocket Money',      institution: 'Rocket Money' },
    chase:         { label: 'Chase Bank',        institution: 'Chase' },
    usbank:        { label: 'US Bank',           institution: 'US Bank' },
    bankofamerica: { label: 'Bank of America',   institution: 'Bank of America' },
    wellsfargo:    { label: 'Wells Fargo',       institution: 'Wells Fargo' },
    applecard:     { label: 'Apple Card',        institution: 'Goldman Sachs' },
    capitalone:    { label: 'Capital One',       institution: 'Capital One' },
    usaa:          { label: 'USAA',              institution: 'USAA' },
    navyfcu:       { label: 'Navy Federal',      institution: 'Navy Federal CU' },
    wise:          { label: 'Wise',              institution: 'Wise' },
    delta_amex:    { label: 'Delta Amex',        institution: 'American Express' },
    amex_gold:     { label: 'Amex Gold',         institution: 'American Express' },
    amex_platinum: { label: 'Amex Platinum',     institution: 'American Express' },
    amex_blue:     { label: 'Amex Blue Cash',    institution: 'American Express' },
};

function getSourceMeta(source) {
    const key = (source || '').toLowerCase();
    if (SOURCE_META[key]) return SOURCE_META[key];
    return {
        label:       key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        institution: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    };
}

// Connection badge config
const CONN = {
    plaid:  { label: 'Live Sync',     color: '#10b981', bg: 'rgba(16,185,129,0.12)',  dot: true  },
    linked: { label: 'Plaid Linked',  color: '#10b981', bg: 'rgba(16,185,129,0.08)',  dot: false },
    csv:    { label: 'CSV Import',    color: '#38bdf8', bg: 'rgba(56,189,248,0.10)',  dot: false },
    manual: { label: 'Manual Entry',  color: '#a78bfa', bg: 'rgba(167,139,250,0.10)', dot: false },
};

function getConnType(acct) {
    if (acct.source === 'plaid')    return 'plaid';
    if (acct.has_plaid_link)        return 'linked';
    if (acct.source === 'manual')   return 'manual';
    return 'csv';
}

// Account type groups
const TYPE_GROUPS = [
    { key: 'credit',   label: 'Credit Cards',    color: '#f97316', icon: '💳' },
    { key: 'checking', label: 'Checking',         color: '#38bdf8', icon: '🏦' },
    { key: 'savings',  label: 'Savings Accounts', color: '#4ade80', icon: '💰' },
    { key: 'manual',   label: 'Manual Entry',     color: '#a78bfa', icon: '✏️'  },
];

// Sort options
const SORT_OPTIONS = [
    { key: 'spend_month', label: 'Spend this month ↓' },
    { key: 'spend_ytd',   label: 'YTD spend ↓' },
    { key: 'transactions', label: 'Transactions ↓' },
    { key: 'name',        label: 'Name A–Z' },
];

function sortAccounts(list, sortKey) {
    return [...list].sort((a, b) => {
        if (sortKey === 'spend_month')  return b.this_month_cents - a.this_month_cents;
        if (sortKey === 'spend_ytd')    return b.ytd_cents - a.ytd_cents;
        if (sortKey === 'transactions') return b.total_count - a.total_count;
        if (sortKey === 'name') {
            const la = (a.display_name || getSourceMeta(a.source).label).toLowerCase();
            const lb = (b.display_name || getSourceMeta(b.source).label).toLowerCase();
            return la < lb ? -1 : la > lb ? 1 : 0;
        }
        return 0;
    });
}

// Formatting
function fmtMoney(cents) {
    if (cents === null || cents === undefined) return '—';
    return '$' + Math.abs(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtBalance(n) {
    if (n === null || n === undefined) return '—';
    return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d) {
    if (!d) return '—';
    const [yr, mo, dy] = String(d).split('T')[0].split('-');
    const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${M[parseInt(mo,10)-1]} ${parseInt(dy,10)}, ${yr}`;
}
function fmtDateTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
}
function trendArrow(a, b) {
    if (!b || Math.abs(b) < 50) return null;
    const diff = a - b, pct = Math.abs(Math.round((diff / Math.abs(b)) * 100));
    if (Math.abs(diff) < 50) return null;
    return { color: diff > 0 ? '#ef4444' : '#10b981', label: `${diff > 0 ? '↑' : '↓'} ${pct}% vs last month` };
}

// Build account_id → { name, mask } lookup from Plaid balance response
function buildPlaidMap(institutions) {
    const map = {};
    for (const inst of (institutions || [])) {
        for (const a of (inst.accounts || [])) {
            map[a.account_id] = { name: a.name, mask: a.mask };
        }
    }
    return map;
}

const PULSE = `@keyframes ll-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.75)}}`;

// ─── Connection badge ──────────────────────────────────────────────────────────
function ConnBadge({ type }) {
    const c = CONN[type] || CONN.csv;
    return (
        <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, fontWeight:800, color:c.color, background:c.bg, border:`1px solid ${c.color}30`, borderRadius:20, padding:'3px 10px', whiteSpace:'nowrap' }}>
            {c.dot && <span style={{ width:6, height:6, borderRadius:'50%', background:c.color, flexShrink:0, animation:'ll-pulse 2s ease-in-out infinite', display:'inline-block' }} />}
            {c.label}
        </span>
    );
}

// ─── Balance rows (Plaid sub-accounts) ────────────────────────────────────────
const BALANCES_CACHE_KEY     = 'll_plaid_balances_cache';
const BALANCES_LAST_GOOD_KEY = 'll_plaid_balances_last_good';
// Balance calls cost $0.10 each — only refresh once every 10 days or on explicit Sync.
const BALANCES_TTL_MS        = 10 * 24 * 60 * 60 * 1000;

// Map app filterType → Plaid account type/subtype
function matchesFilter(a, filterType) {
    if (filterType === 'all') return true;
    if (filterType === 'credit') return a.type === 'credit';
    if (filterType === 'checking') return a.type === 'depository' && (a.subtype || '').toLowerCase().includes('checking');
    if (filterType === 'savings') return a.type === 'depository' && !(a.subtype || '').toLowerCase().includes('checking');
    return false; // 'manual' — no Plaid sub-accounts are manual
}

function BalanceRows({ source, plaidConnections, filterType = 'all', connectionId = null }) {
    const navigate = useNavigate();
    const [state,      setState]      = useState(() => {
        try {
            const cached = JSON.parse(localStorage.getItem(BALANCES_CACHE_KEY) || 'null');
            if (cached?.institutions?.length) {
                // Seed last-good cache from main cache if last-good is missing (first run after upgrade)
                try {
                    const hasLastGood = localStorage.getItem(BALANCES_LAST_GOOD_KEY);
                    if (!hasLastGood) {
                        const good = cached.institutions.filter(i => i.accounts?.length);
                        if (good.length) localStorage.setItem(BALANCES_LAST_GOOD_KEY, JSON.stringify(good));
                    }
                } catch {}
                return { loading:false, institutions: cached.institutions, error:false, stale:true };
            }
        } catch {}
        return { loading:true, institutions:null, error:false, stale:false };
    });
    const [hiddenIds,  setHiddenIds]  = useState(() => {
        try { return new Set(JSON.parse(localStorage.getItem('ll_hidden_plaid_accts') || '[]')); }
        catch { return new Set(); }
    });
    const [showHidden, setShowHidden] = useState(false);
    const [hoverId,    setHoverId]    = useState(null);

    useEffect(() => {
        let cancelled = false;
        // Skip the $0.10 Plaid balance call if cache is less than 10 days old
        try {
            const cached = JSON.parse(localStorage.getItem(BALANCES_CACHE_KEY) || 'null');
            if (cached?.ts && (Date.now() - cached.ts) < BALANCES_TTL_MS && cached?.institutions?.length) {
                setState({ loading:false, institutions: cached.institutions, error:false, stale:false });
                return;
            }
        } catch {}
        apiGet('/plaid/balances')
            .then(r => {
                if (cancelled) return;
                const fresh = r.institutions || [];

                // Merge: for institutions that returned balance_error, inject last-good accounts
                // so cached sub-account rows stay visible with a warning instead of going blank.
                let lastGood = [];
                try { lastGood = JSON.parse(localStorage.getItem(BALANCES_LAST_GOOD_KEY) || '[]'); } catch {}
                const lastGoodById = {};
                for (const lg of lastGood) lastGoodById[lg.id] = lg;

                // Rate-limit codes are expected (our 10-day TTL) — show last-known silently, no warning banner
                const SILENT_CODES = new Set(['BALANCE_LIMIT', 'RATE_LIMIT_EXCEEDED', 'TOO_MANY_REQUESTS']);

                const merged = fresh.map(inst => {
                    const isRateLimit = SILENT_CODES.has(inst.error_code);
                    if (inst.balance_error && lastGoodById[inst.id]?.accounts?.length) {
                        return {
                            ...inst,
                            accounts: lastGoodById[inst.id].accounts,
                            balance_stale: !isRateLimit,   // stale=false suppresses orange banner
                            balance_rate_limited: isRateLimit,
                        };
                    }
                    // Rate-limited with no last-good data — hide the error, show nothing
                    if (inst.balance_error && isRateLimit) {
                        return { ...inst, balance_rate_limited: true };
                    }
                    return inst;
                });

                // Only update the last-good cache with institutions that actually returned accounts
                const freshGood = fresh.filter(i => !i.balance_error && i.accounts?.length);
                if (freshGood.length) {
                    try { localStorage.setItem(BALANCES_LAST_GOOD_KEY, JSON.stringify(freshGood)); } catch {}
                }

                setState({ loading:false, institutions: merged, error:false, stale:false });
                // Update main cache only if at least one institution has real accounts
                if (merged.some(i => i.accounts?.length)) {
                    try { localStorage.setItem(BALANCES_CACHE_KEY, JSON.stringify({ institutions: merged, ts: Date.now() })); } catch {}
                }
            })
            .catch(() => {
                if (cancelled) return;
                setState(prev => prev.institutions?.length
                    ? { ...prev, loading:false, stale:false }
                    : { loading:false, institutions:[], error:true, stale:false });
            });
        return () => { cancelled = true; };
    }, []);

    const institutionName = plaidConnections?.[0]?.institution_name || 'Connected Bank';
    const lastSynced      = plaidConnections?.[0]?.last_synced_at   || null;

    function toggleHide(e, accountId) {
        e.stopPropagation();
        setHiddenIds(prev => {
            const next = new Set(prev);
            next.has(accountId) ? next.delete(accountId) : next.add(accountId);
            localStorage.setItem('ll_hidden_plaid_accts', JSON.stringify([...next]));
            return next;
        });
    }

    // Scope to this specific connection so each Plaid card only shows its own bank's accounts
    const myInstitutions = connectionId
        ? (state.institutions?.filter(i => i.id === connectionId) || [])
        : (state.institutions || []);
    const allAccts    = myInstitutions.flatMap(i => i.accounts || []);
    const hiddenCount = allAccts.filter(a => hiddenIds.has(a.account_id)).length;
    // When a type filter is active, only show matching sub-accounts (hidden count ignores filter)
    const filterActive = filterType !== 'all';

    function SubRow({ a, faded }) {
        const isCredit = a.type === 'credit';
        const balance  = isCredit ? a.current : (a.available ?? a.current);
        const isHov    = hoverId === a.account_id && !faded;
        // Derive the source key the same way the backend does (makePlaidSourceKey)
        const sub       = (a.subtype || a.type || '').replace(/\b\w/g, c => c.toUpperCase());
        const sourceKey = sub ? `${institutionName} ${sub}` : institutionName;
        return (
            <div key={a.account_id}
                onClick={faded ? undefined : () => navigate(`/transactions?plaid_account_id=${encodeURIComponent(a.account_id)}&plaid_account_name=${encodeURIComponent(a.name)}&source=${encodeURIComponent(sourceKey)}`)}
                onMouseEnter={faded ? undefined : () => setHoverId(a.account_id)}
                onMouseLeave={faded ? undefined : () => setHoverId(null)}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'9px 12px', borderRadius:10, gap:10,
                    background: isHov ? 'rgba(56,189,248,0.07)' : 'rgba(255,255,255,0.03)',
                    border:`1px solid ${isHov ? 'rgba(56,189,248,0.2)' : 'transparent'}`,
                    cursor: faded ? 'default' : 'pointer',
                    opacity: faded ? 0.4 : 1,
                    transition:'background 0.15s, border-color 0.15s' }}>
                <div style={{ minWidth:0, flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:800, color: isHov ? '#38bdf8' : 'white', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', transition:'color 0.15s' }}>
                        {a.name}
                        {a.mask && <span style={{ fontSize:10, fontWeight:600, color:'rgba(255,255,255,0.3)', marginLeft:6 }}>···{a.mask}</span>}
                    </div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', fontWeight:600, marginTop:1, textTransform:'capitalize' }}>
                        {a.subtype?.replace(/_/g,' ')} · {isCredit ? 'Balance owed' : 'Available'}{faded ? ' · Hidden' : ''}
                    </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                    <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:16, fontWeight:900, color: isCredit ? '#f97316' : '#10b981' }}>{fmtBalance(balance)}</div>
                        {!isCredit && a.current !== null && a.available !== null && a.current !== a.available && (
                            <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', fontWeight:600 }}>Ledger {fmtBalance(a.current)}</div>
                        )}
                    </div>
                    {isHov && <span style={{ fontSize:11, color:'rgba(56,189,248,0.6)', fontWeight:700, whiteSpace:'nowrap' }}>View →</span>}
                    <button onClick={e => toggleHide(e, a.account_id)}
                        title={faded ? 'Show this account' : 'Hide this account'}
                        style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, padding:'2px 4px', opacity: faded ? 0.5 : 0.35, flexShrink:0, lineHeight:1 }}>
                        {faded ? '🙈' : '👁'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                    Live Balances · {institutionName}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    {state.stale && <div style={{ fontSize:10, color:'rgba(255,255,255,0.22)', fontStyle:'italic', fontWeight:600 }}>Refreshing…</div>}
                    {lastSynced && !state.stale && (
                        <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', fontWeight:600 }}>Synced {fmtDateTime(lastSynced)}</div>
                    )}
                </div>
            </div>

            {state.loading && <div style={{ fontSize:12, color:'rgba(255,255,255,0.3)', padding:'6px 0' }}>Loading balances…</div>}
            {state.error   && <div style={{ fontSize:12, color:'#ef4444', padding:'6px 0' }}>Could not reach bank — try refreshing</div>}

            {!state.loading && !state.error && (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {myInstitutions.map(inst => {
                        // Rate-limited = our cost-control (10-day TTL). Never show error to user.
                        if (inst.balance_error && !inst.balance_stale && !inst.balance_rate_limited) {
                            // No cached fallback and not a rate limit — show why
                            const msg = inst.needs_reauth
                                ? 'Bank connection needs re-authentication — click Unsync, reconnect your bank.'
                                : `Balance unavailable for ${inst.institution_name}. Sync again to retry.`;
                            return (
                                <div key={inst.id} style={{ fontSize:11, color:'#f97316', background:'rgba(249,115,22,0.07)', border:'1px solid rgba(249,115,22,0.2)', borderRadius:8, padding:'7px 11px', fontWeight:700 }}>
                                    {msg}
                                </div>
                            );
                        }
                        // Rate-limited with no cached data — show nothing
                        if (inst.balance_rate_limited && !inst.accounts?.length) return null;

                        const visible = (inst.accounts || []).filter(a => !hiddenIds.has(a.account_id) && matchesFilter(a, filterType));
                        return (
                            <React.Fragment key={inst.id}>
                                {inst.balance_stale && !inst.balance_rate_limited && (
                                    <div style={{ fontSize:10, color:'#f97316', background:'rgba(249,115,22,0.07)', border:'1px solid rgba(249,115,22,0.15)', borderRadius:7, padding:'5px 10px', fontWeight:700, marginBottom:2 }}>
                                        Live balance unavailable — showing last known
                                        {inst.needs_reauth && <span style={{ marginLeft:6 }}>· Bank re-authentication required</span>}
                                    </div>
                                )}
                                {visible.map(a => <SubRow key={a.account_id} a={a} faded={false} />)}
                            </React.Fragment>
                        );
                    })}

                    {/* Filter active but no matching sub-accounts */}
                    {filterActive && myInstitutions.length > 0 && allAccts.filter(a => !hiddenIds.has(a.account_id) && matchesFilter(a, filterType)).length === 0 && (
                        <div style={{ fontSize:11, color:'rgba(255,255,255,0.25)', fontStyle:'italic', padding:'4px 2px' }}>
                            No {filterType} sub-accounts in this connection
                        </div>
                    )}

                    {/* Hidden sub-accounts toggle — show unfiltered hidden count */}
                    {hiddenCount > 0 && (
                        <div style={{ marginTop:2 }}>
                            <button onClick={() => setShowHidden(v => !v)}
                                style={{ background:'none', border:'none', cursor:'pointer', fontSize:11, color:'rgba(255,255,255,0.28)', fontWeight:700, padding:'3px 0', display:'flex', alignItems:'center', gap:4 }}>
                                <span>{showHidden ? '▲' : '▼'}</span>
                                {showHidden ? 'Hide' : `Show ${hiddenCount} hidden sub-account${hiddenCount === 1 ? '' : 's'}`}
                            </button>
                            {showHidden && myInstitutions.map(inst =>
                                inst.accounts?.filter(a => hiddenIds.has(a.account_id)).map(a => <SubRow key={a.account_id} a={a} faded={true} />)
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Account card ──────────────────────────────────────────────────────────────
function AccountCard({ acct, totalMonth, plaidConnections, connectionId = null, onAliasChange, onSync, syncing, onDisconnect, filterType = 'all', mergedFrom = [], allMergeTargets = [], plaidSubAccountMap = {} }) {
    const navigate  = useNavigate();
    const meta      = getSourceMeta(acct.source);
    const connType  = getConnType(acct);
    const isPlaid   = connType === 'plaid';
    const isLinked  = connType === 'linked';
    const connColor = (CONN[connType] || CONN.csv).color;
    const trend     = trendArrow(acct.this_month_cents, acct.last_month_cents);
    const pct       = totalMonth > 0 ? Math.round((acct.this_month_cents / totalMonth) * 100) : 0;

    // Display label: Plaid cards use institution name from plaid_connections
    const institutionName = isPlaid && plaidConnections?.[0]?.institution_name;
    const defaultLabel    = institutionName || acct.display_name || meta.label;

    const [editing,        setEditing]        = useState(false);
    const [editVal,        setEditVal]        = useState(defaultLabel);
    const [saving,         setSaving]         = useState(false);
    const [confirmDisc,    setConfirmDisc]    = useState(false);
    const [disconnecting,  setDisconnecting]  = useState(false);
    const [confirmUnlink,  setConfirmUnlink]  = useState(false);
    const [unlinking,      setUnlinking]      = useState(false);
    const [mergeSaving,    setMergeSaving]    = useState(false);
    const [showMerge,      setShowMerge]      = useState(false);

    useEffect(() => { setEditVal(acct.display_name || defaultLabel); }, [acct.display_name, defaultLabel]);

    async function saveName() {
        if (!editVal.trim()) return;
        setSaving(true);
        try {
            const val = editVal.trim() === defaultLabel ? null : editVal.trim();
            await apiPut('/accounts/alias', { source_key: acct.source, display_name: val });
            onAliasChange(acct.source, { display_name: val });
            setEditing(false);
        } catch(e){ console.error(e); } finally { setSaving(false); }
    }

    async function toggleVisible() {
        try {
            await apiPut('/accounts/alias', { source_key: acct.source, visible: !acct.visible });
            onAliasChange(acct.source, { visible: !acct.visible });
        } catch(e){ console.error(e); }
    }

    async function handleDisconnect() {
        if (!plaidConnections?.[0]?.id) return;
        setDisconnecting(true);
        try {
            await apiDelete(`/plaid/accounts/${plaidConnections[0].id}`);
            onDisconnect?.();
        } catch(e){ console.error(e); } finally { setDisconnecting(false); setConfirmDisc(false); }
    }

    async function handleUnlink() {
        setUnlinking(true);
        try {
            await apiDelete(`/plaid/link/${acct.source}`);
            onAliasChange(acct.source, { has_plaid_link: false });
        } catch(e){ console.error(e); } finally { setUnlinking(false); setConfirmUnlink(false); }
    }

    async function handleMerge(targetSource) {
        if (!targetSource) return;
        setMergeSaving(true);
        try {
            await apiPut('/accounts/alias', { source_key: acct.source, linked_source: targetSource, visible: false });
            onAliasChange(acct.source, { linked_source: targetSource, visible: false });
            setShowMerge(false);
        } catch(e){ console.error(e); } finally { setMergeSaving(false); }
    }

    async function handleUnmerge() {
        setMergeSaving(true);
        try {
            await apiPut('/accounts/alias', { source_key: acct.source, linked_source: null, visible: true });
            onAliasChange(acct.source, { linked_source: null, visible: true });
        } catch(e){ console.error(e); } finally { setMergeSaving(false); }
    }

    const displayLabel = acct.display_name || defaultLabel;
    // Plaid Live Sync cards: navigate to ?institution=USAA (prefix filter) — covers all sub-accounts
    // CSV accounts: navigate to ?source=USAA+Checking (exact match)
    const txSource      = isPlaid ? null : acct.source;
    const txInstitution = isPlaid ? institutionName : null;

    return (
        <div style={{
            width:'100%', boxSizing:'border-box',
            background: isPlaid ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.04)',
            border:`1px solid ${acct.visible ? (isPlaid ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)') : 'rgba(255,255,255,0.04)'}`,
            borderLeft:`3px solid ${acct.visible ? connColor : 'rgba(255,255,255,0.1)'}`,
            borderRadius:16, padding:'16px 18px',
            opacity: acct.visible ? 1 : 0.5,
        }}>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'8px 12px', marginBottom:14 }}>
                <div style={{ minWidth:0, flex:'1 1 140px' }}>
                    {editing ? (
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <input autoFocus value={editVal} onChange={e=>setEditVal(e.target.value)}
                                onKeyDown={e=>{ if(e.key==='Enter') saveName(); if(e.key==='Escape'){ setEditing(false); setEditVal(acct.display_name||defaultLabel); } }}
                                style={{ fontSize:15, fontWeight:800, color:'white', background:'rgba(255,255,255,0.08)', border:`1px solid ${connColor}80`, borderRadius:8, padding:'4px 10px', outline:'none', width:'100%', maxWidth:220 }} />
                            <button onClick={saveName} disabled={saving}
                                style={{ background:connColor, border:'none', borderRadius:6, color:'#0f172a', fontWeight:900, fontSize:12, padding:'4px 10px', cursor:'pointer' }}>
                                {saving?'…':'Save'}
                            </button>
                            <button onClick={()=>{ setEditing(false); setEditVal(acct.display_name||defaultLabel); }}
                                style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', fontSize:18, cursor:'pointer', padding:'2px 4px' }}>✕</button>
                        </div>
                    ) : (
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ fontSize:15, fontWeight:900, color:'white' }}>{displayLabel}</div>
                            <button onClick={()=>{ setEditVal(acct.display_name||defaultLabel); setEditing(true); }}
                                style={{ background:'none', border:'none', color:'rgba(255,255,255,0.2)', cursor:'pointer', fontSize:12, padding:'2px 4px' }}>✏</button>
                        </div>
                    )}
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', fontWeight:700, marginTop:2 }}>
                        {isPlaid ? (plaidConnections?.[0]?.institution_name || 'Plaid') : meta.institution}
                        <span style={{ fontFamily:'monospace', marginLeft:6, opacity:0.5 }}>{acct.source}</span>
                    </div>
                </div>

                {/* Badges + controls */}
                <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', flexShrink:0 }}>
                    {trend && <span style={{ fontSize:11, fontWeight:800, color:trend.color }}>{trend.label}</span>}

                    {/* Plaid Linked badge — with no-cost tooltip + linked sub-account mask */}
                    {isLinked ? (() => {
                        const sub = acct.linked_plaid_account_id ? plaidSubAccountMap[acct.linked_plaid_account_id] : null;
                        return (
                            <span title="CSV transactions matched to Plaid data. No extra billing — only the Live Sync bank connection has a fee."
                                style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, fontWeight:800, color:'#10b981', background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:20, padding:'3px 10px', whiteSpace:'nowrap', cursor:'help' }}>
                                Plaid Linked
                                {sub && (
                                    <span style={{ opacity:0.65, fontFamily:'monospace', marginLeft:1 }}>
                                        → {sub.mask ? `···${sub.mask}` : sub.name}
                                    </span>
                                )}
                            </span>
                        );
                    })() : (
                        <ConnBadge type={connType} />
                    )}

                    {(isPlaid || isLinked) && (
                        <button onClick={onSync} disabled={syncing}
                            title="Sync new transactions from bank"
                            style={{ background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:20, color:'#10b981', fontSize:10, fontWeight:800, padding:'3px 10px', cursor:'pointer', whiteSpace:'nowrap' }}>
                            {syncing ? '…' : '🔄 Sync'}
                        </button>
                    )}

                    {/* Unsync — only on Plaid Live Sync card (removes bank connection, stops billing) */}
                    {isPlaid && plaidConnections?.[0]?.id && !confirmDisc && (
                        <button onClick={()=>setConfirmDisc(true)}
                            title="Disconnect entire Plaid bank connection"
                            style={{ background:'none', border:'1px solid rgba(239,68,68,0.25)', borderRadius:20, color:'rgba(239,68,68,0.6)', fontSize:10, fontWeight:800, padding:'3px 10px', cursor:'pointer', whiteSpace:'nowrap' }}>
                            Unsync
                        </button>
                    )}
                    {isPlaid && confirmDisc && (
                        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                            <span style={{ fontSize:10, color:'#ef4444', fontWeight:700 }}>Confirm?</span>
                            <button onClick={handleDisconnect} disabled={disconnecting}
                                style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.4)', borderRadius:20, color:'#ef4444', fontSize:10, fontWeight:900, padding:'3px 10px', cursor:'pointer' }}>
                                {disconnecting ? '…' : 'Yes, disconnect'}
                            </button>
                            <button onClick={()=>setConfirmDisc(false)}
                                style={{ background:'none', border:'none', color:'rgba(255,255,255,0.3)', fontSize:14, cursor:'pointer', padding:'2px 4px' }}>✕</button>
                        </div>
                    )}

                    {/* Unlink — only on Plaid Linked CSV cards (removes cross-match, no billing impact) */}
                    {isLinked && !confirmUnlink && (
                        <button onClick={()=>setConfirmUnlink(true)}
                            title="Break Plaid match on this CSV account — no billing impact"
                            style={{ background:'none', border:'1px solid rgba(255,255,255,0.12)', borderRadius:20, color:'rgba(255,255,255,0.35)', fontSize:10, fontWeight:800, padding:'3px 10px', cursor:'pointer', whiteSpace:'nowrap' }}>
                            Unlink
                        </button>
                    )}
                    {isLinked && confirmUnlink && (
                        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                            <span style={{ fontSize:10, color:'rgba(255,255,255,0.6)', fontWeight:700 }}>Remove Plaid match?</span>
                            <button onClick={handleUnlink} disabled={unlinking}
                                style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:20, color:'white', fontSize:10, fontWeight:900, padding:'3px 10px', cursor:'pointer' }}>
                                {unlinking ? '…' : 'Yes, unlink'}
                            </button>
                            <button onClick={()=>setConfirmUnlink(false)}
                                style={{ background:'none', border:'none', color:'rgba(255,255,255,0.3)', fontSize:14, cursor:'pointer', padding:'2px 4px' }}>✕</button>
                        </div>
                    )}

                    {/* Merge — CSV accounts only, not Plaid, not already merged */}
                    {!isPlaid && !isLinked && acct.account_type !== 'manual' && !acct.linked_source && allMergeTargets.length > 0 && (
                        showMerge ? (
                            <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                                <select autoFocus defaultValue=""
                                    onChange={e => handleMerge(e.target.value)}
                                    disabled={mergeSaving}
                                    style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'white', fontSize:11, fontWeight:700, padding:'4px 8px', cursor:'pointer', outline:'none' }}>
                                    <option value="" disabled>Merge into…</option>
                                    {allMergeTargets.filter(t => t.source !== acct.source).map(t => (
                                        <option key={t.source} value={t.source}>{t.display_name || getSourceMeta(t.source).label}</option>
                                    ))}
                                </select>
                                <button onClick={()=>setShowMerge(false)}
                                    style={{ background:'none', border:'none', color:'rgba(255,255,255,0.3)', fontSize:14, cursor:'pointer', padding:'2px 4px' }}>✕</button>
                            </div>
                        ) : (
                            <button onClick={()=>setShowMerge(true)}
                                title="Merge this account into another (hides it, keeps transactions)"
                                style={{ background:'none', border:'1px solid rgba(255,255,255,0.12)', borderRadius:20, color:'rgba(255,255,255,0.35)', fontSize:10, fontWeight:800, padding:'3px 10px', cursor:'pointer', whiteSpace:'nowrap' }}>
                                Merge
                            </button>
                        )
                    )}

                    {/* Merged-into badge — show when this account is absorbed into another */}
                    {acct.linked_source && (
                        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                            <span style={{ fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.4)', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:20, padding:'3px 10px', whiteSpace:'nowrap' }}>
                                Merged → {allMergeTargets.find(t=>t.source===acct.linked_source)?.display_name || getSourceMeta(acct.linked_source).label}
                            </span>
                            <button onClick={handleUnmerge} disabled={mergeSaving}
                                title="Remove merge — restore as standalone account"
                                style={{ background:'none', border:'1px solid rgba(255,255,255,0.12)', borderRadius:20, color:'rgba(255,255,255,0.35)', fontSize:10, fontWeight:800, padding:'3px 10px', cursor:'pointer', whiteSpace:'nowrap' }}>
                                {mergeSaving ? '…' : 'Unmerge'}
                            </button>
                        </div>
                    )}

                    <button onClick={toggleVisible} title={acct.visible?'Hide':'Show'}
                        style={{ background:'none', border:'none', cursor:'pointer', fontSize:15, padding:'2px 4px', opacity:acct.visible?0.6:0.25 }}>
                        {acct.visible?'👁':'🙈'}
                    </button>
                </div>
            </div>

            {/* Merged-from badge — accounts that have been absorbed into this one */}
            {mergedFrom.length > 0 && (
                <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                    <span style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.3)' }}>Includes:</span>
                    {mergedFrom.map(m => (
                        <span key={m.source} style={{ fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.45)', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:20, padding:'2px 9px' }}>
                            {m.display_name || getSourceMeta(m.source).label}
                        </span>
                    ))}
                </div>
            )}

            {/* Plaid live balances */}
            {isPlaid && <BalanceRows source={acct.source} plaidConnections={plaidConnections} filterType={filterType} connectionId={connectionId} />}

            {/* Stats */}
            <div style={{ borderTop: isPlaid ? '1px solid rgba(255,255,255,0.06)' : 'none', paddingTop: isPlaid ? 12 : 0 }}>
                {isPlaid && <div style={{ fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Spending (via Plaid)</div>}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(110px, 1fr))', gap:8, marginBottom:10 }}>
                    {[
                        { label:'This Month',   value:fmtMoney(acct.this_month_cents), hi:true,  link:false },
                        { label:'Last Month',   value:fmtMoney(acct.last_month_cents), hi:false, link:false },
                        { label:'YTD',          value:fmtMoney(acct.ytd_cents),        hi:false, link:false },
                        { label:'Transactions', value:acct.total_count.toLocaleString(), hi:false, link:!!(txSource || txInstitution) },
                    ].map(s => (
                        <div key={s.label}
                            onClick={s.link ? () => {
                                if (txInstitution) navigate(`/transactions?institution=${encodeURIComponent(txInstitution)}`);
                                else navigate(`/transactions?source=${encodeURIComponent(txSource)}`);
                            } : undefined}
                            style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'10px 12px', textAlign:'center', cursor: s.link ? 'pointer' : 'default' }}
                            title={s.link ? `View ${displayLabel} transactions` : undefined}>
                            <div style={{ fontSize:9, fontWeight:800, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>{s.label}</div>
                            <div style={{ fontSize:15, fontWeight:900, color: s.hi ? connColor : s.link ? '#38bdf8' : 'rgba(255,255,255,0.8)', textDecoration: s.link ? 'underline' : 'none', textDecorationColor: 'rgba(56,189,248,0.4)' }}>{s.value}</div>
                        </div>
                    ))}
                </div>
                {acct.visible && (
                    <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                        <div style={{ flex:'1 1 80px', height:4, background:'rgba(255,255,255,0.08)', borderRadius:2, overflow:'hidden', minWidth:60 }}>
                            <div style={{ width:`${Math.min(pct,100)}%`, height:'100%', background:connColor, borderRadius:2, transition:'width 0.6s ease' }} />
                        </div>
                        <span style={{ fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.35)', whiteSpace:'nowrap' }}>{pct}% of month</span>
                        {!isPlaid && <span style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.3)', whiteSpace:'nowrap' }}>Last: {fmtDate(acct.last_date)}</span>}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Type group header ─────────────────────────────────────────────────────────
function GroupHeader({ group, count }) {
    return (
        <div style={{ display:'flex', alignItems:'center', gap:10, margin:'24px 0 10px', padding:'0 2px' }}>
            <div style={{ width:3, height:18, background:group.color, borderRadius:2, flexShrink:0 }} />
            <div style={{ fontSize:13, fontWeight:900, color:'white' }}>
                {group.icon} {group.label}
                <span style={{ marginLeft:8, fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.3)' }}>{count}</span>
            </div>
        </div>
    );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
const ACCTS_CACHE_KEY = 'll_accounts_cache';

export default function Accounts() {
    const navigate = useNavigate();
    const [data,       setData]       = useState(() => {
        try {
            const cached = JSON.parse(localStorage.getItem(ACCTS_CACHE_KEY) || 'null');
            return cached?.data || null;
        } catch { return null; }
    });
    const [loading,    setLoading]    = useState(!(() => {
        try { return !!JSON.parse(localStorage.getItem(ACCTS_CACHE_KEY) || 'null')?.data; } catch { return false; }
    })());
    const [refreshing, setRefreshing] = useState(false);
    const [error,      setError]      = useState(null);
    const [showHidden, setShowHidden] = useState(false);
    const [showMerged, setShowMerged] = useState(false);
    const [sortKey,    setSortKey]    = useState('spend_month');
    const [filterType, setFilterType] = useState('all'); // all | credit | checking | manual
    const [syncing,    setSyncing]    = useState(false);
    const [syncMsg,    setSyncMsg]    = useState(null);
    const [plaidSubAccountMap, setPlaidSubAccountMap] = useState(() => {
        try {
            const cached = JSON.parse(localStorage.getItem(BALANCES_CACHE_KEY) || 'null');
            return buildPlaidMap(cached?.institutions || []);
        } catch { return {}; }
    });

    // Populate sub-account map for "Plaid Linked" badges — use cache if less than 10 days old
    useEffect(() => {
        try {
            const cached = JSON.parse(localStorage.getItem(BALANCES_CACHE_KEY) || 'null');
            if (cached?.ts && (Date.now() - cached.ts) < BALANCES_TTL_MS && cached?.institutions?.length) {
                setPlaidSubAccountMap(buildPlaidMap(cached.institutions));
                return;
            }
        } catch {}
        apiGet('/plaid/balances')
            .then(r => setPlaidSubAccountMap(buildPlaidMap(r.institutions || [])))
            .catch(() => {});
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const load = useCallback(async (silent = false) => {
        if (!silent) { setLoading(true); setError(null); }
        else setRefreshing(true);
        try {
            const fresh = await apiGet('/accounts/summary');
            setData(fresh);
            try { localStorage.setItem(ACCTS_CACHE_KEY, JSON.stringify({ data: fresh, ts: Date.now() })); } catch {}
        }
        catch(e) { if (!silent) setError(e.message); }
        finally { setLoading(false); setRefreshing(false); }
    }, []);

    useEffect(() => {
        // Cache already seeded state on mount — always background-refresh
        const hasCached = !!data;
        load(hasCached);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function handleAliasChange(sourceKey, patch) {
        setData(prev => prev ? { ...prev, accounts: prev.accounts.map(a => a.source === sourceKey ? { ...a, ...patch } : a) } : prev);
    }

    async function handleSync() {
        setSyncing(true); setSyncMsg(null);
        try {
            const r = await apiPost('/plaid/sync');
            const note = r.linked > 0 ? ` ${r.linked} matched to existing.` : '';
            setSyncMsg({ ok:true, text:`✅ ${r.added} new, ${r.modified} updated, ${r.removed} removed.${note}` });
            // Balance cache intentionally NOT cleared here — transaction sync ≠ balance refresh.
            // Backend enforces a 10-day TTL on balance calls (each costs money).
            await load(true); // silent refresh — don't flash loading state
        } catch(e) {
            setSyncMsg({ ok:false, text:`❌ Sync failed: ${e.message}` });
        } finally { setSyncing(false); }
    }

    const allAccounts = data?.accounts || [];
    const plaidConns  = data?.plaid_connections || [];

    // Build merge maps
    // mergedInto[targetSource] = [accounts that have been merged into target]
    const mergedInto = {};
    for (const a of allAccounts) {
        if (a.linked_source) {
            if (!mergedInto[a.linked_source]) mergedInto[a.linked_source] = [];
            mergedInto[a.linked_source].push(a);
        }
    }
    // All mergeable targets = non-plaid, non-manual accounts that are not themselves merged
    const allMergeTargets = allAccounts.filter(a => a.source !== 'plaid' && a.account_type !== 'manual' && !a.linked_source);

    // All visible accounts sorted — Live Sync section ignores filterType
    // Merged accounts (linked_source set) are excluded from the main sorted list
    const allVisible = sortAccounts(allAccounts.filter(a => a.visible && !a.linked_source), sortKey);

    // Hidden: accounts explicitly hidden (not counting merged-away accounts)
    const hiddenAccounts = sortAccounts(allAccounts.filter(a => !a.visible && !a.linked_source), sortKey);

    // Merged accounts (for a collapsed section)
    const mergedAccounts = sortAccounts(allAccounts.filter(a => !!a.linked_source), sortKey);

    // Always exclude source='plaid' rows from type groups; owned CSV sources are added below.
    const syncedKeys = new Set(['plaid']);

    // One card per plaid connection — built directly from plaidConns, not from allAccounts.
    // Owned CSV source rows (e.g. "American Express Credit Card ···1001", "USAA Checking") are
    // suppressed from the type-grouped sections so they only appear once, inside the Live Sync card.
    const syncedAccounts = plaidConns.map(conn => {
        const instLower = conn.institution_name.toLowerCase();
        const ownedRows = allAccounts.filter(a =>
            a.source !== 'plaid' &&
            (a.source || '').toLowerCase().startsWith(instLower)
        );
        // Hide owned sources from Credit Cards / Checking sections — Live Sync card is the single view
        ownedRows.forEach(a => syncedKeys.add(a.source));
        return {
            source:                  'plaid',
            _conn_id:                conn.id,
            account_type:            'checking',
            this_month_cents:        ownedRows.reduce((s, a) => s + a.this_month_cents, 0),
            last_month_cents:        ownedRows.reduce((s, a) => s + a.last_month_cents, 0),
            ytd_cents:               ownedRows.reduce((s, a) => s + a.ytd_cents, 0),
            total_count:             ownedRows.reduce((s, a) => s + a.total_count, 0),
            last_date:               conn.last_synced_at?.split('T')[0] || null,
            has_plaid_link:          false,
            visible:                 true,
            display_name:            null,
            linked_source:           null,
            linked_plaid_account_id: null,
        };
    });

    // Type groups: apply filterType only here, exclude synced sources
    const filteredVisible = filterType === 'all'
        ? allVisible
        : allVisible.filter(a => a.account_type === filterType);

    const grouped = {};
    for (const g of TYPE_GROUPS) {
        grouped[g.key] = filteredVisible
            .filter(a => a.account_type === g.key && !syncedKeys.has(a.source));
    }

    const totalMonth    = data?.total_month_cents || 0;
    const checkingTotal = data?.checking_cents    || 0;
    const creditTotal   = data?.credit_cents      || 0;

    return (
        <div style={{ width:'100%', padding:'0 0 48px' }}>
            <style>{PULSE}</style>

            {/* Header */}
            <div style={{ marginBottom:16, padding:'0 4px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <h1 style={{ fontSize:26, fontWeight:900, color:'white', margin:0 }}>Accounts</h1>
                    {refreshing && <span style={{ fontSize:11, color:'rgba(255,255,255,0.25)', fontStyle:'italic', fontWeight:600 }}>Refreshing…</span>}
                </div>
                <p style={{ color:'rgba(255,255,255,0.45)', fontSize:13, margin:'4px 0 0', fontWeight:600 }}>
                    Rename with ✏ · Hide accounts or sub-accounts with 👁 · Sync Plaid with 🔄 · Click any sub-account to view transactions
                </p>
            </div>

            {/* Summary tiles */}
            {data && !loading && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:10, marginBottom:16 }}>
                    {[
                        { label:'Total This Month', value:fmtMoney(totalMonth),    color:'#38bdf8' },
                        { label:'Bank / Checking',  value:fmtMoney(checkingTotal), color:'#4ade80' },
                        { label:'Credit Cards',     value:fmtMoney(creditTotal),   color:'#f97316' },
                    ].map(s => (
                        <div key={s.label} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'14px 18px' }}>
                            <div style={{ fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>{s.label}</div>
                            <div style={{ fontSize:22, fontWeight:900, color:s.color }}>{s.value}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Sort + Filter controls */}
            {!loading && allAccounts.length > 0 && (
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:16 }}>
                    {/* Filter pills */}
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        {[{k:'all',l:'All'},{k:'credit',l:'💳 Credit'},{k:'checking',l:'🏦 Checking'},{k:'savings',l:'💰 Savings'},{k:'manual',l:'✏️ Manual'}].map(f => (
                            <button key={f.k} onClick={()=>setFilterType(f.k)}
                                style={{ background: filterType===f.k ? 'rgba(255,255,255,0.12)' : 'none', border:'1px solid rgba(255,255,255,0.12)', borderRadius:20, color: filterType===f.k ? 'white' : 'rgba(255,255,255,0.45)', fontSize:11, fontWeight:800, padding:'5px 14px', cursor:'pointer', whiteSpace:'nowrap' }}>
                                {f.l}
                            </button>
                        ))}
                    </div>

                    {/* Sort dropdown */}
                    <select value={sortKey} onChange={e=>setSortKey(e.target.value)}
                        style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:20, color:'rgba(255,255,255,0.7)', fontSize:11, fontWeight:800, padding:'5px 14px', cursor:'pointer', outline:'none', marginLeft:'auto' }}>
                        {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                </div>
            )}

            {/* Sync status */}
            {syncMsg && (
                <div style={{ background: syncMsg.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border:`1px solid ${syncMsg.ok?'rgba(16,185,129,0.3)':'rgba(239,68,68,0.25)'}`, borderRadius:10, padding:'10px 16px', fontSize:13, color: syncMsg.ok ? '#10b981':'#ef4444', marginBottom:12 }}>
                    {syncMsg.text}
                    <button onClick={()=>setSyncMsg(null)} style={{ marginLeft:10, background:'none', border:'none', cursor:'pointer', color:'inherit', opacity:0.6, fontSize:14 }}>✕</button>
                </div>
            )}

            {loading && <div style={{ textAlign:'center', padding:'60px 0', color:'rgba(255,255,255,0.4)', fontSize:14 }}>Loading accounts…</div>}
            {error && (
                <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:12, padding:'16px 20px', color:'#ef4444', fontSize:13, marginBottom:20 }}>
                    {error} <button onClick={load} style={{ marginLeft:12, fontSize:12, color:'#ef4444', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>Retry</button>
                </div>
            )}

            {/* Synced accounts — always at the top */}
            {!loading && !error && syncedAccounts.length > 0 && (
                <div>
                    <div style={{ display:'flex', alignItems:'center', gap:10, margin:'0 0 10px', padding:'0 2px' }}>
                        <div style={{ width:3, height:18, background:'#10b981', borderRadius:2, flexShrink:0 }} />
                        <div style={{ fontSize:13, fontWeight:900, color:'white' }}>
                            🔗 Live Sync
                            <span style={{ marginLeft:8, fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.3)' }}>{syncedAccounts.length}</span>
                        </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:8 }}>
                        {syncedAccounts.map(acct => (
                            <AccountCard
                                key={acct._conn_id}
                                acct={acct}
                                totalMonth={totalMonth}
                                plaidConnections={plaidConns.filter(c => c.id === acct._conn_id)}
                                connectionId={acct._conn_id}
                                onAliasChange={handleAliasChange}
                                onSync={handleSync}
                                syncing={syncing}
                                onDisconnect={() => load(false)}
                                filterType={filterType}
                                mergedFrom={mergedInto[acct.source] || []}
                                allMergeTargets={allMergeTargets}
                                plaidSubAccountMap={plaidSubAccountMap}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Type-grouped account cards (non-synced) */}
            {!loading && !error && TYPE_GROUPS.map(group => {
                const list = grouped[group.key];
                if (!list?.length) return null;
                return (
                    <div key={group.key}>
                        <GroupHeader group={group} count={list.length} />
                        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                            {list.map(acct => (
                                <AccountCard
                                    key={acct.source}
                                    acct={acct}
                                    totalMonth={totalMonth}
                                    plaidConnections={null}
                                    onAliasChange={handleAliasChange}
                                    onSync={handleSync}
                                    syncing={syncing}
                                    onDisconnect={() => load(false)}
                                    mergedFrom={mergedInto[acct.source] || []}
                                    allMergeTargets={allMergeTargets}
                                    plaidSubAccountMap={plaidSubAccountMap}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}

            {/* Merged accounts — collapsed, shows accounts absorbed into other cards */}
            {mergedAccounts.length > 0 && (
                <div style={{ marginTop:16 }}>
                    <button onClick={()=>setShowMerged(v=>!v)}
                        style={{ background:'none', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'7px 14px', color:'rgba(255,255,255,0.3)', fontSize:11, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                        <span>{showMerged?'▲':'▼'}</span>
                        {showMerged ? 'Hide merged' : `${mergedAccounts.length} merged account${mergedAccounts.length===1?'':'s'} (absorbed into another)`}
                    </button>
                    {showMerged && (
                        <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:10 }}>
                            {mergedAccounts.map(acct => (
                                <AccountCard key={acct.source} acct={acct} totalMonth={totalMonth} plaidConnections={null} onAliasChange={handleAliasChange} onSync={handleSync} syncing={syncing} onDisconnect={() => load(false)} mergedFrom={[]} allMergeTargets={allMergeTargets} plaidSubAccountMap={plaidSubAccountMap} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Hidden accounts */}
            {hiddenAccounts.length > 0 && (
                <div style={{ marginTop:hiddenAccounts.length>0&&mergedAccounts.length>0?8:24 }}>
                    <button onClick={()=>setShowHidden(v=>!v)}
                        style={{ background:'none', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'8px 16px', color:'rgba(255,255,255,0.4)', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                        <span>{showHidden?'▲':'▼'}</span>
                        {showHidden ? 'Hide' : `Show ${hiddenAccounts.length} hidden account${hiddenAccounts.length===1?'':'s'}`}
                    </button>
                    {showHidden && (
                        <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:10 }}>
                            {hiddenAccounts.map(acct => (
                                <AccountCard key={acct.source} acct={acct} totalMonth={totalMonth} plaidConnections={acct.source==='plaid'?plaidConns:null} onAliasChange={handleAliasChange} onSync={handleSync} syncing={syncing} onDisconnect={() => load(false)} mergedFrom={mergedInto[acct.source]||[]} allMergeTargets={allMergeTargets} plaidSubAccountMap={plaidSubAccountMap} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Connect CTA — only when no Plaid connected */}
            {!loading && !plaidConns.length && (
                <div style={{ marginTop:24, background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:16, padding:'18px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
                    <div>
                        <div style={{ fontSize:14, fontWeight:900, color:'white', marginBottom:3 }}>Live Bank Sync via Plaid</div>
                        <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', fontWeight:600 }}>Connect your bank to auto-import transactions — no more CSV exports.</div>
                    </div>
                    <button onClick={()=>navigate('/import?connect=true')} className="btn sm primary" style={{ whiteSpace:'nowrap', flexShrink:0 }}>Connect a Bank</button>
                </div>
            )}
        </div>
    );
}
