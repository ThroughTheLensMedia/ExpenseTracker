import React, { useState, useEffect, useMemo } from 'react';
import { fetchAllExpenses, apiGet, apiPost, apiPatch, apiDelete, formatMoney, fetchAllMileage, invalidateExpensesCache } from '../api';
import TransactionDrawer from '../components/TransactionDrawer';
import { useModal } from '../components/ModalContext.jsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

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
    'Personal Expense': 'Non-Business',
};

const IRS_GUIDELINES = {
    'Advertising': 'Includes ad agency fees, business cards, billboards, website hosting, SEO services, and promotional materials.',
    'Car and truck': 'Covers gas, oil, repairs, insurance, and plates if using actual expenses (note: mileage method usually covers these).',
    'Commissions and fees': 'Payments to agents, booking fees, or referral fees paid to other photographers.',
    'Contract labor': 'Payments to 1099 contractors, second shooters, or assistants. (Do not include employees).',
    'Depreciation': 'Annual deduction for the cost of equipment (Cameras, Lenses, Computers) over its useful life.',
    'Insurance': 'Professional liability, business property, equipment insurance, and business health insurance.',
    'Interest': 'Business-related mortgage interest or interest on business loans/credit cards.',
    'Legal and professional': 'CPA fees, bookkeepers, attorneys, and tax preparation fees for your business.',
    'Office expense': 'Postage, cloud storage (iCloud/Dropbox for biz), software (Adobe), and stationary.',
    'Rent/lease': 'Rent for studio space, office space, or equipment rentals.',
    'Repairs and maintenance': 'Camera servicing, sensor cleanings, or repairs to your studio space.',
    'Supplies': 'Materials used in photography like props, backdrops, memory cards, and hard drives.',
    'Taxes and licenses': 'Business licenses, local taxes, annual reports, and copyright registration fees.',
    'Travel': 'Lodging and transportation (airfare/Uber) for business trips away from your home city.',
    'Meals (50%)': 'Business-related meals with clients or while traveling. Capped at 50% deduction.',
    'Utilities': 'Includes business portion of cell phone, internet, and studio utilities.',
    'Wages': 'Salaries and wages paid to employees (not yourself as a sole proprietor).',
    'Other': 'Miscellaneous business expenses that do not fit into other specific categories.',
    'Personal Expense': 'Non-deductible personal transactions. Tracking these helps clear the "Unassigned" list without affecting your business net profit.',
};

// IRS rates are loaded from the DB (mileage_rates table) – no more hardcoding!

export default function Tax() {
    const [expenses, setExpenses] = useState([]);
    const [selectedYear, setSelectedYear] = useState(2025);
    const modal = useModal();
    const [summary, setSummary] = useState([]);
    const [mileage, setMileage] = useState([]);
    const [mileageRates, setMileageRates] = useState([]);
    const [mileageInput, setMileageInput] = useState({ date: new Date().toISOString().slice(0, 10), miles: '', purpose: '' });
    const [syncStatus, setSyncStatus] = useState('');
    const [manualRate, setManualRate] = useState({ year: new Date().getFullYear(), rate: '' });

    // Auditing
    const [auditingBucket, setAuditingBucket] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [showIncomeAudit, setShowIncomeAudit] = useState(false);
    const [markingRefundId, setMarkingRefundId] = useState(null);

    // Manual 1099 / outside income
    const [manual1099, setManual1099] = useState('');

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
            await modal.alert('Error auto-mapping categories. Check the console for details.');
        } finally {
            setAutoMapping(false);
        }
    };

    const exportCsv = () => {
        window.open(`/api/tax/export.csv?year=${encodeURIComponent(selectedYear)}`, "_blank");
    };

    const [ratesOpen, setRatesOpen] = useState(false);

    const exportPdf = () => {
        const doc = new jsPDF();
        const year = selectedYear;
        const blue = [99, 102, 241];

        // ─── Header ───
        doc.setFontSize(22);
        doc.setTextColor(30, 41, 59);
        doc.text(`Tax Report: ${year}`, 14, 22);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text("Through The Lens Media · Photography Business Summary (Schedule C)", 14, 28);
        doc.setLineWidth(0.5);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 32, 196, 32);

        // ─── Financial stats calculation ───
        const incomeRows = expenses.filter(e => String(e.expense_date || '').startsWith(String(year)) && Number(e.amount_cents || 0) < 0 && e.tax_deductible === true);
        const transactionIncome = incomeRows.reduce((s, e) => s + Math.abs(Number(e.amount_cents || 0)), 0);
        const extraIncome = Math.round(parseFloat(manual1099 || 0) * 100);
        const grossReceipts = transactionIncome + extraIncome;
        const totalDeductible = summary.reduce((s, r) => {
            const line = SCHEDULE_C_MAPPING[r.tax_bucket];
            const isLineItem = line && line.startsWith('Line');
            return s + (isLineItem ? (r.deductible_cents || 0) : 0);
        }, 0);
        const mileageDeductCents = Math.round(totalMiles * currentRate * 100);
        const totalExpenses = totalDeductible + mileageDeductCents;
        const netProfit = grossReceipts - totalExpenses;

        // ─── Executive Summary ───
        doc.setFontSize(14);
        doc.setTextColor(30, 41, 59);
        doc.text("Executive Summary", 14, 45);

        doc.autoTable({
            startY: 50,
            head: [['Line Item', 'Description', 'Value']],
            body: [
                ['Line 7', 'Gross Income (Transactions + Manual)', formatMoney(grossReceipts)],
                ['Line 28', 'Total Expenses (Deductions + Mileage)', formatMoney(totalExpenses)],
                ['Line 31', 'Net Profit or Loss', { content: formatMoney(netProfit), styles: { fontStyle: 'bold', textColor: netProfit >= 0 ? [21, 128, 61] : [220, 38, 38] } }]
            ],
            theme: 'grid',
            headStyles: { fillColor: blue, textColor: 255 },
            columnStyles: {
                0: { cellWidth: 25 },
                2: { halign: 'right', fontStyle: 'bold' }
            }
        });

        // ─── Detailed Expense Breakdown ───
        doc.setFontSize(14);
        doc.setTextColor(30, 41, 59);
        doc.text("Line-Item Detail (Schedule C Form)", 14, doc.lastAutoTable.finalY + 15);

        const tableBody = Object.entries(SCHEDULE_C_MAPPING).map(([bucket, line]) => {
            const row = summary.find(r => r.tax_bucket === bucket);
            const deduct = row?.deductible_cents || 0;
            return [line, bucket, formatMoney(deduct)];
        }).filter(r => r[2] !== '$0.00' && r[2] !== '-$0.00');

        if (mileageDeductCents > 0) {
            tableBody.push(['Line 9', `Car & Truck (Mileage: ${totalMiles} mi)`, formatMoney(mileageDeductCents)]);
        }

        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 20,
            head: [['Line', 'IRS Category', 'Deduction Amount']],
            body: tableBody,
            theme: 'striped',
            headStyles: { fillColor: [51, 65, 85] },
            columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } }
        });

        // ─── Footer / Disclaimer ───
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Generated on ${new Date().toLocaleDateString()} · Page ${i} of ${pageCount}`, 14, 285);
            doc.text("Disclaimer: This report is for informational purposes only. Consult with a tax professional for official IRS filing.", 14, 290);
        }

        doc.save(`ThroughTheLens_TaxReport_${year}.pdf`);
    };

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
                    <button className="btn secondary" onClick={exportCsv}>CSV Export</button>
                    <button className="btn primary" onClick={exportPdf}>📄 Download PDF Report</button>
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
                        <button className="btn secondary" onClick={exportCsv}>CSV</button>
                        <button className="btn primary" onClick={exportPdf}>📄 PDF Report</button>
                    </div>
                </div>

                {/* Part I — Gross Income */}
                {(() => {
                    const incomeRows = expenses.filter(e =>
                        String(e.expense_date || '').startsWith(String(selectedYear)) &&
                        Number(e.amount_cents || 0) < 0 &&
                        e.tax_deductible === true
                    );
                    const transactionIncome = incomeRows.reduce((s, e) => s + Math.abs(Number(e.amount_cents || 0)), 0);
                    const extraIncome = Math.round(parseFloat(manual1099 || 0) * 100);
                    const grossReceipts = transactionIncome + extraIncome;
                    const totalDeductible = summary.reduce((s, r) => {
                        const line = SCHEDULE_C_MAPPING[r.tax_bucket];
                        const isLineItem = line && line.startsWith('Line');
                        return s + (isLineItem ? (r.deductible_cents || 0) : 0);
                    }, 0);
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

                                {/* Line 1 — clickable to audit */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                    <span><strong>Line 1</strong> · Gross receipts or sales</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <button
                                            className="btn sm"
                                            onClick={() => setShowIncomeAudit(true)}
                                            title={`${incomeRows.length} transaction(s) from Rocket Money`}
                                        >
                                            Audit ({incomeRows.length} txns)
                                        </button>
                                        <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{formatMoney(grossReceipts)}</span>
                                    </div>
                                </div>

                                {/* Manual 1099 income entry */}
                                <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '8px', letterSpacing: '0.05em' }}>+ ADD 1099 / OUTSIDE INCOME (not in Rocket Money)</div>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={manual1099}
                                            onChange={e => setManual1099(e.target.value)}
                                            placeholder="e.g. 4250.00"
                                            style={{ width: '160px', fontSize: '13px' }}
                                        />
                                        <span className="muted" style={{ fontSize: '12px' }}>
                                            e.g. your 1099 total, cash payments, Wise transfers not synced to RM
                                        </span>
                                        {extraIncome > 0 && (
                                            <span className="tag ok" style={{ fontSize: '12px' }}>+{formatMoney(extraIncome)} added</span>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', marginTop: '8px' }}>
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
                                                const irsTip = IRS_GUIDELINES[bucket] || "General business expenses.";
                                                return (
                                                    <tr key={bucket} style={{ opacity: isEmpty ? 0.45 : 1 }}>
                                                        <td>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <span className={`tag ${!isEmpty ? 'ok' : ''}`} style={{ fontSize: '0.75rem' }}>{line}</span>
                                                                <span title={irsTip} style={{ cursor: 'help', fontSize: '10px', opacity: 0.6 }}>ℹ️</span>
                                                            </div>
                                                        </td>
                                                        <td style={{ fontWeight: isEmpty ? 400 : 600 }}>
                                                            {bucket}
                                                            {bucket === 'Depreciation' && (
                                                                <div style={{ fontSize: '9px', color: 'var(--accent)', fontWeight: 600, marginTop: '2px', opacity: 0.8 }}>Pulls from Assets ↗</div>
                                                            )}
                                                        </td>
                                                        <td style={{ textAlign: 'right' }}>{isEmpty ? '—' : formatMoney(spend)}</td>
                                                        <td style={{ textAlign: 'right', fontWeight: 700, color: deduct > 0 ? '#4ade80' : 'inherit' }}>
                                                            {isEmpty ? '—' : formatMoney(deduct)}
                                                        </td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            {!isEmpty && (
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                                                    <button className="btn sm secondary" onClick={() => setAuditingBucket(bucket === auditingBucket ? null : bucket)} style={{ fontSize: '10px', padding: '4px 8px' }}>
                                                                        {auditingBucket === bucket ? 'Close' : 'Details'}
                                                                    </button>
                                                                </div>
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
                            width: '100%', maxWidth: '900px', height: '85vh',
                            display: 'flex', flexDirection: 'column',
                            background: 'var(--bg-card)', padding: '0', overflow: 'hidden'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ margin: 0 }}>📊 {SCHEDULE_C_MAPPING[auditingBucket]}: {auditingBucket}</h3>
                                    <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(99,102,241,0.08)', borderRadius: '8px', borderLeft: '3px solid var(--accent)', fontSize: '12px', color: 'var(--text)' }}>
                                        <strong>IRS Guidance:</strong> {IRS_GUIDELINES[auditingBucket] || 'Ensure these items directly relate to your photography business operations.'}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                                    <button className="btn sm secondary" onClick={() => setAuditingBucket(null)}>Close Details</button>
                                    {auditingBucket === 'Depreciation' && (
                                        <div style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>
                                            *Pulls from Equipment assets
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="tableWrap" style={{ flex: 1, overflowY: 'auto', borderRadius: '0', border: 'none', padding: '0 20px 20px 20px' }}>
                                <table className="sm">
                                    <thead>
                                        <tr><th style={{ position: 'sticky', top: 0, background: 'var(--bg)' }}>Date</th><th style={{ position: 'sticky', top: 0, background: 'var(--bg)' }}>Vendor</th><th style={{ position: 'sticky', top: 0, background: 'var(--bg)' }}>Amount</th><th style={{ position: 'sticky', top: 0, background: 'var(--bg)' }}>Biz %</th><th style={{ position: 'sticky', top: 0, background: 'var(--bg)' }}>Deductible</th><th style={{ position: 'sticky', top: 0, background: 'var(--bg)' }}></th></tr>
                                    </thead>
                                    <tbody>
                                        {filteredAuditing.map(e => (
                                            <tr key={e.id}>
                                                <td>{e.expense_date}</td>
                                                <td>{e.vendor}</td>
                                                <td>{formatMoney(e.amount_cents)}</td>
                                                <td>{e.business_use_pct}%</td>
                                                <td style={{ fontWeight: 'bold', color: '#4ade80' }}>{formatMoney(Math.round(e.amount_cents * (e.business_use_pct / 100)))}</td>
                                                <td><button className="btn sm secondary" onClick={() => setEditingId(e.id)}>Edit</button></td>
                                            </tr>
                                        ))}
                                        {filteredAuditing.length === 0 && (
                                            <tr><td colSpan={6} className="muted center">No transactions in this bucket for {selectedYear}</td></tr>
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
            {/* Income Audit Modal */}
            {showIncomeAudit && (() => {
                const incomeRows = expenses.filter(e =>
                    String(e.expense_date || '').startsWith(String(selectedYear)) &&
                    Number(e.amount_cents || 0) < 0 &&
                    e.tax_deductible === true
                );
                const transactionIncome = incomeRows.reduce((s, e) => s + Math.abs(Number(e.amount_cents || 0)), 0);
                const extraIncome = Math.round(parseFloat(manual1099 || 0) * 100);
                return (
                    <div style={{
                        position: 'fixed', inset: 0,
                        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 9999, padding: '20px'
                    }}>
                        <div className="card" style={{
                            width: '100%', maxWidth: '860px', height: '82vh',
                            display: 'flex', flexDirection: 'column',
                            background: 'linear-gradient(180deg,rgba(15,26,51,0.99),rgba(11,18,32,0.97))',
                            padding: 0, overflow: 'hidden'
                        }}>
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                <div>
                                    <h3 style={{ margin: 0 }}>💰 Income Audit — {selectedYear}</h3>
                                    <div className="muted" style={{ marginTop: '4px', fontSize: '12px' }}>
                                        Transactions flagged as Tax Deductible with negative amounts (income)
                                    </div>
                                </div>
                                <button className="btn secondary" onClick={() => setShowIncomeAudit(false)}>Close</button>
                            </div>

                            {/* Summary bar */}
                            <div style={{ display: 'flex', gap: '16px', padding: '14px 24px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.07)', flexWrap: 'wrap' }}>
                                <div className="stat" style={{ flex: 1, minWidth: '140px' }}>
                                    <div className="k">Rocket Money Transactions</div>
                                    <div className="v" style={{ color: '#4ade80', fontSize: '18px' }}>{formatMoney(transactionIncome)}</div>
                                    <div className="muted" style={{ fontSize: '11px' }}>{incomeRows.length} transactions</div>
                                </div>
                                <div className="stat" style={{ flex: 1, minWidth: '140px' }}>
                                    <div className="k">Manual 1099 / Outside Income</div>
                                    <div className="v" style={{ color: '#facc15', fontSize: '18px' }}>{extraIncome > 0 ? formatMoney(extraIncome) : '—'}</div>
                                    <div className="muted" style={{ fontSize: '11px' }}>entered below on Tax tab</div>
                                </div>
                                <div className="stat" style={{ flex: 1, minWidth: '140px' }}>
                                    <div className="k">Total Line 1 Income</div>
                                    <div className="v" style={{ color: '#4ade80', fontSize: '18px' }}>{formatMoney(transactionIncome + extraIncome)}</div>
                                </div>
                            </div>

                            {/* Table */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 20px' }}>
                                {incomeRows.length === 0 ? (
                                    <div style={{ padding: '40px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
                                        <div className="muted">No income transactions found for {selectedYear}.</div>
                                        <div className="muted" style={{ marginTop: '8px', fontSize: '12px' }}>
                                            To add income: go to Transactions, find your income deposit, click Edit, check "Tax Deductible", and set the Category to "Photo Income" or similar.
                                        </div>
                                    </div>
                                ) : (
                                    <table style={{ marginTop: '12px' }}>
                                        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg)' }}>
                                            <tr>
                                                <th>Date</th>
                                                <th>Vendor / Source</th>
                                                <th>Category</th>
                                                <th style={{ textAlign: 'right' }}>Amount</th>
                                                <th>Notes</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {incomeRows.map(e => (
                                                <tr key={e.id}>
                                                    <td className="date-col">{e.expense_date}</td>
                                                    <td><strong>{e.vendor}</strong></td>
                                                    <td><span className="tag ok">{e.category || 'Income'}</span></td>
                                                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#4ade80' }}>{formatMoney(Math.abs(e.amount_cents))}</td>
                                                    <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={e.notes}>{e.notes || <span className="muted">—</span>}</td>
                                                    <td style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                        <button
                                                            className="btn secondary"
                                                            style={{ fontSize: '11px', padding: '4px 10px' }}
                                                            onClick={() => setEditingId(e.id)}
                                                        >Edit</button>
                                                        <button
                                                            className="btn"
                                                            disabled={markingRefundId === e.id}
                                                            style={{
                                                                fontSize: '11px', padding: '4px 10px',
                                                                background: 'rgba(251,191,36,0.15)',
                                                                border: '1px solid rgba(251,191,36,0.4)',
                                                                color: '#facc15'
                                                            }}
                                                            title="Mark this as a refund or return — removes it from your income total"
                                                            onClick={async () => {
                                                                const ok = await modal.confirm(`Mark "${e.vendor}" as a Refund? This removes it from your Line 1 income total. You can undo this any time via Edit.`);
                                                                if (!ok) return;
                                                                setMarkingRefundId(e.id);
                                                                try {
                                                                    const updated = await apiPatch(`/expenses/${e.id}`, {
                                                                        tax_deductible: false,
                                                                        category: 'Refund'
                                                                    });
                                                                    invalidateExpensesCache();
                                                                    setExpenses(prev => prev.map(x => x.id === updated.id ? updated : x));
                                                                } catch (err) {
                                                                    await modal.alert('Failed: ' + err.message);
                                                                } finally {
                                                                    setMarkingRefundId(null);
                                                                }
                                                            }}
                                                        >
                                                            {markingRefundId === e.id ? 'Saving…' : '↩ Refund'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {editingId && (
                <TransactionDrawer
                    transaction={expenses.find(x => x.id === editingId)}
                    onClose={() => setEditingId(null)}
                    onSave={(updated) => {
                        invalidateExpensesCache();
                        setExpenses(prev => prev.map(x => x.id === updated.id ? updated : x));
                        loadSummary(selectedYear); // Re-calculate schedule C totals
                    }}
                />
            )}
        </section>
    );
}

