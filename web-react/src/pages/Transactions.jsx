import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchAllExpenses, formatMoney, formatDate, invalidateExpensesCache } from '../api';
import TransactionDrawer from '../components/TransactionDrawer';

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

    // Import
    const fileInputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [rmMsg, setRmMsg] = useState('');
    const [rmErrors, setRmErrors] = useState([]);

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

    const filtered = useMemo(() => {
        let rows = [...expenses];
        if (start) rows = rows.filter(r => formatDate(r.expense_date) >= start);
        if (end) rows = rows.filter(r => formatDate(r.expense_date) <= end);
        if (searchVendor) rows = rows.filter(r => (r.vendor || '').toLowerCase().includes(searchVendor.toLowerCase()));
        if (searchCategory) rows = rows.filter(r => (r.category || '').toLowerCase().includes(searchCategory.toLowerCase()));
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
        setRmMsg('Importing...');
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
            setRmMsg(`Done—inserted ${ins.toLocaleString()}, updated ${upd.toLocaleString()}, skipped ${sk.toLocaleString()}.`);

            if (Array.isArray(data.errors) && data.errors.length) {
                setRmErrors(data.errors);
            }

            invalidateExpensesCache();
            loadData(true);
        } catch (e) {
            setRmMsg(`Import failed: ${e.message}`);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            importRocketMoney(e.dataTransfer.files[0]);
        }
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files[0]) {
            importRocketMoney(e.target.files[0]);
        }
    };

    return (
        <section className="card">
            <h2>
                <span>Transactions</span>
                <span className="muted" style={{ marginLeft: '8px' }}>
                    {filtered.length.toLocaleString()} shown
                </span>
            </h2>

            <div className="controls" style={{ flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <small className="muted">Start Date</small>
                    <input type="date" value={start} onChange={e => setStart(e.target.value)} style={{ width: '150px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <small className="muted">End Date</small>
                    <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={{ width: '150px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <small className="muted">Vendor</small>
                    <input value={searchVendor} onChange={e => setSearchVendor(e.target.value)} placeholder="e.g. USAA" style={{ width: '140px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <small className="muted">Category</small>
                    <input value={searchCategory} onChange={e => setSearchCategory(e.target.value)} placeholder="e.g. Travel" style={{ width: '140px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <small className="muted">Notes</small>
                    <input value={searchNotes} onChange={e => setSearchNotes(e.target.value)} placeholder="keyword…" style={{ width: '130px' }} />
                </div>
                <label className="tag" style={{ alignSelf: 'flex-end' }}>
                    <input
                        type="checkbox"
                        checked={deductOnly}
                        onChange={e => setDeductOnly(e.target.checked)}
                        style={{ width: 'auto', margin: '0 8px 0 0' }}
                    />
                    Deductible only
                </label>
                <div style={{ alignSelf: 'flex-end', display: 'flex', gap: '8px' }}>
                    <button className="btn secondary" onClick={() => { setStart(''); setEnd(''); setSearchVendor(''); setSearchCategory(''); setSearchNotes(''); setDeductOnly(false); }}>Clear</button>
                    <button className="btn secondary" onClick={exportCsv}>Export CSV</button>
                    <button className="btn secondary" onClick={() => loadData(true)} disabled={loading}>Reload</button>
                </div>
            </div>

            <div className="card" style={{ marginTop: '12px' }}>
                <h2 style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' }}>
                    <span>Import Rocket Money CSV</span>
                    <span className="muted">Drag-drop or choose a file</span>
                </h2>

                <div
                    className={`dropzone ${isDragging ? 'drag' : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                >
                    <div style={{ fontWeight: 800 }}>Drop CSV here</div>
                    <div className="muted" style={{ marginTop: '4px' }}>Or click to select a file</div>
                    <div className="muted" style={{ marginTop: '10px' }}>
                        Notes—expenses become <span className="mono">positive</span>, income becomes <span className="mono">negative</span>.
                    </div>
                </div>

                <div className="controls" style={{ marginTop: '10px' }}>
                    <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hide" onChange={handleFileSelect} />
                    <div className="muted" style={{ minHeight: '18px' }}>{rmMsg}</div>
                </div>

                {rmErrors.length > 0 && (
                    <div className="tableWrap" style={{ marginTop: '10px' }}>
                        <table style={{ minWidth: '680px' }}>
                            <thead><tr><th>Row</th><th>Error</th></tr></thead>
                            <tbody>
                                {rmErrors.slice(0, 200).map((e, i) => (
                                    <tr key={i}><td>{e.row}</td><td>{e.error}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="grid two" style={{ marginTop: '12px' }}>
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('expense_date')} style={{ cursor: 'pointer' }}>Date<SortIcon col="expense_date" /></th>
                                <th onClick={() => handleSort('vendor')} style={{ cursor: 'pointer' }}>Vendor<SortIcon col="vendor" /></th>
                                <th onClick={() => handleSort('category')} style={{ cursor: 'pointer' }}>Category<SortIcon col="category" /></th>
                                <th onClick={() => handleSort('tax_bucket')} style={{ cursor: 'pointer' }}>Tax Bucket<SortIcon col="tax_bucket" /></th>
                                <th onClick={() => handleSort('amount_cents')} style={{ cursor: 'pointer' }}>Amount<SortIcon col="amount_cents" /></th>
                                <th>Type</th><th>Deductible</th><th>Receipt</th><th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.slice(0, 800).map(r => (
                                <tr key={r.id}>
                                    <td>{formatDate(r.expense_date)}</td>
                                    <td><strong>{r.vendor || ''}</strong></td>
                                    <td>{r.category || ''}</td>
                                    <td>{r.tax_bucket ? <span className="tag">{r.tax_bucket}</span> : <span className="muted">—</span>}</td>
                                    <td style={{ fontWeight: 'bold' }}>{formatMoney(r.amount_cents)}</td>
                                    <td>{Number(r.amount_cents || 0) < 0 ? <span className="tag ok">Income</span> : <span className="tag">Expense</span>}</td>
                                    <td>{r.tax_deductible ? <span className="tag ok">Yes</span> : <span className="tag">No</span>}</td>
                                    <td>
                                        {r.receipt_link
                                            ? <a className="tag ok" href={r.receipt_link} target="_blank" rel="noreferrer">View</a>
                                            : Number(r.amount_cents || 0) > 7500 ? <span className="tag warn">Needed</span> : <span className="tag">—</span>
                                        }
                                    </td>
                                    <td><button className="btn secondary" onClick={() => setEditingId(r.id)}>Edit</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="txnCards">
                    {filtered.slice(0, 300).map(r => (
                        <div className="txnCard" key={`card-${r.id}`}>
                            <div className="top">
                                <div>
                                    <div className="vendor">{r.vendor || ''}</div>
                                    <div className="muted">{formatDate(r.expense_date)} · {r.category || ''}</div>
                                </div>
                                <div className="amt">{formatMoney(r.amount_cents)}</div>
                            </div>
                            <div style={{ marginTop: '10px' }}>
                                {Number(r.amount_cents || 0) < 0 ? <span className="tag ok" style={{ marginRight: '6px' }}>Income</span> : <span className="tag" style={{ marginRight: '6px' }}>Expense</span>}
                                {r.tax_deductible ? <span className="tag ok" style={{ marginRight: '6px' }}>Deductible</span> : <span className="tag" style={{ marginRight: '6px' }}>No</span>}
                            </div>
                            <div style={{ marginTop: '10px' }}>
                                <button className="btn secondary" onClick={() => setEditingId(r.id)}>Edit</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

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
        </section>
    );
}
