import React, { useState, useEffect, useMemo } from 'react';
import { fetchAllExpenses, apiGet, apiPost, apiDelete, formatMoney, fetchAllMileage, invalidateExpensesCache } from '../api';

const SCHEDULE_C_MAPPING = {
    'Advertising': 'Line 8',
    'Car and truck': 'Line 9',
    'Commissions and fees': 'Line 10',
    'Contract labor': 'Line 11',
    'Depreciation': 'Line 13',
    'Insurance': 'Line 15',
    'Interest': 'Line 16b',
    'Legal and professional': 'Line 17',
    'Office expense': 'Line 18',
    'Rent/lease': 'Line 20b',
    'Repairs and maintenance': 'Line 21',
    'Supplies': 'Line 22',
    'Taxes and licenses': 'Line 23',
    'Travel': 'Line 24a',
    'Meals (50%)': 'Line 24b',
    'Utilities': 'Line 25',
    'Wages': 'Line 26',
    'Other': 'Line 27a',
};

// IRS rates are loaded from the DB (mileage_rates table) – no more hardcoding!

export default function Tax() {
    const [expenses, setExpenses] = useState([]);
    const [selectedYear, setSelectedYear] = useState(2025);
    const [summary, setSummary] = useState([]);
    const [mileage, setMileage] = useState([]);
    const [mileageRates, setMileageRates] = useState([]);
    const [mileageInput, setMileageInput] = useState({ date: new Date().toISOString().slice(0, 10), miles: '', purpose: '' });
    const [syncStatus, setSyncStatus] = useState('');
    const [manualRate, setManualRate] = useState({ year: new Date().getFullYear(), rate: '' });

    // Auditing
    const [auditingBucket, setAuditingBucket] = useState(null);

    // Bulk Assign State
    const [bulkCategory, setBulkCategory] = useState('');
    const [bulkBucket, setBulkBucket] = useState('');
    const [bulkDeduct, setBulkDeduct] = useState(true);
    const [bulkPct, setBulkPct] = useState(100);
    const [bulkMsg, setBulkMsg] = useState('');

    const loadData = async (force = false) => {
        try {
            const [exps, miles, rates] = await Promise.all([
                fetchAllExpenses(force),
                fetchAllMileage(selectedYear),
                apiGet('/mileage/rates')
            ]);
            setExpenses(exps);
            setMileage(miles);
            setMileageRates(rates);
        } catch (e) {
            console.error(e);
        }
    };

    const loadSummary = async (year) => {
        try {
            const data = await apiGet(`/tax/summary?year=${encodeURIComponent(year)}`);
            setSummary(data.totals || []);
        } catch (e) {
            setSummary([]);
        }
    };

    useEffect(() => {
        loadData();
        loadSummary(selectedYear);
    }, [selectedYear]);

    const years = useMemo(() => {
        const set = new Set();
        for (const r of expenses) {
            const y = Number(String(r.expense_date || '').slice(0, 4));
            if (y) set.add(y);
        }
        const arr = [...set].sort((a, b) => b - a);
        if (!arr.includes(2025)) arr.push(2025);
        return arr.sort((a, b) => b - a);
    }, [expenses]);

    const categoryOptions = useMemo(() => {
        const cats = new Map();
        for (const r of expenses) {
            if (!String(r.expense_date || '').startsWith(String(selectedYear))) continue;
            const c = (r.category || '').trim();
            if (!c) continue;
            cats.set(c, (cats.get(c) || 0) + 1);
        }
        const list = [...cats.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => ({ c, n }));
        if (list.length > 0 && !bulkCategory) setBulkCategory(list[0].c);
        return list;
    }, [expenses, selectedYear]);

    const handleBulkApply = async () => {
        setBulkMsg("Applying...");
        try {
            const data = await apiPost("/tax/assign", {
                year: selectedYear,
                category: bulkCategory,
                tax_bucket: bulkBucket,
                tax_deductible: bulkDeduct,
                business_use_pct: Number(bulkPct)
            });
            setBulkMsg(`Updated ${Number(data.updated || 0).toLocaleString()} transactions.`);
            invalidateExpensesCache();
            loadData(true);
            loadSummary(selectedYear);
        } catch (err) {
            setBulkMsg(`Apply failed: ${err.message}`);
        }
    };

    const handleAddMileage = async () => {
        if (!mileageInput.miles || !mileageInput.purpose) return;
        try {
            await apiPost("/mileage", {
                log_date: mileageInput.date,
                miles: Number(mileageInput.miles),
                purpose: mileageInput.purpose
            });
            setMileageInput({ ...mileageInput, miles: '', purpose: '' });
            const miles = await fetchAllMileage(selectedYear);
            setMileage(miles);
        } catch (err) {
            console.error("Mileage failed:", err);
        }
    };

    const handleDeleteMileage = async (id) => {
        try {
            await apiDelete(`/mileage/${id}`);
            const miles = await fetchAllMileage(selectedYear);
            setMileage(miles);
        } catch (err) {
            console.error("Delete failed:", err);
        }
    };

    const totalMiles = mileage.reduce((sum, m) => sum + Number(m.miles || 0), 0);
    const currentRate = mileageRates.find(r => r.year === selectedYear)?.rate_per_mile ?? 0.70;
    const mileageDeduction = totalMiles * currentRate;

    const filteredAuditing = useMemo(() => {
        if (!auditingBucket) return [];
        return expenses.filter(e => {
            const rowBucket = (e.tax_bucket || '').trim() || 'Unassigned';
            return rowBucket === auditingBucket && String(e.expense_date || '').startsWith(String(selectedYear));
        });
    }, [expenses, auditingBucket, selectedYear]);

    const handleSyncIRS = async () => {
        setSyncStatus('Checking IRS.gov...');
        try {
            const result = await apiPost('/mileage/rates/sync', {});
            setSyncStatus(`✅ Updated: ${result.year} = $${Number(result.rate_per_mile).toFixed(2)}/mile`);
            const rates = await apiGet('/mileage/rates');
            setMileageRates(rates);
        } catch (err) {
            setSyncStatus(`⚠️ ${err.message}`);
        }
    };

    const handleManualRate = async () => {
        if (!manualRate.rate) return;
        try {
            await apiPost('/mileage/rates', { year: manualRate.year, rate_per_mile: manualRate.rate });
            setSyncStatus(`✅ Saved: ${manualRate.year} = $${Number(manualRate.rate).toFixed(2)}/mile`);
            const rates = await apiGet('/mileage/rates');
            setMileageRates(rates);
            setManualRate({ year: new Date().getFullYear(), rate: '' });
        } catch (err) {
            setSyncStatus(`⚠️ ${err.message}`);
        }
    };

    const [autoMapping, setAutoMapping] = useState(false);

    const handleAutoMap = async () => {
        if (!confirm("Auto-map standard Rocket Money categories (like Gas, Utilities, Travel) to Schedule C lines? This only affects unassigned transactions.")) return;
        setAutoMapping(true);
        try {
            await apiPost('/tax/auto-map', {});
            invalidateExpensesCache();
            await loadData(true);
            await loadSummary(selectedYear);
        } catch (e) {
            console.error(e);
            alert("Error auto-mapping categories.");
        } finally {
            setAutoMapping(false);
        }
    };

    const exportCsv = () => {
        window.open(`/api/tax/export.csv?year=${encodeURIComponent(selectedYear)}`, "_blank");
    };

    const [ratesOpen, setRatesOpen] = useState(false);

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* ── Header / Year / Export ── */}
            <div className="card">
                <h2>Tax Reporting (1040 Schedule C)</h2>
                <div className="muted" style={{ marginBottom: '12px' }}>
                    Tax-ready workflow — assign deductible + Schedule C bucket + business-use %, then export line-item CSV for your CPA.
                </div>
                <div className="controls">
                    <div className="grow">
                        <small className="muted">Year</small>
                        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <button className="btn secondary" onClick={() => { loadData(true); loadSummary(selectedYear); }}>Refresh</button>
                    <button className="btn secondary" onClick={exportCsv}>Export Line-Item CSV</button>
                </div>
            </div>

            {/* ── Schedule C — IRS Form Layout ── */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                        <h2 style={{ margin: 0 }}>Schedule C — Profit or Loss from Business ({selectedYear})</h2>
                        <div className="muted small" style={{ marginTop: '4px' }}>
                            Sole Proprietorship · Photography Business · Principal business code: 711510
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {(() => {
                            const unassigned = summary.find(r => r.tax_bucket === 'Unassigned');
                            return unassigned ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span
                                        className="tag warn"
                                        style={{ fontSize: '0.8rem', cursor: 'pointer' }}
                                        onClick={() => setAuditingBucket('Unassigned')}
                                        title="Click to view all unclassified transactions"
                                    >
                                        ⚠ {unassigned.count} unclassified in {selectedYear}
                                    </span>
                                    <button
                                        className="btn outline sm"
                                        onClick={handleAutoMap}
                                        disabled={autoMapping}
                                        style={{ borderColor: 'var(--blue)', color: 'var(--blue)' }}
                                    >
                                        {autoMapping ? 'Mapping…' : '⚡ Auto-Map RM Categories'}
                                    </button>
                                </div>
                            ) : null;
                        })()}
                        <button className="btn secondary" onClick={exportCsv}>⬇ Export CSV</button>
                    </div>
                </div>

                {/* Part I — Gross Income */}
                {(() => {
                    const incomeRows = expenses.filter(e =>
                        String(e.expense_date || '').startsWith(String(selectedYear)) &&
                        Number(e.amount_cents || 0) < 0
                    );
                    const grossReceipts = incomeRows.reduce((s, e) => s + Math.abs(Number(e.amount_cents || 0)), 0);
                    const totalDeductible = summary.reduce((s, r) => s + (r.tax_bucket !== 'Unassigned' ? (r.deductible_cents || 0) : 0), 0);
                    const mileageDeductCents = Math.round(totalMiles * currentRate * 100);
                    const totalExpenses = totalDeductible + mileageDeductCents;
                    const netProfit = grossReceipts - totalExpenses;

                    return (
                        <>
                            {/* Part I */}
                            <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '10px', padding: '16px', marginBottom: '12px' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.1em', color: 'var(--accent, #6366f1)', marginBottom: '12px' }}>
                                    PART I — INCOME
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                    <span><strong>Line 1</strong> · Gross receipts or sales</span>
                                    <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{formatMoney(grossReceipts)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                                    <span className="muted small">Line 7 · Gross income (Line 1 minus returns)</span>
                                    <span style={{ fontWeight: 700 }}>{formatMoney(grossReceipts)}</span>
                                </div>
                            </div>

                            {/* Part II — Expenses */}
                            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px', marginBottom: '12px' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.1em', color: 'var(--accent, #6366f1)', marginBottom: '12px' }}>
                                    PART II — EXPENSES
                                </div>
                                <div className="tableWrap" style={{ maxHeight: 'none' }}>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th style={{ width: '80px' }}>Line</th>
                                                <th>Expense Category</th>
                                                <th style={{ textAlign: 'right' }}>Total Spend</th>
                                                <th style={{ textAlign: 'right' }}>Deductible Amount</th>
                                                <th style={{ width: '80px' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(SCHEDULE_C_MAPPING).map(([bucket, line]) => {
                                                const row = summary.find(r => r.tax_bucket === bucket);
                                                const spend = row?.spend_cents || 0;
                                                const deduct = row?.deductible_cents || 0;
                                                const isEmpty = spend === 0;
                                                return (
                                                    <tr key={bucket} style={{ opacity: isEmpty ? 0.45 : 1 }}>
                                                        <td><span className={`tag ${!isEmpty ? 'ok' : ''}`} style={{ fontSize: '0.75rem' }}>{line}</span></td>
                                                        <td style={{ fontWeight: isEmpty ? 400 : 600 }}>{bucket}</td>
                                                        <td style={{ textAlign: 'right' }}>{isEmpty ? '—' : formatMoney(spend)}</td>
                                                        <td style={{ textAlign: 'right', fontWeight: 700, color: deduct > 0 ? '#4ade80' : 'inherit' }}>
                                                            {isEmpty ? '—' : formatMoney(deduct)}
                                                        </td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            {!isEmpty && (
                                                                <button className="btn sm" onClick={() => setAuditingBucket(bucket === auditingBucket ? null : bucket)}>
                                                                    {auditingBucket === bucket ? 'Close' : 'Audit'}
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {/* Mileage line */}
                                            <tr style={{ borderTop: '2px solid rgba(99,102,241,0.3)' }}>
                                                <td><span className="tag ok" style={{ fontSize: '0.75rem' }}>Line 9</span></td>
                                                <td style={{ fontWeight: 600 }}>Car & Truck — Standard Mileage ({totalMiles.toLocaleString()} mi @ ${currentRate.toFixed(2)})</td>
                                                <td style={{ textAlign: 'right' }}>{formatMoney(mileageDeductCents)}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 700, color: '#4ade80' }}>{formatMoney(mileageDeductCents)}</td>
                                                <td></td>
                                            </tr>
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ borderTop: '2px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.2)' }}>
                                                <td colSpan={2} style={{ fontWeight: 700, padding: '10px 8px' }}>Line 28 · Total Expenses</td>
                                                <td style={{ textAlign: 'right', fontWeight: 700 }}></td>
                                                <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '1.05rem' }}>{formatMoney(totalExpenses)}</td>
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            {/* Net Profit */}
                            <div style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                background: netProfit >= 0 ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
                                border: `1px solid ${netProfit >= 0 ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
                                borderRadius: '10px', padding: '16px 20px'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.1em', color: netProfit >= 0 ? '#4ade80' : '#f87171' }}>
                                        LINE 31 — NET {netProfit >= 0 ? 'PROFIT' : 'LOSS'}
                                    </div>
                                    <div className="muted small">Gross Income − Total Expenses · Transfers to Schedule SE</div>
                                </div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: netProfit >= 0 ? '#4ade80' : '#f87171' }}>
                                    {formatMoney(Math.abs(netProfit))}
                                </div>
                            </div>
                        </>
                    );
                })()}

                {/* Audit drill-down Modal */}
                {auditingBucket && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 9999, padding: '20px'
                    }}>
                        <div className="card" style={{
                            width: '100%', maxWidth: '800px', maxHeight: '80vh',
                            overflowY: 'auto', background: 'var(--bg-card)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
                                <h3 style={{ margin: 0 }}>📋 Audit: {auditingBucket} ({SCHEDULE_C_MAPPING[auditingBucket] || 'Unassigned'})</h3>
                                <button className="btn sm outline" onClick={() => setAuditingBucket(null)}>Close</button>
                            </div>
                            <div className="tableWrap" style={{ maxHeight: 'none' }}>
                                <table className="sm">
                                    <thead>
                                        <tr><th>Date</th><th>Vendor</th><th>Amount</th><th>Biz %</th><th>Deductible</th></tr>
                                    </thead>
                                    <tbody>
                                        {filteredAuditing.map(e => (
                                            <tr key={e.id}>
                                                <td>{e.expense_date}</td>
                                                <td>{e.vendor}</td>
                                                <td>{formatMoney(e.amount_cents)}</td>
                                                <td>{e.business_use_pct}%</td>
                                                <td style={{ fontWeight: 'bold', color: '#4ade80' }}>{formatMoney(Math.round(e.amount_cents * (e.business_use_pct / 100)))}</td>
                                            </tr>
                                        ))}
                                        {filteredAuditing.length === 0 && (
                                            <tr><td colSpan={5} className="muted center">No transactions in this bucket for {selectedYear}</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Bulk Assign — full width ── */}
            <div className="card">
                <h2>Bulk Assign by Category</h2>
                <div className="muted" style={{ marginBottom: '10px' }}>
                    Select a category — apply tax bucket + business-use % across the entire year in one click.
                </div>
                <div className="controls">
                    <select style={{ flex: 1 }} value={bulkCategory} onChange={e => setBulkCategory(e.target.value)}>
                        {categoryOptions.map(cat => (
                            <option key={cat.c} value={cat.c}>{cat.c} ({cat.n})</option>
                        ))}
                    </select>
                    <select style={{ flex: 1 }} value={bulkBucket} onChange={e => setBulkBucket(e.target.value)}>
                        <option value="">Select tax bucket…</option>
                        {Object.keys(SCHEDULE_C_MAPPING).map(b => (
                            <option key={b} value={b}>{b} ({SCHEDULE_C_MAPPING[b]})</option>
                        ))}
                    </select>
                    <label className="tag center">
                        <input type="checkbox" checked={bulkDeduct} onChange={e => setBulkDeduct(e.target.checked)} />
                        Deductible
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span className="muted small">Biz %</span>
                        <input type="number" min="0" max="100" value={bulkPct} onChange={e => setBulkPct(e.target.value)} style={{ width: '60px' }} />
                    </div>
                    <button className="btn secondary" onClick={handleBulkApply}>Apply Bulk Change</button>
                </div>
                {bulkMsg && <div className="tag ok" style={{ marginTop: '10px' }}>{bulkMsg}</div>}
            </div>

            {/* ── Business Mileage Tracking — full width ── */}
            <div className="card">
                <h2>Business Mileage Tracking ({selectedYear})</h2>

                {/* Summary stats */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '18px', flexWrap: 'wrap' }}>
                    <div className="card accent" style={{ flex: 1, textAlign: 'center', padding: '15px', minWidth: '160px' }}>
                        <div className="muted small">Total Business Miles</div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, margin: '5px 0' }}>{totalMiles.toLocaleString()}</div>
                    </div>
                    <div className="card accent" style={{ flex: 1, textAlign: 'center', padding: '15px', minWidth: '160px' }}>
                        <div className="muted small">IRS Rate (${currentRate.toFixed(2)}/mi)</div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, margin: '5px 0' }}>{formatMoney(mileageDeduction * 100)}</div>
                    </div>
                </div>

                {/* Add trip form */}
                <div className="controls" style={{ gap: '8px', marginBottom: '14px' }}>
                    <input type="date" value={mileageInput.date} onChange={e => setMileageInput({ ...mileageInput, date: e.target.value })} style={{ width: '148px' }} />
                    <input type="number" placeholder="Miles" value={mileageInput.miles} onChange={e => setMileageInput({ ...mileageInput, miles: e.target.value })} style={{ width: '90px' }} />
                    <input type="text" placeholder="Purpose (e.g. Wedding Photo Shoot - Las Vegas)" value={mileageInput.purpose} onChange={e => setMileageInput({ ...mileageInput, purpose: e.target.value })} style={{ flex: 1 }} />
                    <button className="btn primary" onClick={handleAddMileage}>Add Trip</button>
                </div>

                {/* Trip log table */}
                <div className="tableWrap" style={{ maxHeight: '320px' }}>
                    <table>
                        <thead>
                            <tr><th>Date</th><th>Miles</th><th>Purpose</th><th>Deduction</th><th></th></tr>
                        </thead>
                        <tbody>
                            {mileage.map(m => (
                                <tr key={m.id}>
                                    <td>{m.log_date}</td>
                                    <td><strong>{Number(m.miles).toLocaleString()}</strong></td>
                                    <td className="muted">{m.purpose}</td>
                                    <td>{formatMoney(Number(m.miles) * currentRate * 100)}</td>
                                    <td><button className="btn sm danger" onClick={() => handleDeleteMileage(m.id)}>×</button></td>
                                </tr>
                            ))}
                            {mileage.length === 0 && (
                                <tr><td colSpan="5" className="muted center">No trips logged for {selectedYear}.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── IRS Standard Mileage Rates — collapsible ── */}
            <div className="card">
                <div
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    onClick={() => setRatesOpen(o => !o)}
                >
                    <div>
                        <h2 style={{ margin: 0 }}>IRS Standard Mileage Rates {ratesOpen ? '▲' : '▼'}</h2>
                        <div className="muted small">Current rate for {selectedYear}: <strong>${currentRate.toFixed(2)}/mile</strong> · Click to {ratesOpen ? 'collapse' : 'expand'}</div>
                    </div>
                    <button className="btn primary" onClick={e => { e.stopPropagation(); handleSyncIRS(); }}>🔄 Sync from IRS.gov</button>
                </div>

                {syncStatus && (
                    <div className="tag" style={{ marginTop: '10px', background: syncStatus.startsWith('✅') ? 'rgba(74,222,128,0.1)' : 'rgba(251,191,36,0.1)', color: syncStatus.startsWith('✅') ? '#4ade80' : '#fbbf24' }}>
                        {syncStatus}
                    </div>
                )}

                {ratesOpen && (
                    <div className="grid two" style={{ gap: '16px', marginTop: '16px' }}>
                        <div>
                            <div className="tableWrap" style={{ maxHeight: '220px' }}>
                                <table className="sm">
                                    <thead>
                                        <tr><th>Year</th><th>Rate/Mile</th><th>Source</th><th>Last Synced</th></tr>
                                    </thead>
                                    <tbody>
                                        {mileageRates.map(r => (
                                            <tr key={r.year} style={r.year === selectedYear ? { background: 'rgba(99,102,241,0.15)' } : {}}>
                                                <td><strong>{r.year}</strong></td>
                                                <td><span className="tag ok">${Number(r.rate_per_mile).toFixed(2)}</span></td>
                                                <td className="muted small">{r.source}</td>
                                                <td className="muted small">{r.last_synced_at?.slice(0, 10)}</td>
                                            </tr>
                                        ))}
                                        {mileageRates.length === 0 && (
                                            <tr><td colSpan="4" className="muted center">No rates — click Sync from IRS.gov.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div>
                            <h3 style={{ marginTop: 0 }}>Add / Override Rate Manually</h3>
                            <div className="muted small" style={{ marginBottom: '10px' }}>Use if sync fails or IRS hasn't published the new year's rate yet.</div>
                            <div className="controls">
                                <input type="number" min="2019" max="2099" placeholder="Year" value={manualRate.year} onChange={e => setManualRate({ ...manualRate, year: Number(e.target.value) })} style={{ width: '80px' }} />
                                <input type="number" step="0.005" min="0" max="5" placeholder="Rate (e.g. 0.70)" value={manualRate.rate} onChange={e => setManualRate({ ...manualRate, rate: e.target.value })} style={{ width: '140px' }} />
                                <button className="btn secondary" onClick={handleManualRate}>Save Rate</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

