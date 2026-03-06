import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchAllExpenses, formatMoney, formatDate } from '../api';
import TransactionDrawer from '../components/TransactionDrawer';

export default function Transactions() {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [search, setSearch] = useState('');
    const [deductOnly, setDeductOnly] = useState(false);

    // Editor
    const [editingId, setEditingId] = useState(null);

    // Import
    const fileInputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [rmMsg, setRmMsg] = useState('');
    const [rmErrors, setRmErrors] = useState([]);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await fetchAllExpenses();
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

    const filtered = useMemo(() => {
        let rows = [...expenses].sort((a, b) => (b.expense_date || '').localeCompare(a.expense_date || ''));
        if (start) rows = rows.filter(r => formatDate(r.expense_date) >= start);
        if (end) rows = rows.filter(r => formatDate(r.expense_date) <= end);
        if (search) {
            const q = search.toLowerCase();
            rows = rows.filter(r => {
                const hay = `${r.vendor || ''} ${r.category || ''} ${r.notes || ''}`.toLowerCase();
                return hay.includes(q);
            });
        }
        if (deductOnly) rows = rows.filter(r => r.tax_deductible);
        return rows;
    }, [expenses, start, end, search, deductOnly]);

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

            loadData();
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

            <div className="controls">
                <div className="grow">
                    <small className="muted">Start</small>
                    <input value={start} onChange={e => setStart(e.target.value)} placeholder="YYYY-MM-DD" />
                </div>
                <div className="grow">
                    <small className="muted">End</small>
                    <input value={end} onChange={e => setEnd(e.target.value)} placeholder="YYYY-MM-DD" />
                </div>
                <div className="grow">
                    <small className="muted">Search</small>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Vendor, category, notes…" />
                </div>
                <label className="tag" style={{ alignSelf: 'end' }}>
                    <input
                        type="checkbox"
                        checked={deductOnly}
                        onChange={e => setDeductOnly(e.target.checked)}
                        style={{ width: 'auto', margin: '0 8px 0 0' }}
                    />
                    Deductible only
                </label>
                <button className="btn secondary" onClick={exportCsv}>Export CSV</button>
                <button className="btn secondary" onClick={loadData} disabled={loading}>Reload</button>
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
                                <th>Date</th><th>Vendor</th><th>Category</th><th>Amount</th>
                                <th>Type</th><th>Deductible</th><th>Receipt</th><th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.slice(0, 800).map(r => (
                                <tr key={r.id}>
                                    <td>{formatDate(r.expense_date)}</td>
                                    <td>{r.vendor || ''}</td>
                                    <td>{r.category || ''}</td>
                                    <td>{formatMoney(r.amount_cents)}</td>
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
                        setExpenses(prev => prev.map(x => x.id === updated.id ? updated : x));
                    }}
                />
            )}
        </section>
    );
}
