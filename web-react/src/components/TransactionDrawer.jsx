import React, { useState, useEffect } from 'react';
import { apiPatch, apiPost } from '../api';

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
            const updated = await apiPatch(`/expenses/${transaction.id}`, payload);
            setMsg("Saved.");
            if (onSave) onSave(updated);
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
            <div className="drawer-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>Edit transaction</h3>
                    <button className="btn secondary" onClick={onClose}>Close</button>
                </div>

                <div className="hr"></div>

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
                        {(() => {
                            const KNOWN = [
                                // Expenses
                                'Advertising', 'Auto & Transport', 'Bills & Utilities', 'Camera & Equipment',
                                'Clothing', 'Dining & Drinks', 'Education', 'Entertainment',
                                'Gas & Fuel', 'Groceries', 'Health & Medical', 'Home & Garden',
                                'Insurance (Business)', 'Insurance (Personal)', 'Office Supplies',
                                'Parking & Tolls', 'Personal Care', 'Pets', 'Photography',
                                'Professional Services', 'Rent / Lease', 'Repairs & Maintenance',
                                'Shopping', 'Software & Tech', 'Subscriptions', 'Supplies',
                                'Taxes & Licenses', 'Travel & Vacation',
                                // Income
                                'Photo Income', 'Freelance Income', 'Contract Income',
                                'Military Retirement', 'VA Benefits', 'Rental Income', 'Side Income',
                                // Misc Income
                                'IRS Tax Refund', 'State Tax Refund', 'Refund', 'Reimbursement',
                                'Cashback / Rewards', 'Interest Income', 'Internal Transfer',
                                'Credit Card Payment', 'Deposit',
                            ];
                            const isKnown = KNOWN.includes(category);
                            const selectVal = isKnown ? category : (category ? '__custom__' : '');

                            return (
                                <>
                                    <select
                                        value={selectVal}
                                        onChange={e => {
                                            if (e.target.value === '__custom__') setCategory('');
                                            else setCategory(e.target.value);
                                        }}
                                        style={{ width: '100%', padding: '10px' }}
                                    >
                                        <option value="">Select category…</option>

                                        <optgroup label="── Expenses ──────────────────">
                                            <option value="Advertising">Advertising</option>
                                            <option value="Auto & Transport">Auto &amp; Transport</option>
                                            <option value="Bills & Utilities">Bills &amp; Utilities</option>
                                            <option value="Camera & Equipment">Camera &amp; Equipment</option>
                                            <option value="Clothing">Clothing</option>
                                            <option value="Dining & Drinks">Dining &amp; Drinks</option>
                                            <option value="Education">Education</option>
                                            <option value="Entertainment">Entertainment</option>
                                            <option value="Gas & Fuel">Gas &amp; Fuel</option>
                                            <option value="Groceries">Groceries</option>
                                            <option value="Health & Medical">Health &amp; Medical</option>
                                            <option value="Home & Garden">Home &amp; Garden</option>
                                            <option value="Insurance (Business)">Insurance (Business)</option>
                                            <option value="Insurance (Personal)">Insurance (Personal)</option>
                                            <option value="Office Supplies">Office Supplies</option>
                                            <option value="Parking & Tolls">Parking &amp; Tolls</option>
                                            <option value="Personal Care">Personal Care</option>
                                            <option value="Pets">Pets</option>
                                            <option value="Photography">Photography</option>
                                            <option value="Professional Services">Professional Services</option>
                                            <option value="Rent / Lease">Rent / Lease</option>
                                            <option value="Repairs & Maintenance">Repairs &amp; Maintenance</option>
                                            <option value="Shopping">Shopping</option>
                                            <option value="Software & Tech">Software &amp; Tech</option>
                                            <option value="Subscriptions">Subscriptions</option>
                                            <option value="Supplies">Supplies</option>
                                            <option value="Taxes & Licenses">Taxes &amp; Licenses</option>
                                            <option value="Travel & Vacation">Travel &amp; Vacation</option>
                                        </optgroup>

                                        <optgroup label="── Income ────────────────────">
                                            <option value="Photo Income">Photo Income</option>
                                            <option value="Freelance Income">Freelance Income</option>
                                            <option value="Contract Income">Contract Income</option>
                                            <option value="Military Retirement">Military Retirement</option>
                                            <option value="VA Benefits">VA Benefits</option>
                                            <option value="Rental Income">Rental Income</option>
                                            <option value="Side Income">Side Income</option>
                                        </optgroup>

                                        <optgroup label="── Misc Income (non-taxable) ">
                                            <option value="IRS Tax Refund">IRS Tax Refund</option>
                                            <option value="State Tax Refund">State Tax Refund</option>
                                            <option value="Refund">Refund / Return</option>
                                            <option value="Reimbursement">Reimbursement</option>
                                            <option value="Cashback / Rewards">Cashback / Rewards</option>
                                            <option value="Interest Income">Interest Income</option>
                                            <option value="Internal Transfer">Internal Transfer</option>
                                            <option value="Credit Card Payment">Credit Card Payment</option>
                                            <option value="Deposit">Deposit</option>
                                        </optgroup>

                                        <option value="__custom__">✚ Custom Category…</option>
                                    </select>

                                    {/* Show free-text input when custom is chosen OR when current value isn't in known list */}
                                    {!isKnown && (
                                        <input
                                            value={category}
                                            onChange={e => setCategory(e.target.value)}
                                            placeholder="Type custom category…"
                                            style={{ marginTop: '8px' }}
                                            autoFocus={selectVal === '__custom__'}
                                        />
                                    )}
                                </>
                            );
                        })()}
                    </div>
                </div>

                <div className="row two" style={{ marginTop: '10px' }}>
                    <div>
                        <small className="muted">Tax bucket</small>
                        <select value={taxBucket} onChange={e => setTaxBucket(e.target.value)} style={{ width: '100%', padding: '8px' }}>
                            <option value="">-- Unassigned --</option>
                            {[
                                'Advertising', 'Car and truck', 'Commissions and fees', 'Contract labor',
                                'Depreciation', 'Insurance', 'Interest', 'Legal and professional',
                                'Office expense', 'Rent/lease', 'Repairs and maintenance', 'Supplies',
                                'Taxes and licenses', 'Travel', 'Meals (50%)', 'Utilities', 'Wages', 'Other'
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
                        Tax deductible
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
            </div>
        </div>
    );
}
