import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetchAllExpenses, formatMoney, formatDate, invalidateExpensesCache, apiGet, apiPost, apiPatch, apiDelete, getExpensesCache } from '../api';
import TransactionDrawer from '../components/TransactionDrawer';
import { useModal } from '../components/ModalContext.jsx';
import MergeModal from '../components/MergeModal.jsx';
import CategorySelect from '../components/CategorySelect.jsx';
import { ALL_CATEGORIES, CATEGORY_GROUPS } from '../constants/categories.js';
import useExpenseFilters, { useFilterOptions } from '../hooks/useExpenseFilters';

export default function Transactions() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const isAuditMode = searchParams.get('audit') === 'true';

    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const deepLinkOpened = useRef(false);

    // Filters
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [searchVendor, setSearchVendor] = useState('');
    const [searchCategory, setSearchCategory] = useState('');
    const [searchNotes, setSearchNotes] = useState('');
    const [deductOnly, setDeductOnly] = useState(false);
    const [missingReceiptOnly, setMissingReceiptOnly] = useState(false);
    const [searchAccount,    setSearchAccount]    = useState('');
    const [plaidAccountId,   setPlaidAccountId]   = useState('');
    const [plaidAccountName, setPlaidAccountName] = useState('');
    const [plaidSourceKey,   setPlaidSourceKey]   = useState(''); // source fallback for pre-plaid_account_id txns
    const [institutionFilter, setInstitutionFilter] = useState(''); // prefix filter from Plaid Live Sync card click
    const [needsCategoryFilter, setNeedsCategoryFilter] = useState(false); // set from monthly insights popup
    const [sortCol, setSortCol] = useState('expense_date');
    const [sortDir, setSortDir] = useState('desc');

    // Compute calendar days since the most recent IMPORTED (non-manual) transaction was created.
    // Uses created_at only — expense_date is the transaction date, not the import date.
    // Compares calendar dates in local time so "today" means same date, not "within 24h".
    const daysSinceImport = useMemo(() => {
        if (!expenses.length) return null;
        let latestMs = 0;
        for (const e of expenses) {
            if (!e.source || e.source === 'manual') continue;
            if (!e.created_at) continue; // no import timestamp — skip rather than fall back to expense_date
            const t = new Date(e.created_at).getTime();
            if (t > latestMs) latestMs = t;
        }
        if (!latestMs) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const importDay = new Date(latestMs);
        importDay.setHours(0, 0, 0, 0);
        return Math.round((today.getTime() - importDay.getTime()) / (1000 * 60 * 60 * 24));
    }, [expenses]);

    // Editor
    const [editingId, setEditingId] = useState(null);
    const modal = useModal();

    // Near-duplicate review
    const [reviewingTx, setReviewingTx] = useState(null); // tx whose flag was clicked
    const [needsReviewOnly, setNeedsReviewOnly] = useState(false);

    // Manual multi-select merge
    const [selectedIds, setSelectedIds] = useState(new Set());
    const toggleSelect = (id) => setSelectedIds(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    // Clear review flags (dismiss false positives)
    const [clearingReview, setClearingReview] = useState(false);
    const handleClearReview = async () => {
        const count = selectedIds.size;
        const ok = await modal.confirm(`Mark ${count} transaction${count > 1 ? 's' : ''} as "Not a Duplicate"? This removes the review flag and they won't be flagged again by future scans.`);
        if (!ok) return;
        setClearingReview(true);
        try {
            await apiPatch('/expenses/bulk-clear-review', { ids: [...selectedIds] });
            invalidateExpensesCache();
            setSelectedIds(new Set());
            await loadData(true);
            setToast({ ok: true, msg: `${count} transaction${count > 1 ? 's' : ''} cleared — won't appear in future scans.` });
            setTimeout(() => setToast(null), 4000);
        } catch (e) {
            setToast({ ok: false, msg: `Clear failed: ${e.message}` });
            setTimeout(() => setToast(null), 4000);
        } finally {
            setClearingReview(false);
        }
    };

    // Scan for duplicates
    const [scanning, setScanning] = useState(false);
    const handleScanDupes = async () => {
        setScanning(true);
        try {
            const body = searchAccount ? { source: searchAccount } : {};
            const result = await apiPost('/expenses/scan-dupes', body);
            if (result.found === 0) {
                setToast({ ok: true, msg: `No duplicate transactions found${searchAccount ? ' for this account' : ''}.` });
            } else {
                await loadData(true);
                setNeedsReviewOnly(true);
                setToast({ ok: true, msg: `Found ${result.found} potential duplicate pair${result.found > 1 ? 's' : ''} — flagged for review below.` });
            }
            setTimeout(() => setToast(null), 5000);
        } catch (e) {
            setToast({ ok: false, msg: `Scan failed: ${e.message}` });
            setTimeout(() => setToast(null), 4000);
        } finally {
            setScanning(false);
        }
    };

    // Bulk delete
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const handleBulkDelete = async () => {
        const count = selectedIds.size;
        const ok = await modal.confirm(`Delete ${count} transaction${count > 1 ? 's' : ''}? This cannot be undone.`);
        if (!ok) return;
        setBulkDeleting(true);
        try {
            await apiDelete('/expenses/bulk-delete', { ids: [...selectedIds] });
            invalidateExpensesCache();
            setSelectedIds(new Set());
            await loadData(true);
            setToast({ ok: true, msg: `${count} transaction${count > 1 ? 's' : ''} deleted.` });
            setTimeout(() => setToast(null), 4000);
        } catch (e) {
            setToast({ ok: false, msg: `Delete failed: ${e.message}` });
            setTimeout(() => setToast(null), 5000);
        } finally {
            setBulkDeleting(false);
        }
    };

    // Bulk reassign account
    const [reassignTarget, setReassignTarget] = useState('');
    const [reassigning,    setReassigning]    = useState(false);
    const handleBulkReassign = async () => {
        if (!reassignTarget || reassigning) return;
        setReassigning(true);
        try {
            const r = await apiPatch('/expenses/bulk-source', { ids: [...selectedIds], source: reassignTarget });
            invalidateExpensesCache();
            await loadData(true);
            setToast({ ok: true, msg: `${r.updated ?? selectedIds.size} transactions reassigned to ${ACCOUNT_LABELS[reassignTarget] || reassignTarget}.` });
            setTimeout(() => setToast(null), 4000);
            setSelectedIds(new Set());
            setReassignTarget('');
        } catch(e) {
            setToast({ ok: false, msg: `Reassign failed: ${e.message}` });
            setTimeout(() => setToast(null), 4000);
        } finally {
            setReassigning(false);
        }
    };

    // Feedback
    const [normalizing, setNormalizing] = useState(false);
    const [toast, setToast] = useState(null); // { msg, ok }

    const [accountsList, setAccountsList] = useState([]); // [{source, display_name, visible}]

    useEffect(() => {
        apiGet('/accounts/summary')
            .then(d => setAccountsList(d?.accounts || []))
            .catch(() => {});
    }, []);

    const loadData = async (force = false) => {
        // Stale-while-revalidate: if we have cached data, show it instantly
        // then silently refresh in the background
        const cached = getExpensesCache();
        if (!force && cached) {
            setExpenses(cached);
            setLoading(false);
            // Silently refresh in background
            fetchAllExpenses(true).then(data => setExpenses(data)).catch(() => {});
            return;
        }
        setLoading(true);
        try {
            const data = await fetchAllExpenses(force);
            setExpenses(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Cold start: fetch first 25 instantly for immediate render, then load all
        if (!getExpensesCache()) {
            apiGet('/expenses?limit=25&offset=0').then(data => {
                if (data?.rows?.length) setExpenses(data.rows);
                setLoading(false);
            }).catch(() => {});
        }
        loadData();
    }, []);

    // Pre-populate filters from URL params (?search=, ?source=, ?plaid_account_id=)
    useEffect(() => {
        const urlSearch = searchParams.get('search');
        if (urlSearch) setSearchVendor(urlSearch);
        const urlCategory = searchParams.get('category');
        if (urlCategory) setSearchCategory(urlCategory);
        const urlPlaidId   = searchParams.get('plaid_account_id');
        const urlPlaidName = searchParams.get('plaid_account_name');
        const urlSource    = searchParams.get('source');
        const urlInstitution = searchParams.get('institution');
        if (urlPlaidId) {
            // Sub-account click: source is the fallback key, NOT the account filter
            setPlaidAccountId(urlPlaidId);
            setPlaidAccountName(urlPlaidName || '');
            if (urlSource) setPlaidSourceKey(urlSource);
        } else if (urlInstitution) {
            setInstitutionFilter(urlInstitution);
        } else if (urlSource) {
            setSearchAccount(urlSource);
        }
        if (searchParams.get('needs_category') === '1') setNeedsCategoryFilter(true);
        const urlStart = searchParams.get('start');
        const urlEnd   = searchParams.get('end');
        if (urlStart) setStart(urlStart);
        if (urlEnd)   setEnd(urlEnd);
    }, []); // intentionally run once on mount only

    // Deep-link: ?expense=<id> from receipt confirmation email — open drawer for that transaction
    useEffect(() => {
        if (deepLinkOpened.current) return;
        const urlExpense = searchParams.get('expense');
        if (!urlExpense || !expenses.length) return;
        const id = parseInt(urlExpense, 10);
        if (expenses.find(x => x.id === id)) {
            deepLinkOpened.current = true;
            setEditingId(id);
        }
    }, [expenses]); // eslint-disable-line react-hooks/exhaustive-deps

    // Refresh when Brain Assistant approves a transaction action
    useEffect(() => {
        const handler = (e) => {
            if (e.detail?.scope === 'transactions') loadData(true);
        };
        window.addEventListener('ll:refresh', handler);
        return () => window.removeEventListener('ll:refresh', handler);
    }, []);


    const handleSort = (col) => {
        if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortCol(col); setSortDir('asc'); }
    };

    const SortIcon = ({ col }) => {
        if (sortCol !== col) return <span style={{ opacity: 0.3 }}> ↕</span>;
        return <span>{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>;
    };

    // Build source → label map from live account aliases (API) with static fallbacks
    const ACCOUNT_LABELS = useMemo(() => {
        const STATIC = {
            manual: 'Manual Entry', plaid: 'Live Sync',
            rocketmoney: 'Rocket Money', chase: 'Chase Bank', usbank: 'US Bank',
            bankofamerica: 'Bank of America', wellsfargo: 'Wells Fargo',
            applecard: 'Apple Card', capitalone: 'Capital One', usaa: 'USAA',
            navyfcu: 'Navy Federal', wise: 'Wise', delta_amex: 'Delta Amex Card',
            amex_gold: 'Amex Gold Card', amex_platinum: 'Amex Platinum Card',
            amex_blue: 'Amex Blue Cash',
        };
        const map = { ...STATIC };
        for (const a of accountsList) {
            if (a.display_name) map[a.source] = a.display_name;
            else if (!map[a.source]) map[a.source] = a.source.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
        }
        return map;
    }, [accountsList]);

    const { vendors: vendorOptions, accounts: accountOptions } = useFilterOptions(expenses, start, end);

    // Audit mode applies a special pre-filter before the shared hook
    const auditBase = useMemo(() => {
        if (!isAuditMode) return expenses;
        return expenses.filter(r => Number(r.amount_cents || 0) > 7500 && !r.receipt_link);
    }, [expenses, isAuditMode]);

    const filters = useMemo(() => isAuditMode ? {} : {
        start, end, vendor: searchVendor, category: searchCategory,
        account: searchAccount, institutionPrefix: institutionFilter, plaidAccountId, plaidSourceKey, notes: searchNotes, deductOnly, missingReceiptOnly,
        needsCategory: needsCategoryFilter,
    }, [isAuditMode, start, end, searchVendor, searchCategory, searchAccount, institutionFilter, plaidAccountId, plaidSourceKey, searchNotes, deductOnly, missingReceiptOnly, needsCategoryFilter]);


    const { filtered: filteredBase } = useExpenseFilters(auditBase, filters, sortCol, sortDir);
    const filtered = useMemo(() =>
        needsReviewOnly ? filteredBase.filter(r => r.needs_review) : filteredBase,
    [filteredBase, needsReviewOnly]);

    const exportCsv = () => {
        const qs = new URLSearchParams();
        if (start) qs.set('start', start);
        if (end) qs.set('end', end);
        window.open(`/api/expenses/export.csv${qs.toString() ? '?' + qs.toString() : ''}`, '_blank');
    };

    const clearFilters = () => {
        setStart(''); setEnd(''); setSearchVendor(''); setSearchCategory('');
        setSearchAccount(''); setInstitutionFilter(''); setPlaidAccountId(''); setPlaidAccountName(''); setPlaidSourceKey('');
        setSearchNotes(''); setDeductOnly(false); setMissingReceiptOnly(false); setNeedsCategoryFilter(false);
        setToast({ ok: true, msg: 'All filters cleared. Showing full ledger.' });
        setTimeout(() => setToast(null), 3000);
    };

    const handleResolveReview = async (txId, action) => {
        try {
            await apiPatch(`/expenses/${txId}/resolve-review`, { action });
            setReviewingTx(null);
            invalidateExpensesCache();
            await loadData(true);
            setToast({ ok: true, msg: action === 'keep_both' ? 'Marked as intentionally different — flag cleared.' : 'Transaction resolved.' });
            setTimeout(() => setToast(null), 4000);
        } catch (e) {
            setToast({ ok: false, msg: `Resolve failed: ${e.message}` });
            setTimeout(() => setToast(null), 4000);
        }
    };

    // MergeModal state
    const [mergeModalTxs, setMergeModalTxs] = useState(null); // { txA, txB } | null

    const handleManualMerge = () => {
        const ids = [...selectedIds];
        if (ids.length !== 2) return;
        const txA = expenses.find(e => e.id === ids[0]);
        const txB = expenses.find(e => e.id === ids[1]);
        if (!txA || !txB) return;
        setMergeModalTxs({ txA, txB });
    };

    const handleMergeConfirm = async ({ keepId, deleteId, overrides }) => {
        setMergeModalTxs(null);
        try {
            await apiPost('/expenses/manual-merge', { keepId, deleteId, overrides });
            setSelectedIds(new Set());
            invalidateExpensesCache();
            await loadData(true);
            setToast({ ok: true, msg: 'Transactions merged.' });
            setTimeout(() => setToast(null), 4000);
        } catch (e) {
            setToast({ ok: false, msg: `Merge failed: ${e.message}` });
            setTimeout(() => setToast(null), 4000);
        }
    };

    const handleNormalizeVendors = async () => {
        const ok = await modal.confirm('This will clean up messy vendor names in your database. Continue?');
        if (!ok) return;
        setNormalizing(true);
        try {
            const r = await fetch('/api/import/normalize-vendors', { method: 'POST', credentials: 'include' });
            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || r.statusText);
            invalidateExpensesCache();
            await loadData(true);
            setToast({ ok: true, msg: `Cleaned ${data.updated.toLocaleString()} vendor names.` });
            setTimeout(() => setToast(null), 5000);
        } catch (e) {
            setToast({ ok: false, msg: `Failed: ${e.message}` });
            setTimeout(() => setToast(null), 5000);
        } finally {
            setNormalizing(false);
        }
    };

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '100px' }}>
            {/* ─── Header ─── */}
            <div className="card glass glow-blue" style={{ padding: '24px 30px', border: 'none', margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 950, letterSpacing: '-0.02em' }}>Transaction Ledger</h1>
                        <div className="muted" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                            {loading ? 'SYNCING...' : `${filtered.length.toLocaleString()} items in current view`}
                            {!loading && daysSinceImport !== null && (
                                <span style={{
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    padding: '2px 10px',
                                    borderRadius: '20px',
                                    letterSpacing: '0.04em',
                                    background: daysSinceImport <= 3
                                        ? 'rgba(74,222,128,0.12)'
                                        : daysSinceImport <= 7
                                        ? 'rgba(251,191,36,0.12)'
                                        : 'rgba(255,77,77,0.12)',
                                    color: daysSinceImport <= 3
                                        ? '#4ade80'
                                        : daysSinceImport <= 7
                                        ? '#fbbf24'
                                        : '#ff4d4d',
                                    border: `1px solid ${daysSinceImport <= 3
                                        ? 'rgba(74,222,128,0.25)'
                                        : daysSinceImport <= 7
                                        ? 'rgba(251,191,36,0.25)'
                                        : 'rgba(255,77,77,0.25)'}`,
                                }}>
                                    {daysSinceImport === 0
                                        ? '🟢 Updated today'
                                        : daysSinceImport === 1
                                        ? '🟢 1 day since last import'
                                        : `${daysSinceImport <= 7 ? '🟡' : '🔴'} ${daysSinceImport}d since last import`}
                                </span>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button className="btn glow-blue" onClick={() => setEditingId('new')} style={{ fontWeight: 900 }}>➕ ADD TRANSACTION</button>
                        <button className="btn secondary" style={{ background: 'rgba(34, 197, 94, 0.15)', borderColor: 'rgba(34, 197, 94, 0.4)', color: '#4ade80', fontWeight: 900 }} onClick={() => navigate('/import')}>🏦 Bank Import Portal</button>
                    </div>
                </div>
            </div>

            {/* ─── Filters ─── */}
            <div className="card glass desktop-only" style={{ margin: 0, padding: '24px' }}>
                {isAuditMode ? (
                    <div style={{ padding: '16px 20px', background: 'rgba(255, 77, 77, 0.15)', borderRadius: '12px', border: '1px solid rgba(255, 77, 77, 0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ fontSize: '24px' }}>🚨</div>
                            <div>
                                <div style={{ fontWeight: 900, color: '#ff4d4d', fontSize: '15px' }}>AUDIT LIABILITY MODE</div>
                                <div className="muted" style={{ fontSize: '12px' }}>Isolating transactions over $75 with missing documentation.</div>
                            </div>
                        </div>
                        <button className="btn secondary" onClick={() => navigate('/transactions')} style={{ borderColor: 'rgba(255, 77, 77, 0.4)', color: '#ff4d4d', fontWeight: 'bold' }}>
                            EXIT AUDIT ✕
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center' }}>
                        {/* Plaid sub-account active filter badge */}
                        {plaidAccountId && (
                            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.25)', borderRadius:10, fontSize:12, color:'#10b981', fontWeight:700 }}>
                                🏦 Filtered to: <strong>{plaidAccountName || plaidAccountId}</strong>
                                <button onClick={() => { setPlaidAccountId(''); setPlaidAccountName(''); }}
                                    style={{ background:'none', border:'none', color:'rgba(16,185,129,0.6)', cursor:'pointer', fontSize:14, padding:'0 2px', lineHeight:1 }}>✕</button>
                            </div>
                        )}
                        {/* Institution prefix filter badge — set when clicking Transactions on a Live Sync card */}
                        {institutionFilter && (
                            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.25)', borderRadius:10, fontSize:12, color:'#10b981', fontWeight:700 }}>
                                Filtered to: <strong>{institutionFilter}</strong> accounts
                                <button onClick={() => setInstitutionFilter('')}
                                    style={{ background:'none', border:'none', color:'rgba(16,185,129,0.6)', cursor:'pointer', fontSize:14, padding:'0 2px', lineHeight:1 }}>✕</button>
                            </div>
                        )}
                        {/* Uncategorized filter badge — set from monthly insights popup */}
                        {needsCategoryFilter && (
                            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.3)', borderRadius:10, fontSize:12, color:'#f97316', fontWeight:700 }}>
                                Showing uncategorized transactions only
                                <button onClick={() => setNeedsCategoryFilter(false)}
                                    style={{ background:'none', border:'none', color:'rgba(249,115,22,0.6)', cursor:'pointer', fontSize:14, padding:'0 2px', lineHeight:1 }}>✕</button>
                            </div>
                        )}
                        {/* Row 1: Filters */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'center', width: '100%' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <small className="muted" style={{ fontWeight: 800 }}>START DATE</small>
                                <input type="date" value={start} onChange={e => setStart(e.target.value)} style={{ width: '150px' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <small className="muted" style={{ fontWeight: 800 }}>END DATE</small>
                                <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={{ width: '150px' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <small className="muted" style={{ fontWeight: 800 }}>VENDOR</small>
                                <input list="vendor-options" value={searchVendor} onChange={e => setSearchVendor(e.target.value)} placeholder="Search..." style={{ width: '180px' }} autoComplete="off" />
                                <datalist id="vendor-options">{vendorOptions.map(v => <option key={v} value={v} />)}</datalist>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <small className="muted" style={{ fontWeight: 800 }}>CATEGORY</small>
                                <select
                                    value={needsCategoryFilter ? '__uncategorized__' : (ALL_CATEGORIES.includes(searchCategory) ? searchCategory : '')}
                                    onChange={e => {
                                        const v = e.target.value;
                                        if (v === '__uncategorized__') {
                                            setNeedsCategoryFilter(true);
                                            setSearchCategory('');
                                        } else {
                                            setNeedsCategoryFilter(false);
                                            setSearchCategory(v);
                                        }
                                    }}
                                    style={{ width: '180px', padding: '8px' }}
                                >
                                    <option value="">All Categories</option>
                                    <option value="__uncategorized__">Uncategorized</option>
                                    {CATEGORY_GROUPS.map(({ group, label, items }) => (
                                        <optgroup key={group} label={label}>
                                            {items.map(item => (
                                                <option key={item} value={item}>{item}</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <small className="muted" style={{ fontWeight: 800 }}>ACCOUNT</small>
                                <select value={searchAccount} onChange={e => { setSearchAccount(e.target.value); setPlaidAccountId(''); setPlaidSourceKey(''); }} style={{ width: '180px' }}>
                                    <option value="">All Accounts</option>
                                    {accountsList
                                        .filter(a => a.source !== 'plaid')
                                        .map(a => (
                                            <option key={a.source} value={a.source}>
                                                {a.display_name || ACCOUNT_LABELS[a.source] || a.source}
                                            </option>
                                        ))
                                    }
                                    {/* Legacy sources on transactions not in accounts list */}
                                    {accountOptions
                                        .filter(s => s && !accountsList.find(a => a.source === s))
                                        .map(s => <option key={s} value={s}>{ACCOUNT_LABELS[s] || s}</option>)
                                    }
                                </select>
                            </div>
                        </div>

                        {/* Row 2: Actions & Toggles */}
                        <div style={{ display: 'flex', gap: '30px', alignItems: 'center', justifyContent: 'center', width: '100%', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button className="btn secondary sm" onClick={clearFilters} style={{ padding: '8px 20px', fontSize: '12px', fontWeight: 800 }}>RESET FILTERS</button>
                                <button className="btn secondary sm" onClick={exportCsv} style={{ padding: '8px 20px', fontSize: '12px', fontWeight: 800 }}>EXPORT CSV</button>
                                <button className="btn secondary sm" onClick={handleScanDupes} disabled={scanning} style={{ padding: '8px 20px', fontSize: '12px', fontWeight: 800, opacity: scanning ? 0.6 : 1 }}>
                                    {scanning ? 'SCANNING...' : `SCAN DUPES${searchAccount ? ' (THIS ACCOUNT)' : ''}`}
                                </button>
                            </div>

                            <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }} />

                            <div style={{ display: 'flex', gap: '15px' }}>
                                <label className="tag clickable" style={{ padding: '6px 12px', borderColor: deductOnly ? 'var(--accent)' : 'var(--line)', background: deductOnly ? 'rgba(99,102,241,0.1)' : 'transparent' }}>
                                    <input type="checkbox" checked={deductOnly} onChange={e => setDeductOnly(e.target.checked)} style={{ width: 'auto', margin: '0 8px 0 0' }} />
                                    Deductible
                                </label>
                                <label className="tag clickable" style={{ padding: '6px 12px', borderColor: missingReceiptOnly ? '#fbbf24' : 'var(--line)', background: missingReceiptOnly ? 'rgba(251,191,36,0.1)' : 'transparent' }}>
                                    <input type="checkbox" checked={missingReceiptOnly} onChange={e => setMissingReceiptOnly(e.target.checked)} style={{ width: 'auto', margin: '0 8px 0 0' }} />
                                    ⚠️ Missing Docs
                                </label>
                                <label className="tag clickable" style={{ padding: '6px 12px', borderColor: needsReviewOnly ? '#f97316' : 'var(--line)', background: needsReviewOnly ? 'rgba(249,115,22,0.1)' : 'transparent' }}>
                                    <input type="checkbox" checked={needsReviewOnly} onChange={e => setNeedsReviewOnly(e.target.checked)} style={{ width: 'auto', margin: '0 8px 0 0' }} />
                                    🚩 Needs Review
                                </label>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Mobile View (Cards) ─── */}
            <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filtered.map(r => (
                    <div key={r.id} className="card glass" style={{ margin: 0, padding: '16px', maxWidth: '100vw', overflow: 'hidden', position: 'relative', borderLeft: r.needs_review ? '3px solid #f97316' : undefined }} onClick={() => setEditingId(r.id)}>
                        {r.needs_review && (
                            <button
                                onClick={e => { e.stopPropagation(); setReviewingTx(r); }}
                                title="Near-duplicate flagged — tap to review"
                                style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.5)', borderRadius: '6px', padding: '2px 6px', fontSize: '11px', cursor: 'pointer', color: '#f97316', fontWeight: 900, zIndex: 2 }}
                            >🚩</button>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div className="text-truncate" style={{ fontWeight: 950, fontSize: '16px' }}>{r.vendor || 'Unknown Vendor'}</div>
                                <div className="muted text-truncate" style={{ fontSize: '11px', marginTop: '4px' }}>{formatDate(r.expense_date)} • {r.category}</div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0, paddingRight: r.needs_review ? '28px' : 0 }}>
                                <div style={{ fontWeight: 950, fontSize: '18px', color: Number(r.amount_cents) < 0 ? '#4ade80' : '#fff' }}>{formatMoney(r.amount_cents)}</div>
                                <div style={{ marginTop: '6px' }}>
                                    {r.receipt_link
                                    ? <span className="tag ok" style={{ fontSize: '9px' }}>DOC SAVED</span>
                                    : (r.tax_deductible && Number(r.amount_cents || 0) > 7500)
                                        ? <span className="tag bad" style={{ fontSize: '9px' }}>MISSING DOC</span>
                                        : null}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ─── Table (Desktop Only) ─── */}
            <div className="card glass desktop-only" style={{ margin: 0, padding: '10px', overflow: 'hidden' }}>
                <div className="tableWrap" style={{ maxHeight: 'calc(100vh - 350px)', overflowY: 'auto', overflowX: 'hidden' }}>
                    <table style={{ fontSize: '12.5px', tableLayout: 'fixed', width: '100%', minWidth: '100%' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#0b1220' }}>
                            <tr>
                                <th style={{ width: '28px', textAlign: 'center' }}>
                                    <input type="checkbox" title="Select all visible" style={{ width: 'auto', cursor: 'pointer' }}
                                        onChange={e => {
                                            if (e.target.checked) setSelectedIds(new Set(filtered.slice(0, 1000).map(r => r.id)));
                                            else setSelectedIds(new Set());
                                        }}
                                        checked={selectedIds.size > 0 && filtered.slice(0, 1000).every(r => selectedIds.has(r.id))}
                                    />
                                </th>
                                <th style={{ width: '45px' }}></th>
                                <th onClick={() => handleSort('expense_date')} style={{ cursor: 'pointer', width: '11%', whiteSpace: 'nowrap' }}>Date<SortIcon col="expense_date" /></th>
                                <th onClick={() => handleSort('source')} style={{ cursor: 'pointer', width: '13%' }}>Account<SortIcon col="source" /></th>
                                <th onClick={() => handleSort('vendor')} style={{ cursor: 'pointer', width: '27%' }}>Vendor<SortIcon col="vendor" /></th>
                                <th onClick={() => handleSort('category')} style={{ cursor: 'pointer', width: '20%' }}>Category<SortIcon col="category" /></th>
                                <th onClick={() => handleSort('amount_cents')} style={{ cursor: 'pointer', width: '14%', textAlign: 'right' }}>Amount<SortIcon col="amount_cents" /></th>
                                <th style={{ textAlign: 'center', width: '8%' }}>Doc</th>
                                <th style={{ width: '10%' }}>Type</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.slice(0, 1000).map(r => {
                                const isSelected = selectedIds.has(r.id);
                                return (
                                    <tr key={r.id} style={{ background: isSelected ? 'rgba(99,102,241,0.08)' : r.needs_review ? 'rgba(249,115,22,0.04)' : undefined, borderLeft: r.needs_review ? '3px solid #f97316' : undefined }}>
                                        <td style={{ textAlign: 'center' }}>
                                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(r.id)} style={{ width: 'auto', cursor: 'pointer' }} onClick={e => e.stopPropagation()} />
                                        </td>
                                        <td><button className="btn secondary" style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => setEditingId(r.id)}>Edit</button></td>
                                        <td style={{ opacity: 0.8, whiteSpace: 'nowrap' }}>{formatDate(r.expense_date)}</td>
                                        <td style={{ fontSize: '11px', fontWeight: 700 }}>{ACCOUNT_LABELS[r.source] || r.source || 'manual'}</td>
                                        <td style={{ fontWeight: 600 }} className="text-truncate" title={r.vendor}>{r.vendor}</td>
                                        <td className="text-truncate" style={{ opacity: 0.9 }} title={r.category}>{r.category || <span className="muted">—</span>}</td>
                                        <td style={{ fontWeight: 700, textAlign: 'right' }}>{formatMoney(r.amount_cents)}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            {r.receipt_link ? (
                                                <button
                                                    className="tag ok"
                                                    style={{ fontSize: '10px', padding: '2px 8px', cursor: 'pointer', border: 'none', background: 'none' }}
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        try {
                                                            const json = await apiGet(`/receipts/signed-url?path=${encodeURIComponent(r.receipt_link)}`);
                                                            if (json.url) window.open(json.url, '_blank');
                                                            else modal.alert('Could not load receipt: ' + (json.error || 'Unknown error'));
                                                        } catch (err) {
                                                            modal.alert('Receipt load failed: ' + err.message);
                                                        }
                                                    }}
                                                >View</button>
                                            ) : (r.tax_deductible && Number(r.amount_cents || 0) > 7500) ? (
                                                <span className="tag bad" style={{ fontSize: '9px', padding: '2px 6px' }}>⚠️ Missing</span>
                                            ) : (
                                                <span className="muted">—</span>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap' }}>
                                                <span className="tag" style={{ fontSize: '9px', padding: '1px 4px', opacity: 0.8 }}>
                                                    {Number(r.amount_cents || 0) < 0 ? 'Income' : 'Expense'}
                                                </span>
                                                {r.needs_review && (
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setReviewingTx(r); }}
                                                        title="Near-duplicate flagged — click to review"
                                                        style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.5)', borderRadius: '4px', padding: '1px 5px', fontSize: '10px', cursor: 'pointer', color: '#f97316', fontWeight: 900, lineHeight: 1.2 }}
                                                    >🚩</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ─── Edit Drawer ─── */}
            {editingId && (
                <TransactionDrawer
                    transaction={editingId === 'new' ? { id: null } : expenses.find(x => x.id === editingId)}
                    onClose={() => setEditingId(null)}
                    onSave={(updated) => {
                        invalidateExpensesCache();
                        loadData(true);
                    }}
                    onDelete={() => {
                        invalidateExpensesCache();
                        loadData(true);
                    }}
                    accounts={accountsList.filter(a => a.source !== 'plaid' && a.visible !== false)}
                />
            )}

            {/* ─── Near-Duplicate Review Modal ─── */}
            {reviewingTx && (() => {
                const pair = reviewingTx.review_pair_id
                    ? expenses.find(e => e.id !== reviewingTx.id && e.review_pair_id === reviewingTx.review_pair_id)
                    : null;
                return (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
                        onClick={() => setReviewingTx(null)}>
                        <div style={{ background: '#0f1a33', border: '1px solid rgba(249,115,22,0.4)', borderRadius: '16px', padding: '28px', maxWidth: '720px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
                            onClick={e => e.stopPropagation()}>
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ fontSize: '18px', fontWeight: 950, marginBottom: '4px' }}>🚩 Near-Duplicate Flagged</div>
                                <div className="muted" style={{ fontSize: '12px' }}>These transactions are similar in vendor, date, and amount — possibly a tip adjustment or duplicate import.</div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: pair ? '1fr 1fr' : '1fr', gap: '16px', marginBottom: '24px' }}>
                                {[reviewingTx, pair].filter(Boolean).map((tx, i) => (
                                    <div key={tx.id} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${i === 0 ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '12px', padding: '16px' }}>
                                        <div style={{ fontSize: '10px', fontWeight: 800, color: i === 0 ? '#f97316' : 'var(--muted)', marginBottom: '8px', letterSpacing: '0.08em' }}>
                                            {i === 0 ? 'THIS TRANSACTION' : 'PAIRED TRANSACTION'}
                                        </div>
                                        <div style={{ fontWeight: 900, fontSize: '16px', marginBottom: '4px' }}>{tx.vendor || '—'}</div>
                                        <div style={{ fontSize: '22px', fontWeight: 950, color: Number(tx.amount_cents) < 0 ? '#4ade80' : '#fff', marginBottom: '8px' }}>{formatMoney(tx.amount_cents)}</div>
                                        <div className="muted" style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <span>📅 {formatDate(tx.expense_date)}</span>
                                            <span>🏷️ {tx.category || 'No category'}</span>
                                            <span>🏦 {ACCOUNT_LABELS[tx.source] || tx.source || 'manual'}</span>
                                            {tx.notes && <span>📝 {tx.notes}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Action buttons */}
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                <button className="btn secondary" onClick={() => setReviewingTx(null)} style={{ fontSize: '12px', padding: '8px 16px' }}>Cancel</button>
                                <button
                                    className="btn secondary"
                                    style={{ fontSize: '12px', padding: '8px 16px', borderColor: 'rgba(74,222,128,0.4)', color: '#4ade80' }}
                                    onClick={() => handleResolveReview(reviewingTx.id, 'keep_both')}
                                >✅ Keep Both</button>
                                {pair && (
                                    <>
                                        <button
                                            className="btn secondary"
                                            style={{ fontSize: '12px', padding: '8px 16px', borderColor: 'rgba(255,77,77,0.4)', color: '#ff4d4d' }}
                                            onClick={() => handleResolveReview(reviewingTx.id, 'delete_this')}
                                        >🗑 Delete This One</button>
                                        <button
                                            className="btn secondary"
                                            style={{ fontSize: '12px', padding: '8px 16px', borderColor: 'rgba(255,77,77,0.4)', color: '#ff4d4d' }}
                                            onClick={() => handleResolveReview(reviewingTx.id, 'delete_pair')}
                                        >🗑 Delete Paired One</button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ─── Multi-Select Floating Action Bar ─── */}
            {selectedIds.size >= 1 && (
                <div style={{ position: 'fixed', bottom: '28px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', background: 'rgba(10,20,42,0.97)', border: '1px solid rgba(99,102,241,0.5)', borderRadius: '14px', padding: '12px 20px', boxShadow: '0 8px 40px rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', maxWidth: '90vw' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>{selectedIds.size} selected</span>
                    <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.15)' }} />

                    {/* Reassign Account */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <select
                            value={reassignTarget}
                            onChange={e => setReassignTarget(e.target.value)}
                            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: reassignTarget ? 'white' : 'rgba(255,255,255,0.45)', fontSize: '12px', fontWeight: 700, padding: '7px 10px', cursor: 'pointer', outline: 'none' }}
                        >
                            <option value="">Reassign account…</option>
                            <option value="manual">Manual Entry</option>
                            {accountsList.filter(a => a.source !== 'plaid' && a.visible !== false).map(a => (
                                <option key={a.source} value={a.source}>
                                    {a.display_name || ACCOUNT_LABELS[a.source] || a.source}
                                </option>
                            ))}
                        </select>
                        {reassignTarget && (
                            <button
                                className="btn"
                                disabled={reassigning}
                                style={{ fontSize: '12px', padding: '7px 14px', fontWeight: 900, background: 'rgba(56,189,248,0.2)', borderColor: 'rgba(56,189,248,0.6)', color: '#38bdf8', opacity: reassigning ? 0.5 : 1 }}
                                onClick={handleBulkReassign}
                            >{reassigning ? 'Saving…' : 'Apply'}</button>
                        )}
                    </div>

                    <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.15)' }} />

                    {selectedIds.size === 2 && (
                        <button
                            className="btn"
                            style={{ fontSize: '12px', padding: '8px 18px', fontWeight: 900, background: 'rgba(99,102,241,0.2)', borderColor: 'rgba(99,102,241,0.6)' }}
                            onClick={handleManualMerge}
                        >Merge Duplicate</button>
                    )}
                    {needsReviewOnly && (
                        <button
                            className="btn"
                            style={{ fontSize: '12px', padding: '8px 16px', fontWeight: 700, background: 'rgba(100,116,139,0.15)', borderColor: 'rgba(100,116,139,0.4)', color: '#94a3b8', opacity: clearingReview ? 0.5 : 1 }}
                            onClick={handleClearReview}
                            disabled={clearingReview}
                        >{clearingReview ? 'Clearing…' : 'Not a Duplicate'}</button>
                    )}
                    <button
                        className="btn"
                        style={{ fontSize: '12px', padding: '8px 16px', fontWeight: 700, background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.5)', color: '#ef4444', opacity: bulkDeleting ? 0.5 : 1 }}
                        onClick={handleBulkDelete}
                        disabled={bulkDeleting}
                    >{bulkDeleting ? 'Deleting…' : 'Delete Selected'}</button>
                    <button
                        className="btn secondary"
                        style={{ fontSize: '12px', padding: '8px 14px' }}
                        onClick={() => { setSelectedIds(new Set()); setReassignTarget(''); }}
                    >✕ Clear</button>
                </div>
            )}

            {toast && (
                <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 99999, padding: '14px 22px', borderRadius: '14px', background: 'rgba(15,26,51,0.97)', backdropFilter: 'blur(8px)', border: `1px solid ${toast.ok ? 'rgba(74,222,128,0.4)' : 'rgba(255,77,77,0.4)'}`, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '20px' }}>{toast.ok ? '✅' : '❌'}</span>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '2px' }}>LEDGER UPDATE</div>
                        <div style={{ fontSize: '13px' }}>{toast.msg}</div>
                    </div>
                </div>
            )}
        {/* Merge Modal */}
        {mergeModalTxs && (
            <MergeModal
                txA={mergeModalTxs.txA}
                txB={mergeModalTxs.txB}
                onConfirm={handleMergeConfirm}
                onCancel={() => setMergeModalTxs(null)}
            />
        )}
        </section>
    );
}
