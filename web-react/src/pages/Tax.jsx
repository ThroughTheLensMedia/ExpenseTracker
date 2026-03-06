import React, { useState, useEffect, useMemo } from 'react';
import { fetchAllExpenses, apiGet, apiPost, formatMoney } from '../api';

// Map specific tax buckets explicitly for Schedule C Form reference
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
    'Meals (50%)': 'Line 24b', // Requires checking business pct / halving
    'Utilities': 'Line 25',
    'Wages': 'Line 26',
    'Other': 'Line 27a',
};

export default function Tax() {
    const [expenses, setExpenses] = useState([]);
    const [selectedYear, setSelectedYear] = useState(2025);
    const [summary, setSummary] = useState([]);

    // Bulk Assign State
    const [bulkCategory, setBulkCategory] = useState('');
    const [bulkBucket, setBulkBucket] = useState('');
    const [bulkDeduct, setBulkDeduct] = useState(true);
    const [bulkPct, setBulkPct] = useState(100);
    const [bulkMsg, setBulkMsg] = useState('');

    const loadData = async () => {
        try {
            const exps = await fetchAllExpenses();
            setExpenses(exps);
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
    }, []);

    useEffect(() => {
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

    const exportCsv = () => {
        window.open(`/api/tax/export.csv?year=${encodeURIComponent(selectedYear)}`, "_blank");
    };

    return (
        <section className="card">
            <h2>Tax Reporting (1040 Schedule C)</h2>
            <div className="muted" style={{ marginBottom: '12px' }}>
                Tax-ready workflow—assign deductible + Schedule C bucket + business-use %—then export summary CSV or use the line items directly for your return.
            </div>

            <div className="controls">
                <div className="grow">
                    <small className="muted">Year</small>
                    <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <button className="btn secondary" onClick={() => loadSummary(selectedYear)}>Refresh</button>
                <button className="btn secondary" onClick={exportCsv}>Export Tax Summary CSV</button>
            </div>

            <div className="grid two" style={{ marginTop: '12px' }}>
                <div className="card" style={{ margin: 0 }}>
                    <h2>Schedule C Summary ({selectedYear})</h2>
                    <div className="tableWrap">
                        <table style={{ minWidth: '760px' }}>
                            <thead>
                                <tr>
                                    <th>Schedule C Line</th>
                                    <th>Tax Bucket</th>
                                    <th>Transactions</th>
                                    <th>Total Spend</th>
                                    <th>Deductible (Biz %)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summary.map(r => (
                                    <tr key={r.tax_bucket}>
                                        <td><span className="tag ok">{SCHEDULE_C_MAPPING[r.tax_bucket] || 'Unknown'}</span></td>
                                        <td>{r.tax_bucket}</td>
                                        <td>{Number(r.count || 0).toLocaleString()}</td>
                                        <td>{formatMoney(r.spend_cents || 0)}</td>
                                        <td style={{ fontWeight: 'bold' }}>{formatMoney(r.deductible_cents || 0)}</td>
                                    </tr>
                                ))}
                                {summary.length === 0 && (
                                    <tr><td colSpan="5" className="muted" style={{ textAlign: 'center' }}>No tax data assigned for this year.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="muted" style={{ marginTop: '8px' }}>
                        Tip—keep "Meals (50%)" bucket at 50% business-use if applicable.
                    </div>
                </div>

                <div className="card" style={{ margin: 0 }}>
                    <h2>Bulk assign by category</h2>
                    <div className="muted" style={{ marginBottom: '10px' }}>
                        Select a category—apply bucket + deductible + business-use % across the selected year.
                    </div>

                    <div className="controls">
                        <select style={{ flex: 1, minWidth: '220px' }} value={bulkCategory} onChange={e => setBulkCategory(e.target.value)}>
                            {categoryOptions.map(cat => (
                                <option key={cat.c} value={cat.c}>{cat.c} ({cat.n})</option>
                            ))}
                        </select>

                        <select style={{ flex: 1, minWidth: '220px' }} value={bulkBucket} onChange={e => setBulkBucket(e.target.value)}>
                            <option value="">Select bucket…</option>
                            {Object.keys(SCHEDULE_C_MAPPING).map(b => (
                                <option key={b} value={b}>{b} ({SCHEDULE_C_MAPPING[b]})</option>
                            ))}
                        </select>

                        <label className="tag" style={{ alignSelf: 'end' }}>
                            <input type="checkbox" checked={bulkDeduct} onChange={e => setBulkDeduct(e.target.checked)} style={{ width: 'auto', margin: '0 8px 0 0' }} />
                            Deductible
                        </label>

                        <label className="tag" style={{ alignSelf: 'end' }}>
                            Biz %
                            <input type="number" min="0" max="100" step="1" value={bulkPct} onChange={e => setBulkPct(e.target.value)} style={{ width: '88px', marginLeft: '8px' }} />
                        </label>

                        <button className="btn secondary" onClick={handleBulkApply}>Apply</button>
                    </div>

                    <div className="muted" style={{ marginTop: '10px', minHeight: '18px' }}>{bulkMsg}</div>
                </div>
            </div>
        </section>
    );
}
