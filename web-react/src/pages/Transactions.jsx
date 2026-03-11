import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetchAllExpenses, formatMoney, formatDate, invalidateExpensesCache } from '../api';
import TransactionDrawer from '../components/TransactionDrawer';
import { useModal } from '../components/ModalContext.jsx';
import CategorySelect from '../components/CategorySelect.jsx';
import { ALL_CATEGORIES } from '../constants/categories.js';

export default function Transactions() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const isAuditMode = searchParams.get('audit') === 'true';

    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [searchVendor, setSearchVendor] = useState('');
    const [searchCategory, setSearchCategory] = useState('');
    const [searchNotes, setSearchNotes] = useState('');
    const [deductOnly, setDeductOnly] = useState(false);
    const [missingReceiptOnly, setMissingReceiptOnly] = useState(false);
    const [sortCol, setSortCol] = useState('expense_date');
    const [sortDir, setSortDir] = useState('desc');

    // Editor
    const [editingId, setEditingId] = useState(null);
    const modal = useModal();

    // Feedback
    const [normalizing, setNormalizing] = useState(false);
    const [toast, setToast] = useState(null); // { msg, ok }

    const loadData = async (force = false) => {
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
        loadData();
    }, []);

    const handleSort = (col) => {
        if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortCol(col); setSortDir('asc'); }
    };

    const SortIcon = ({ col }) => {
        if (sortCol !== col) return <span style={{ opacity: 0.3 }}> ↕</span>;
        return <span>{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>;
    };

    // Date-scoped rows for vendor/category dropdowns
    const scopedRows = useMemo(() => {
        let rows = [...expenses];
        if (start) rows = rows.filter(r => formatDate(r.expense_date) >= start);
        if (end) rows = rows.filter(r => formatDate(r.expense_date) <= end);
        return rows;
    }, [expenses, start, end]);

    const vendorOptions = useMemo(() => {
        const set = new Set();
        scopedRows.forEach(r => { if (r.vendor) set.add(r.vendor); });
        return [...set].sort();
    }, [scopedRows]);

    const filtered = useMemo(() => {
        let rows = [...expenses];

        if (isAuditMode) {
            // Strict Audit Liability focus: Opex > $75 and no receipt attached
            rows = rows.filter(r => {
                const cents = Number(r.amount_cents || 0);
                return cents > 7500 && !r.receipt_link;
            });
        } else {
            if (start) rows = rows.filter(r => formatDate(r.expense_date) >= start);
            if (end) rows = rows.filter(r => formatDate(r.expense_date) <= end);
            if (searchVendor) rows = rows.filter(r => (r.vendor || '').toLowerCase() === searchVendor.toLowerCase() || (r.vendor || '').toLowerCase().includes(searchVendor.toLowerCase()));
            if (searchCategory) rows = rows.filter(r => (r.category || '').toLowerCase() === searchCategory.toLowerCase() || (r.category || '').toLowerCase().includes(searchCategory.toLowerCase()));
            if (searchNotes) rows = rows.filter(r => (r.notes || '').toLowerCase().includes(searchNotes.toLowerCase()));
            if (deductOnly) rows = rows.filter(r => r.tax_deductible);
            if (missingReceiptOnly) rows = rows.filter(r => !r.receipt_link && r.tax_deductible);
        }

        rows.sort((a, b) => {
            let av = a[sortCol] ?? '';
            let bv = b[sortCol] ?? '';
            if (sortCol === 'amount_cents') { av = Number(av); bv = Number(bv); }
            if (av < bv) return sortDir === 'asc' ? -1 : 1;
            if (av > bv) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
        return rows;
    }, [expenses, start, end, searchVendor, searchCategory, searchNotes, deductOnly, missingReceiptOnly, sortCol, sortDir, isAuditMode]);

    const exportCsv = () => {
        const qs = new URLSearchParams();
        if (start) qs.set('start', start);
        if (end) qs.set('end', end);
        window.open(`/api/expenses/export.csv${qs.toString() ? '?' + qs.toString() : ''}`, '_blank');
    };

    const clearFilters = () => {
        setStart(''); setEnd(''); setSearchVendor(''); setSearchCategory(''); setSearchNotes('');
        setDeductOnly(false); setMissingReceiptOnly(false);
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
                        <div className="muted" style={{ fontWeight: 600 }}>
                            {loading ? 'SYNCING...' : `${filtered.length.toLocaleString()} items in current view`}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button className="btn secondary desktop-only" onClick={clearFilters}>Reset</button>
                        <button className="btn secondary desktop-only" onClick={exportCsv}>Export</button>
                        <button className="btn glow-blue" onClick={() => setEditingId('new')} style={{ padding: '10px 20px', fontWeight: 900 }}>
                            + New Item
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── Filters ─── */}
            <div className="card glass desktop-only" style={{ margin: 0, padding: '20px' }}>
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
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <small className="muted">Start</small>
                            <input type="date" value={start} onChange={e => setStart(e.target.value)} style={{ width: '150px' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <small className="muted">End</small>
                            <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={{ width: '150px' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <small className="muted">Vendor</small>
                            <input list="vendor-options" value={searchVendor} onChange={e => setSearchVendor(e.target.value)} placeholder="Search..." style={{ width: '180px' }} autoComplete="off" />
                            <datalist id="vendor-options">{vendorOptions.map(v => <option key={v} value={v} />)}</datalist>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <small className="muted">Category</small>
                            <CategorySelect value={ALL_CATEGORIES.includes(searchCategory) ? searchCategory : ''} onChange={val => setSearchCategory(val)} emptyLabel="All Categories" style={{ width: '180px', padding: '10px' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-end', marginLeft: 'auto' }}>
                            <label className="tag" style={{ cursor: 'pointer', borderColor: deductOnly ? 'var(--accent)' : 'var(--line)' }}>
                                <input type="checkbox" checked={deductOnly} onChange={e => setDeductOnly(e.target.checked)} style={{ width: 'auto', margin: '0 8px 0 0' }} />
                                Deductible
                            </label>
                            <label className="tag" style={{ cursor: 'pointer', borderColor: missingReceiptOnly ? '#fbbf24' : 'var(--line)' }}>
                                <input type="checkbox" checked={missingReceiptOnly} onChange={e => setMissingReceiptOnly(e.target.checked)} style={{ width: 'auto', margin: '0 8px 0 0' }} />
                                ⚠️ Missing Receipts
                            </label>
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Mobile View (Cards) ─── */}
            <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button className="btn glow-blue" onClick={() => setEditingId('new')} style={{ padding: '16px', fontSize: '15px', fontWeight: 900, marginBottom: '8px' }}>
                    + Add Manual Expense
                </button>
                {filtered.map(r => (
                    <div key={r.id} className="card glass" style={{ margin: 0, padding: '16px' }} onClick={() => setEditingId(r.id)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ fontWeight: 950, fontSize: '16px' }}>{r.vendor || 'Unknown Vendor'}</div>
                                <div className="muted" style={{ fontSize: '11px', marginTop: '4px' }}>{formatDate(r.expense_date)} • {r.category}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 950, fontSize: '18px', color: Number(r.amount_cents) < 0 ? '#4ade80' : '#fff' }}>{formatMoney(r.amount_cents)}</div>
                                <div style={{ marginTop: '6px' }}>
                                    {r.receipt_link ? <span className="tag ok" style={{ fontSize: '9px' }}>DOC SAVED</span> : r.tax_deductible ? <span className="tag bad" style={{ fontSize: '9px' }}>MISSING DOC</span> : null}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ─── Table (Desktop Only) ─── */}
            <div className="card glass desktop-only" style={{ margin: 0, padding: '10px' }}>
                <div className="tableWrap" style={{ maxHeight: 'calc(100vh - 350px)', overflowY: 'auto' }}>
                    <table style={{ fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#0b1220' }}>
                            <tr>
                                <th style={{ width: '58px' }}></th>
                                <th onClick={() => handleSort('expense_date')} style={{ cursor: 'pointer' }}>Date<SortIcon col="expense_date" /></th>
                                <th onClick={() => handleSort('vendor')} style={{ cursor: 'pointer' }}>Vendor<SortIcon col="vendor" /></th>
                                <th onClick={() => handleSort('category')} style={{ cursor: 'pointer' }}>Category<SortIcon col="category" /></th>
                                <th onClick={() => handleSort('amount_cents')} style={{ cursor: 'pointer' }}>Amount<SortIcon col="amount_cents" /></th>
                                <th style={{ textAlign: 'center' }}>Receipt</th>
                                <th>Type</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.slice(0, 1000).map(r => (
                                <tr key={r.id}>
                                    <td><button className="btn secondary" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setEditingId(r.id)}>Edit</button></td>
                                    <td>{formatDate(r.expense_date)}</td>
                                    <td style={{ fontWeight: 600 }}>{r.vendor}</td>
                                    <td>{r.category || <span className="muted">—</span>}</td>
                                    <td style={{ fontWeight: 700, textAlign: 'right' }}>{formatMoney(r.amount_cents)}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        {r.receipt_link ? <a className="tag ok" style={{ fontSize: '11px' }} href={r.receipt_link} target="_blank" rel="noreferrer">View</a> : <span className="muted">—</span>}
                                    </td>
                                    <td>{Number(r.amount_cents || 0) < 0 ? <span className="tag ok" style={{ fontSize: '11px' }}>Income</span> : <span className="tag" style={{ fontSize: '11px' }}>Expense</span>}</td>
                                </tr>
                            ))}
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
                />
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
        </section>
    );
}
