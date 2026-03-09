import React, { useState, useEffect, useMemo } from 'react';
import { fetchAllExpenses, apiGet, apiPost, apiDelete, formatMoney, fetchAllMileage } from '../api';

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

    const loadData = async () => {
        try {
            const [exps, miles, rates] = await Promise.all([
                fetchAllExpenses(),
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
            loadData();
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
        return expenses.filter(e =>
            e.tax_bucket === auditingBucket &&
            String(e.expense_date || '').startsWith(String(selectedYear))
        );
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
                    <button className="btn secondary" onClick={() => { loadData(); loadSummary(selectedYear); }}>Refresh</button>
                    <button className="btn secondary" onClick={exportCsv}>Export Line-Item CSV</button>
                </div>
            </div>

            {/* ── Schedule C Summary — full width ── */}
            <div className="card">
                <h2>Schedule C Summary ({selectedYear})</h2>
                <div className="tableWrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Line</th>
                                <th>Tax Bucket</th>
                                <th>Total Spend</th>
                                <th>Deductible</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {summary.map(r => (
                                <tr key={r.tax_bucket}>
                                    <td><span className="tag ok">{SCHEDULE_C_MAPPING[r.tax_bucket] || '—'}</span></td>
                                    <td>{r.tax_bucket}</td>
                                    <td>{formatMoney(r.spend_cents || 0)}</td>
                                    <td style={{ fontWeight: 'bold' }}>{formatMoney(r.deductible_cents || 0)}</td>
                                    <td><button className="btn sm" onClick={() => setAuditingBucket(r.tax_bucket === auditingBucket ? null : r.tax_bucket)}>
                                        {auditingBucket === r.tax_bucket ? 'Close' : 'Audit'}
                                    </button></td>
                                </tr>
                            ))}
                            {summary.length === 0 && (
                                <tr><td colSpan="5" className="muted" style={{ textAlign: 'center' }}>No tax data assigned yet — use Bulk Assign below.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Audit drill-down */}
                {auditingBucket && (
                    <div className="card" style={{ marginTop: '16px', background: 'rgba(255,255,255,0.03)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <h3 style={{ margin: 0 }}>Auditing: {auditingBucket}</h3>
                            <button className="btn sm outline" onClick={() => setAuditingBucket(null)}>Close</button>
                        </div>
                        <div className="tableWrap">
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
                                            <td>{formatMoney(Math.round(e.amount_cents * (e.business_use_pct / 100)))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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

