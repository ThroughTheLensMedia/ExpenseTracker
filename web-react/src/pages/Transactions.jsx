import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchAllExpenses, formatMoney, formatDate, invalidateExpensesCache } from '../api';
import TransactionDrawer from '../components/TransactionDrawer';
import { useModal } from '../components/ModalContext.jsx';

export default function Transactions() {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [searchVendor, setSearchVendor] = useState('');
    const [searchCategory, setSearchCategory] = useState('');
    const [searchNotes, setSearchNotes] = useState('');
    const [deductOnly, setDeductOnly] = useState(false);
    const [sortCol, setSortCol] = useState('expense_date');
    const [sortDir, setSortDir] = useState('desc');

    // Editor
    const [editingId, setEditingId] = useState(null);
    const modal = useModal();

    // Import modal
    const fileInputRef = useRef(null);
    const [showImport, setShowImport] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [rmMsg, setRmMsg] = useState('');
    const [rmErrors, setRmErrors] = useState([]);
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

    const categoryOptions = useMemo(() => {
        const set = new Set();
        scopedRows.forEach(r => { if (r.category) set.add(r.category); });
        return [...set].sort();
    }, [scopedRows]);

    const filtered = useMemo(() => {
        let rows = [...expenses];
        if (start) rows = rows.filter(r => formatDate(r.expense_date) >= start);
        if (end) rows = rows.filter(r => formatDate(r.expense_date) <= end);
        if (searchVendor) rows = rows.filter(r => (r.vendor || '').toLowerCase() === searchVendor.toLowerCase() || (r.vendor || '').toLowerCase().includes(searchVendor.toLowerCase()));
        if (searchCategory) rows = rows.filter(r => (r.category || '').toLowerCase() === searchCategory.toLowerCase() || (r.category || '').toLowerCase().includes(searchCategory.toLowerCase()));
        if (searchNotes) rows = rows.filter(r => (r.notes || '').toLowerCase().includes(searchNotes.toLowerCase()));
        if (deductOnly) rows = rows.filter(r => r.tax_deductible);
        rows.sort((a, b) => {
            let av = a[sortCol] ?? '';
            let bv = b[sortCol] ?? '';
            if (sortCol === 'amount_cents') { av = Number(av); bv = Number(bv); }
            if (av < bv) return sortDir === 'asc' ? -1 : 1;
            if (av > bv) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
        return rows;
    }, [expenses, start, end, searchVendor, searchCategory, searchNotes, deductOnly, sortCol, sortDir]);

    const exportCsv = () => {
        const qs = new URLSearchParams();
        if (start) qs.set('start', start);
        if (end) qs.set('end', end);
        window.open(`/api/expenses/export.csv${qs.toString() ? '?' + qs.toString() : ''}`, '_blank');
    };

    const importRocketMoney = async (file) => {
        if (!file) return;
        setRmMsg('Importing…');
        setRmErrors([]);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const r = await fetch('/api/import/rocketmoney', {
                method: 'POST',
                credentials: 'include',
                body: fd
            });
            const data = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(data?.error || `${r.status} ${r.statusText}`);
            const ins = Number(data.inserted || 0), upd = Number(data.updated || 0), sk = Number(data.skipped || 0);
            setRmMsg(`✅ Done — inserted ${ins.toLocaleString()}, updated ${upd.toLocaleString()}, skipped ${sk.toLocaleString()}.`);
            if (Array.isArray(data.errors) && data.errors.length) setRmErrors(data.errors);
            invalidateExpensesCache();
            loadData(true);
        } catch (e) {
            setRmMsg(`❌ Import failed: ${e.message}`);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) importRocketMoney(e.dataTransfer.files[0]);
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files[0]) importRocketMoney(e.target.files[0]);
    };

    const clearFilters = () => {
        setStart(''); setEnd(''); setSearchVendor(''); setSearchCategory(''); setSearchNotes(''); setDeductOnly(false);
    };

    const handleNormalizeVendors = async () => {
        const ok = await modal.confirm('This will clean up messy vendor names in your database (e.g. "AMAZON MKTPL*XYZ123" → "Amazon"). Continue?');
        if (!ok) return;
        setNormalizing(true);
        try {
            const r = await fetch('/api/import/normalize-vendors', { method: 'POST', credentials: 'include' });
            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || r.statusText);
            invalidateExpensesCache();
            await loadData(true);
            setToast({ ok: true, msg: `Cleaned ${data.updated.toLocaleString()} vendor names out of ${data.total.toLocaleString()} transactions.` });
            setTimeout(() => setToast(null), 5000);
        } catch (e) {
            setToast({ ok: false, msg: `Failed: ${e.message}` });
            setTimeout(() => setToast(null), 5000);
        } finally {
            setNormalizing(false);
        }
    };

    return (
        <section className="card">
            {/* ─── Toolbar ─── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                <h2 style={{ margin: 0 }}>
                    Transactions
                    <span className="muted" style={{ marginLeft: '10px', fontWeight: 400, fontSize: '13px' }}>
                        {loading ? 'Loading…' : `${filtered.length.toLocaleString()} shown`}
                    </span>
                </h2>

                {/* Action buttons — right side */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button className="btn secondary" onClick={clearFilters} style={{ fontSize: '12px' }}>Clear Filters</button>
                    <button className="btn secondary" onClick={exportCsv} style={{ fontSize: '12px' }}>⬇ Export CSV</button>
                    <button className="btn secondary" onClick={() => loadData(true)} disabled={loading} style={{ fontSize: '12px' }}>↺ Reload</button>
                    <button className="btn secondary" onClick={handleNormalizeVendors} disabled={normalizing} style={{ fontSize: '12px' }} title="Consolidate messy vendor names (Amazon MKTPL* → Amazon)">
                        {normalizing ? 'Cleaning…' : '✨ Clean Vendors'}
                    </button>
                    <button className="btn" onClick={() => { setShowImport(true); setRmMsg(''); setRmErrors([]); }} style={{ fontSize: '12px' }}>
                        ⬆ Import CSV
                    </button>
                </div>
            </div>

            {/* ─── Filters ─── */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end', padding: '12px 14px', background: 'rgba(0,0,0,0.15)', borderRadius: '12px', border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <small className="muted">Start Date</small>
                    <input type="date" value={start} onChange={e => setStart(e.target.value)} style={{ width: '150px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <small className="muted">End Date</small>
                    <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={{ width: '150px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <small className="muted">Vendor</small>
                    <input
                        list="vendor-options"
                        value={searchVendor}
                        onChange={e => setSearchVendor(e.target.value)}
                        placeholder="Type or pick vendor…"
                        style={{ width: '200px' }}
                        autoComplete="off"
                    />
                    <datalist id="vendor-options">
                        {vendorOptions.map(v => <option key={v} value={v} />)}
                    </datalist>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <small className="muted">Category</small>
                    <input
                        list="category-filter-options"
                        value={searchCategory}
                        onChange={e => setSearchCategory(e.target.value)}
                        placeholder="Type or pick category…"
                        style={{ width: '200px' }}
                        autoComplete="off"
                    />
                    <datalist id="category-filter-options">
                        {categoryOptions.map(c => <option key={c} value={c} />)}
                    </datalist>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <small className="muted">Notes</small>
                    <input value={searchNotes} onChange={e => setSearchNotes(e.target.value)} placeholder="keyword…" style={{ width: '130px' }} />
                </div>
                <label className="tag" style={{ alignSelf: 'flex-end', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={deductOnly}
                        onChange={e => setDeductOnly(e.target.checked)}
                        style={{ width: 'auto', margin: '0 8px 0 0' }}
                    />
                    Deductible only
                </label>
            </div>

            {/* ─── Table ─── */}
            <div style={{ marginTop: '12px', position: 'relative' }}>
                <div className="tableWrap" style={{ maxHeight: 'calc(100vh - 285px)', overflowY: 'auto', overflowX: 'auto' }}>
                    <table style={{ fontSize: '12.5px', tableLayout: 'auto', whiteSpace: 'nowrap' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg, #0b1220)' }}>
                            <tr>
                                <th style={{ width: '58px' }}></th>{/* Edit first */}
                                <th onClick={() => handleSort('expense_date')} style={{ cursor: 'pointer' }}>Date<SortIcon col="expense_date" /></th>
                                <th onClick={() => handleSort('vendor')} style={{ cursor: 'pointer' }}>Vendor<SortIcon col="vendor" /></th>
                                <th onClick={() => handleSort('category')} style={{ cursor: 'pointer' }}>Category<SortIcon col="category" /></th>
                                <th onClick={() => handleSort('tax_bucket')} style={{ cursor: 'pointer' }}>Tax Bucket<SortIcon col="tax_bucket" /></th>
                                <th onClick={() => handleSort('amount_cents')} style={{ cursor: 'pointer' }}>Amount<SortIcon col="amount_cents" /></th>
                                <th>Receipt</th>
                                <th>Type</th>
                                <th>Ded.</th>
                                <th>Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.slice(0, 800).map(r => {
                                const needsReceipt = !r.receipt_link && Number(r.amount_cents || 0) > 7500;
                                return (
                                    <tr key={r.id} style={{ background: needsReceipt ? 'rgba(251,191,36,0.04)' : undefined }}>
                                        <td style={{ padding: '4px 6px' }}>
                                            <button className="btn secondary" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setEditingId(r.id)}>Edit</button>
                                        </td>
                                        <td className="date-col" style={{ whiteSpace: 'nowrap' }}>{formatDate(r.expense_date)}</td>
                                        <td style={{ fontWeight: 600, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.vendor || ''}</td>
                                        <td style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.category || <span className="muted">—</span>}</td>
                                        <td>
                                            {r.tax_bucket
                                                ? <span className="tag" style={{ fontSize: '11px' }}>{r.tax_bucket}{r.business_use_pct && r.business_use_pct !== 100 && !String(r.tax_bucket).includes('%') ? ` (${r.business_use_pct}%)` : ''}</span>
                                                : <span className="muted">—</span>
                                            }
                                        </td>
                                        <td style={{ fontWeight: 700, textAlign: 'right' }}>{formatMoney(r.amount_cents)}</td>
                                        <td>
                                            {r.receipt_link
                                                ? <a className="tag ok" style={{ fontSize: '11px' }} href={r.receipt_link} target="_blank" rel="noreferrer">View</a>
                                                : needsReceipt
                                                    ? <span className="tag warn" style={{ fontSize: '11px' }}>Needed</span>
                                                    : <span className="muted">—</span>
                                            }
                                        </td>
                                        <td>{Number(r.amount_cents || 0) < 0 ? <span className="tag ok" style={{ fontSize: '11px' }}>Income</span> : <span className="tag" style={{ fontSize: '11px' }}>Expense</span>}</td>
                                        <td>{r.tax_deductible ? <span className="tag ok" style={{ fontSize: '11px' }}>Yes</span> : <span className="tag" style={{ fontSize: '11px' }}>No</span>}</td>
                                        <td style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.notes}>{r.notes || <span className="muted">—</span>}</td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && !loading && (
                                <tr><td colSpan={10} className="center muted" style={{ padding: '40px' }}>No transactions found for these filters.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {filtered.length > 800 && (
                    <div className="muted" style={{ marginTop: '8px', textAlign: 'center', fontSize: '12px' }}>
                        Showing first 800 of {filtered.length.toLocaleString()} — narrow filters to see more.
                    </div>
                )}
            </div>

            {/* ─── Import Modal ─── */}
            {showImport && (
                <div style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 9999, padding: '20px'
                }}>
                    <div className="card" style={{
                        width: '100%', maxWidth: '520px',
                        background: 'linear-gradient(180deg, rgba(15,26,51,0.99), rgba(11,18,32,0.97))',
                        border: '1px solid var(--line)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0 }}>⬆ Import Rocket Money CSV</h3>
                            <button className="btn secondary" onClick={() => setShowImport(false)}>Close</button>
                        </div>

                        <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hide" onChange={handleFileSelect} />

                        <div
                            className={`dropzone ${isDragging ? 'drag' : ''}`}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            style={{ textAlign: 'center', padding: '30px 20px' }}
                        >
                            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
                            <div style={{ fontWeight: 800, fontSize: '15px' }}>Drop your CSV file here</div>
                            <div className="muted" style={{ marginTop: '6px' }}>or click to browse files</div>
                        </div>

                        <div className="muted" style={{ marginTop: '12px', fontSize: '12px', lineHeight: 1.6 }}>
                            <strong>Tip:</strong> Export your transactions from Rocket Money as a CSV.
                            Expenses become <span className="mono">positive</span>, income becomes <span className="mono">negative</span>.
                            Duplicate transactions are automatically skipped.
                        </div>

                        {rmMsg && (
                            <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '10px', background: rmMsg.startsWith('✅') ? 'rgba(25,195,125,0.1)' : rmMsg.startsWith('❌') ? 'rgba(255,77,77,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${rmMsg.startsWith('✅') ? 'rgba(25,195,125,0.3)' : rmMsg.startsWith('❌') ? 'rgba(255,77,77,0.3)' : 'var(--line)'}`, fontSize: '13px' }}>
                                {rmMsg}
                            </div>
                        )}

                        {rmErrors.length > 0 && (
                            <div className="tableWrap" style={{ marginTop: '10px', maxHeight: '200px' }}>
                                <table style={{ minWidth: 0 }}>
                                    <thead><tr><th>Row</th><th>Error</th></tr></thead>
                                    <tbody>
                                        {rmErrors.slice(0, 50).map((e, i) => (
                                            <tr key={i}><td>{e.row}</td><td>{e.error}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ─── Edit Drawer ─── */}
            {editingId && (
                <TransactionDrawer
                    transaction={expenses.find(x => x.id === editingId)}
                    onClose={() => setEditingId(null)}
                    onSave={(updated) => {
                        invalidateExpensesCache();
                        setExpenses(prev => prev.map(x => x.id === updated.id ? updated : x));
                    }}
                />
            )}
            {/* ─── Toast Notification (replaces browser alert) ─── */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
                    zIndex: 99999, padding: '14px 22px', borderRadius: '14px',
                    background: 'rgba(15,26,51,0.97)', backdropFilter: 'blur(8px)',
                    border: `1px solid ${toast.ok ? 'rgba(74,222,128,0.4)' : 'rgba(255,77,77,0.4)'}`,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', gap: '12px', maxWidth: '500px'
                }}>
                    <span style={{ fontSize: '20px' }}>{toast.ok ? '✅' : '❌'}</span>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '2px', letterSpacing: '0.08em' }}>EXPENSE TRACKER'S BRAIN SAYS...</div>
                        <div style={{ fontSize: '13px' }}>{toast.msg}</div>
                    </div>
                    <button onClick={() => setToast(null)} style={{ marginLeft: '8px', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '16px' }}>×</button>
                </div>
            )}
        </section>
    );
}
