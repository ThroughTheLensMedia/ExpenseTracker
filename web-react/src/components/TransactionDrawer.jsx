import React, { useReducer, useEffect } from 'react';
import { apiPatch, apiPost, apiUpload, apiDelete } from '../api';
import { useModal } from './ModalContext.jsx';
import CategorySelect from './CategorySelect.jsx';
import { ALL_CATEGORIES } from '../constants/categories.js';

const initialState = {
    date: '', amount: '', vendor: '', category: '', taxBucket: '',
    bizPct: 100, deduct: false, notes: '', receiptLink: '',
    receiptFile: null, source: 'manual', msg: '', savedId: null,
};

function reducer(state, action) {
    switch (action.type) {
        case 'SET_FIELD':
            return { ...state, [action.field]: action.value };
        case 'LOAD_TRANSACTION':
            return {
                ...initialState,
                date: String(action.tx.expense_date || '').slice(0, 10),
                amount: (Number(action.tx.amount_cents || 0) / 100).toFixed(2),
                vendor: action.tx.vendor || '',
                category: action.tx.category || '',
                taxBucket: action.tx.tax_bucket || '',
                bizPct: action.tx.business_use_pct == null ? 100 : action.tx.business_use_pct,
                deduct: !!action.tx.tax_deductible,
                notes: action.tx.notes || '',
                receiptLink: action.tx.receipt_link || '',
                source: action.tx.source || 'manual',
                savedId: action.tx.id || null,
            };
        case 'SET_MSG':
            return { ...state, msg: action.value };
        case 'SAVED_NEW':
            return { ...state, savedId: action.id, msg: 'Saved! You can now attach a receipt below.' };
        case 'RECEIPT_UPLOADED':
            return { ...state, receiptLink: action.link, msg: 'Receipt uploaded.' };
        default:
            return state;
    }
}

export default function TransactionDrawer({ transaction, onClose, onSave, onDelete }) {
    const modal = useModal();
    const [state, dispatch] = useReducer(reducer, initialState);
    const { date, amount, vendor, category, taxBucket, bizPct, deduct, notes,
            receiptLink, receiptFile, source, msg, savedId } = state;

    const field = (name, value) => dispatch({ type: 'SET_FIELD', field: name, value });

    useEffect(() => {
        if (transaction) dispatch({ type: 'LOAD_TRANSACTION', tx: transaction });
    }, [transaction]);

    const effectiveId = savedId || transaction?.id;

    const handleSave = async () => {
        dispatch({ type: 'SET_MSG', value: 'Saving...' });
        try {
            const payload = {
                expense_date: date,
                vendor, category,
                amount_cents: Math.round(Number(amount || 0) * 100),
                tax_deductible: deduct,
                tax_bucket: taxBucket,
                business_use_pct: Number(bizPct),
                notes, source,
                receipt_link: receiptLink || null,
            };

            let updated;
            if (effectiveId) {
                updated = await apiPatch(`/expenses/${effectiveId}`, payload);
            } else {
                updated = await apiPost('/expenses', payload);
            }

            if (onSave) onSave(updated);
            if (!transaction.id && !savedId) {
                dispatch({ type: 'SAVED_NEW', id: updated.id });
            } else {
                dispatch({ type: 'SET_MSG', value: 'Saved.' });
            }
        } catch (err) {
            dispatch({ type: 'SET_MSG', value: `Save failed: ${err.message}` });
        }
    };

    const handleDelete = async () => {
        if (!effectiveId) return;
        const ok = await modal.confirm('Delete this transaction? This cannot be undone.');
        if (!ok) return;
        dispatch({ type: 'SET_MSG', value: 'Deleting...' });
        try {
            await apiDelete(`/expenses/${effectiveId}`);
            if (onDelete) onDelete(effectiveId);
            onClose();
        } catch (err) {
            dispatch({ type: 'SET_MSG', value: `Delete failed: ${err.message}` });
        }
    };

    const handleUpload = async () => {
        if (!receiptFile) { dispatch({ type: 'SET_MSG', value: 'Choose a file first.' }); return; }
        if (!effectiveId) { dispatch({ type: 'SET_MSG', value: 'Save the transaction first before uploading.' }); return; }
        dispatch({ type: 'SET_MSG', value: 'Uploading...' });
        try {
            const fd = new FormData();
            fd.append('file', receiptFile);
            const updated = await apiUpload(`/receipts/expenses/${effectiveId}`, fd);
            dispatch({ type: 'RECEIPT_UPLOADED', link: updated.receipt_link });
            if (onSave) onSave(updated);
        } catch (err) {
            dispatch({ type: 'SET_MSG', value: `Upload failed: ${err.message}` });
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
                    <h3 style={{ margin: 0 }}>{effectiveId ? 'Edit Transaction' : 'New Transaction'}</h3>
                    <button className="btn secondary" onClick={onClose}>Close</button>
                </div>

                <div className="drawer-content" style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>

                    <div className="row two">
                        <div>
                            <small className="muted">Date</small>
                            <input type="date" value={date} onChange={e => field('date', e.target.value)} style={{ colorScheme: 'dark' }} />
                        </div>
                        <div>
                            <small className="muted">Amount</small>
                            <input type="text" inputMode="decimal" value={amount} onChange={e => field('amount', e.target.value)} placeholder="0.00" />
                        </div>
                    </div>

                    <div className="row" style={{ marginTop: '10px' }}>
                        <div>
                            <small className="muted">Vendor</small>
                            <input value={vendor} onChange={e => field('vendor', e.target.value)} placeholder="Vendor" />
                        </div>
                        <div style={{ marginTop: '10px' }}>
                            <small className="muted">Category</small>
                            <CategorySelect
                                value={ALL_CATEGORIES.includes(category) ? category : (category ? '__custom__' : '')}
                                onChange={val => {
                                    if (val === '__custom__') field('category', '');
                                    else {
                                        field('category', val);
                                        const INCOME_CATS = ['Photo Income', 'Freelance Income', 'Contract Income', 'Side Income', 'Interest Income', 'Dividend Income'];
                                        if (INCOME_CATS.includes(val) && Number(amount || 0) < 0) {
                                            field('deduct', true);
                                        }
                                    }
                                }}
                                emptyLabel="Select category…"
                                showCustom
                                style={{ padding: '10px' }}
                            />
                            {!ALL_CATEGORIES.includes(category) && (
                                <input
                                    value={category}
                                    onChange={e => field('category', e.target.value)}
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
                                    field('taxBucket', newBucket);
                                    if (newBucket === 'Personal Expense') field('deduct', false);
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
                            <input type="number" inputMode="numeric" min="0" max="100" step="1" value={bizPct} onChange={e => field('bizPct', e.target.value)} />
                        </div>
                    </div>

                    <div className="row" style={{ marginTop: '10px' }}>
                        <label className="tag" style={{ display: 'flex', gap: '10px', alignItems: 'center', width: 'max-content' }}>
                            <input type="checkbox" checked={deduct} onChange={e => field('deduct', e.target.checked)} style={{ width: 'auto', margin: 0 }} />
                            {Number(amount || 0) < 0 ? 'Business Income (Schedule C Line 1)' : 'Tax deductible business expense'}
                        </label>
                    </div>

                    <div className="row" style={{ marginTop: '10px' }}>
                        <div>
                            <small className="muted">Notes</small>
                            <textarea value={notes} onChange={e => field('notes', e.target.value)} placeholder="Notes..." />
                        </div>
                    </div>

                    <div className="row" style={{ marginTop: '10px' }}>
                        <div>
                            <small className="muted">Receipt link - Google Drive, etc. (optional override)</small>
                            <input value={receiptLink} onChange={e => field('receiptLink', e.target.value)} placeholder="https://..." />
                        </div>
                    </div>

                    <div className="row" style={{ marginTop: '10px' }}>
                        <div>
                            <small className="muted">Account / Source</small>
                            <select value={source} onChange={e => field('source', e.target.value)} style={{ width: '100%', padding: '8px' }}>
                                <option value="manual">➕ Manual Entry</option>
                                <option value="plaid">🏦 Plaid (Auto-Sync)</option>
                                <option value="rocketmoney">🟣 Rocket Money</option>
                                <option value="chase">🔵 Chase Bank</option>
                                <option value="usbank">🔵 US Bank</option>
                                <option value="bankofamerica">🔴 Bank of America</option>
                                <option value="wellsfargo">🟡 Wells Fargo</option>
                                <option value="applecard">⬛ Apple Card</option>
                                <option value="capitalone">🔴 Capital One</option>
                                <option value="usaa">🦅 USAA</option>
                                <option value="navyfcu">⚓ Navy Federal</option>
                                <option value="wise">🌍 Wise</option>
                            </select>
                        </div>
                    </div>

                    <div className="row" style={{ marginTop: '10px' }}>
                        <div>
                            <small className="muted">Upload local receipt</small>
                            <input type="file" accept="image/*,.pdf" capture="environment" onChange={e => field('receiptFile', e.target.files[0])} />
                            <div className="muted" style={{ marginTop: '6px' }}>If uploaded, the tracker auto-links it to this transaction.</div>
                        </div>
                    </div>

                    <div className="controls" style={{ marginTop: '12px' }}>
                        <button className="btn" onClick={handleSave}>Save</button>
                        {effectiveId && (
                            <button className="btn secondary" onClick={handleUpload}>Upload receipt</button>
                        )}
                        {effectiveId && (
                            <button className="btn secondary" onClick={handleDelete} style={{ background: 'rgba(255,60,60,0.15)', color: '#ff4d4d', borderColor: 'rgba(255,60,60,0.3)' }}>Delete</button>
                        )}
                    </div>

                    <div className="muted" style={{ marginTop: '10px', minHeight: '18px' }}>{msg}</div>
                </div>
            </div>
        </div>
    );
}
