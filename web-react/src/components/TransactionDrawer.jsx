import React, { useState, useEffect } from 'react';
import { apiPatch, apiPost } from '../api';
import CategorySelect from './CategorySelect.jsx';
import { ALL_CATEGORIES } from '../constants/categories.js';

export default function TransactionDrawer({ transaction, onClose, onSave }) {
    const [date, setDate] = useState('');
    const [amount, setAmount] = useState('');
    const [vendor, setVendor] = useState('');
    const [category, setCategory] = useState('');
    const [taxBucket, setTaxBucket] = useState('');
    const [bizPct, setBizPct] = useState(100);
    const [deduct, setDeduct] = useState(false);
    const [notes, setNotes] = useState('');
    const [receiptLink, setReceiptLink] = useState('');
    const [receiptFile, setReceiptFile] = useState(null);
    const [msg, setMsg] = useState('');

    useEffect(() => {
        if (transaction) {
            setDate(String(transaction.expense_date || '').slice(0, 10));
            setAmount((Number(transaction.amount_cents || 0) / 100).toFixed(2));
            setVendor(transaction.vendor || '');
            setCategory(transaction.category || '');
            setTaxBucket(transaction.tax_bucket || '');
            setBizPct(transaction.business_use_pct == null ? 100 : transaction.business_use_pct);
            setDeduct(!!transaction.tax_deductible);
            setNotes(transaction.notes || '');
            setReceiptLink(transaction.receipt_link || '');
            setMsg('');
        }
    }, [transaction]);

    const handleSave = async () => {
        setMsg("Saving...");
        try {
            const payload = {
                expense_date: date,
                vendor, category,
                amount_cents: Math.round(Number(amount || 0) * 100),
                tax_deductible: deduct,
                tax_bucket: taxBucket,
                business_use_pct: Number(bizPct),
                notes,
                receipt_link: receiptLink || null,
            };

            let updated;
            if (transaction.id) {
                updated = await apiPatch(`/expenses/${transaction.id}`, payload);
            } else {
                updated = await apiPost('/expenses', payload);
            }

            setMsg("Saved.");
            if (onSave) onSave(updated);
            if (!transaction.id) {
                // For new transactions, close after a brief delay so user sees "Saved"
                setTimeout(onClose, 800);
            }
        } catch (err) {
            setMsg(`Save failed: ${err.message}`);
        }
    };

    const handleUpload = async () => {
        if (!receiptFile) { setMsg("Choose a file first."); return; }
        setMsg("Uploading...");
        try {
            const fd = new FormData();
            fd.append("file", receiptFile);
            const r = await fetch(`/api/receipts/${transaction.id}`, {
                method: "POST",
                credentials: "include",
                body: fd
            });
            if (!r.ok) {
                const j = await r.json().catch(() => ({}));
                throw new Error((j && j.error) ? j.error : `${r.status} ${r.statusText}`);
            }
            const updated = await r.json();
            setMsg("Receipt uploaded.");
            if (onSave) onSave(updated);
        } catch (err) {
            setMsg(`Upload failed: ${err.message}`);
        }
    };

    if (!transaction) return null;

    return (
        <div className="drawer" onClick={(e) => { if (e.target.className === 'drawer') onClose(); }}>
            <div className="drawer-panel" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 100,
                    background: 'rgba(15, 26, 51, 1)',
                    backdropFilter: 'blur(10px)',
                    padding: '20px 24px',
                    borderBottom: '1px solid var(--line)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '10px',
                    alignItems: 'center'
                }}>
                    <h3 style={{ margin: 0 }}>{transaction.id ? 'Edit Transaction' : 'New Transaction'}</h3>
                    <button className="btn secondary" onClick={onClose}>Close</button>
                </div>

                <div className="drawer-content" style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>

                    <div className="row two">
                        <div>
                            <small className="muted">Date</small>
                            <input value={date} onChange={e => setDate(e.target.value)} placeholder="YYYY-MM-DD" />
                        </div>
                        <div>
                            <small className="muted">Amount</small>
                            <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
                        </div>
                    </div>

                    <div className="row" style={{ marginTop: '10px' }}>
                        <div>
                            <small className="muted">Vendor</small>
                            <input value={vendor} onChange={e => setVendor(e.target.value)} placeholder="Vendor" />
                        </div>
                        <div style={{ marginTop: '10px' }}>
                            <small className="muted">Category</small>
                            <CategorySelect
                                value={ALL_CATEGORIES.includes(category) ? category : (category ? '__custom__' : '')}
                                onChange={val => {
                                    if (val === '__custom__') setCategory('');
                                    else {
                                        setCategory(val);
                                        // If income category, auto-check business income (Line 1) logic
                                        const INCOME_CATS = ['Photo Income', 'Freelance Income', 'Contract Income', 'Side Income'];
                                        if (INCOME_CATS.includes(val) && Number(amount || 0) < 0) {
                                            setDeduct(true);
                                        }
                                    }
                                }}
                                emptyLabel="Select category…"
                                showCustom
                                style={{ padding: '10px' }}
                            />
                            {/* Free-text when value is custom / unknown */}
                            {!ALL_CATEGORIES.includes(category) && (
                                <input
                                    value={category}
                                    onChange={e => setCategory(e.target.value)}
                                    placeholder="Type custom category…"
                                    style={{ marginTop: '8px' }}
                                />
                            )}
                        </div>
                    </div>

                    <div className="row two" style={{ marginTop: '10px' }}>
                        <div>
                            <small className="muted">Tax bucket</small>
                            <select
                                value={taxBucket}
                                onChange={e => {
                                    const newBucket = e.target.value;
                                    setTaxBucket(newBucket);
                                    if (newBucket === 'Personal Expense') setDeduct(false);
                                }}
                                style={{ width: '100%', padding: '8px' }}
                            >
                                <option value="">-- Unassigned --</option>
                                {[
                                    'Advertising', 'Car and truck', 'Commissions and fees', 'Contract labor',
                                    'Depreciation', 'Insurance', 'Interest', 'Legal and professional',
                                    'Office expense', 'Rent/lease', 'Repairs and maintenance', 'Supplies',
                                    'Taxes and licenses', 'Travel', 'Meals (50%)', 'Utilities', 'Wages', 'Other',
                                    'Personal Expense'
                                ].map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                        <div>
                            <small className="muted">Business use %</small>
                            <input type="number" min="0" max="100" step="1" value={bizPct} onChange={e => setBizPct(e.target.value)} />
                        </div>
                    </div>

                    <div className="row" style={{ marginTop: '10px' }}>
                        <label className="tag" style={{ display: 'flex', gap: '10px', alignItems: 'center', width: 'max-content' }}>
                            <input type="checkbox" checked={deduct} onChange={e => setDeduct(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
                            {Number(amount || 0) < 0 ? 'Business Income (Schedule C Line 1)' : 'Tax deductible business expense'}
                        </label>
                    </div>

                    <div className="row" style={{ marginTop: '10px' }}>
                        <div>
                            <small className="muted">Notes</small>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes..." />
                        </div>
                    </div>

                    <div className="row" style={{ marginTop: '10px' }}>
                        <div>
                            <small className="muted">Receipt link - Google Drive, etc. (optional override)</small>
                            <input value={receiptLink} onChange={e => setReceiptLink(e.target.value)} placeholder="https://..." />
                        </div>
                    </div>

                    <div className="row" style={{ marginTop: '10px' }}>
                        <div>
                            <small className="muted">Upload local receipt</small>
                            <input type="file" onChange={e => setReceiptFile(e.target.files[0])} />
                            <div className="muted" style={{ marginTop: '6px' }}>If uploaded, the tracker auto-links it to this transaction.</div>
                        </div>
                    </div>

                    <div className="controls" style={{ marginTop: '12px' }}>
                        <button className="btn" onClick={handleSave}>Save</button>
                        <button className="btn secondary" onClick={handleUpload}>Upload receipt</button>
                    </div>

                    <div className="muted" style={{ marginTop: '10px', minHeight: '18px' }}>{msg}</div>
                </div> {/* end drawer-content */}
            </div>
        </div>
    );
}
