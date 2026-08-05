import React, { useReducer, useEffect, useState, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import { apiGet, apiPatch, apiPost, apiUpload, apiDelete } from '../api';
import { useModal } from './ModalContext.jsx';
import CategorySelect from './CategorySelect.jsx';
import { ALL_CATEGORIES, CATEGORY_TAX_BUCKET_MAP } from '../constants/categories.js';

// ─── Client-side image compression (keeps uploads under Vercel's 4.5MB limit) ─
// Resizes to max 1920px wide and re-encodes as JPEG at 0.82 quality.
// Skips compression if the file is already under 1MB or is a PDF.
async function compressImage(file) {
    if (file.type === 'application/pdf' || file.size < 1024 * 1024) return file;
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const MAX_W = 1920;
                const scale = img.width > MAX_W ? MAX_W / img.width : 1;
                const canvas = document.createElement('canvas');
                canvas.width  = Math.round(img.width  * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(
                    (blob) => resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file),
                    'image/jpeg',
                    0.82
                );
            };
            img.onerror = () => resolve(file); // fall back to original on error
            img.src = e.target.result;
        };
        reader.onerror = () => resolve(file);
        reader.readAsDataURL(file);
    });
}

// ─── Image → PDF conversion (runs client-side, no server round-trip) ─────────
// Scales the image to fit A4 width (595pt), preserves aspect ratio.
// Returns a Blob with type application/pdf.
async function imageToPdf(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const MAX_PT = 595; // A4 width in points
                const ratio = Math.min(MAX_PT / img.width, MAX_PT / img.height);
                const w = img.width * ratio;
                const h = img.height * ratio;
                const pdf = new jsPDF({
                    orientation: w >= h ? 'landscape' : 'portrait',
                    unit: 'pt',
                    format: [w, h],
                });
                pdf.addImage(e.target.result, 'JPEG', 0, 0, w, h);
                resolve(pdf.output('blob'));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ─── State ───────────────────────────────────────────────────────────────────

const initialState = {
    date: new Date().toISOString().slice(0, 10),
    amount: '', vendor: '', category: '', taxBucket: '',
    bizPct: 100, deduct: false, isSub: false, billingCycle: '', flagged: false, notes: '', receiptLink: '',
    receiptFile: null, source: 'manual', msg: '', savedId: null, saving: false,
    scanning: false, scanMsg: '',
    tipBreakdown: null,   // { subtotal, tip, tax, total } when tip detected on receipt
    tipSplitPair: null,   // { mealId, tipId, mealVendor, mealDate } when two split charges found
};

function reducer(state, action) {
    switch (action.type) {
        case 'SET_FIELD':
            return { ...state, [action.field]: action.value };
        case 'LOAD_TRANSACTION':
            if (!action.tx.id) return initialState;
            return {
                ...initialState,
                date: String(action.tx.expense_date || '').slice(0, 10),
                amount: (Number(action.tx.amount_cents || 0) / 100).toFixed(2),
                vendor: action.tx.vendor || '',
                category: action.tx.category || '',
                taxBucket: action.tx.tax_bucket || '',
                bizPct: action.tx.business_use_pct == null ? 100 : action.tx.business_use_pct,
                deduct: !!action.tx.tax_deductible,
                isSub: !!action.tx.is_subscription,
                billingCycle: action.tx.billing_cycle || '',
                flagged: !!action.tx.needs_review,
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

// ─── Source label helpers ─────────────────────────────────────────────────────

// Static fallback labels — used only when accounts API hasn't loaded
const SOURCE_LABELS = {
    manual: 'Manual Entry', plaid: 'Live Sync',
    rocketmoney: 'Rocket Money', chase: 'Chase Bank', usbank: 'US Bank',
    bankofamerica: 'Bank of America', wellsfargo: 'Wells Fargo',
    applecard: 'Apple Card', capitalone: 'Capital One', usaa: 'USAA',
    navyfcu: 'Navy Federal', wise: 'Wise', delta_amex: 'Delta Amex Card',
    amex_gold: 'Amex Gold Card', amex_platinum: 'Amex Platinum Card',
    amex_blue: 'Amex Blue Cash',
};

function formatSourceKey(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TransactionDrawer({ transaction, onClose, onSave, onDelete, accounts = [] }) {
    const modal = useModal();
    const [state, dispatch] = useReducer(reducer, initialState);
    const { date, amount, vendor, category, taxBucket, bizPct, deduct, isSub, billingCycle, flagged, notes,
            receiptLink, receiptFile, source, msg, savedId, scanning, scanMsg,
            tipBreakdown, tipSplitPair } = state;

    const field = (name, value) => dispatch({ type: 'SET_FIELD', field: name, value });

    // Custom categories fetched from /api/categories
    const [customCats, setCustomCats] = useState([]);
    const [showNewCat, setShowNewCat] = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [newCatType, setNewCatType] = useState('expense');
    const [newCatSaving, setNewCatSaving] = useState(false);

    const loadCustomCats = useCallback(async () => {
        try {
            const data = await apiGet('/categories');
            setCustomCats(Array.isArray(data) ? data : []);
        } catch (_) { /* non-fatal */ }
    }, []);

    useEffect(() => { loadCustomCats(); }, [loadCustomCats]);

    const allCustomNames = customCats.map(c => c.name);
    const ALL_KNOWN = [...ALL_CATEGORIES, ...allCustomNames];

    const handleNewCatSave = async () => {
        if (!newCatName.trim()) return;
        setNewCatSaving(true);
        try {
            const created = await apiPost('/categories', { name: newCatName.trim(), type: newCatType });
            await loadCustomCats();
            field('category', created.name);
            setShowNewCat(false);
            setNewCatName('');
            setNewCatType('expense');
        } catch (err) {
            alert(err?.message || 'Failed to create category.');
        } finally {
            setNewCatSaving(false);
        }
    };

    useEffect(() => {
        if (transaction) dispatch({ type: 'LOAD_TRANSACTION', tx: transaction });
    }, [transaction]);

    const effectiveId = savedId || transaction?.id;

    // ── Receipt scan / auto-extract ──────────────────────────────────────────
    const handleScan = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        field('scanning', true);
        field('scanMsg', '');
        field('tipBreakdown', null);
        field('tipSplitPair', null);

        try {
            const fd = new FormData();
            fd.append('file', file);
            const extracted = await apiUpload('/receipts/extract', fd);

            // Use total as the canonical amount (includes tip when charged together)
            const finalAmount = extracted.total ?? extracted.amount;
            if (extracted.vendor)          field('vendor', extracted.vendor);
            if (finalAmount != null)       field('amount', String(finalAmount));
            if (extracted.date)            field('date', extracted.date);
            if (extracted.category)        field('category', extracted.category);
            if (extracted.notes && !notes) field('notes', extracted.notes);

            // Capture tip breakdown for UI and split-charge detection
            if (extracted.tip > 0) {
                const breakdown = {
                    subtotal: extracted.subtotal,
                    tip:      extracted.tip,
                    tax:      extracted.tax,
                    total:    finalAmount,
                };
                field('tipBreakdown', breakdown);

                // Check whether the bank posted this as two separate charges
                try {
                    const splitRes = await apiPost('/expenses/tip-split-check', {
                        date:           extracted.date || new Date().toISOString().slice(0, 10),
                        subtotal_cents: Math.round((extracted.subtotal || 0) * 100),
                        tip_cents:      Math.round(extracted.tip * 100),
                        vendor:         extracted.vendor || '',
                    });
                    if (splitRes?.found) field('tipSplitPair', splitRes);
                } catch (_) { /* non-fatal — tip split check is best-effort */ }
            }

            // Convert image to PDF for storage
            let storageFile = file;
            if (!file.type.includes('pdf')) {
                const pdfBlob = await imageToPdf(file);
                const baseName = file.name.replace(/\.[^.]+$/, '');
                storageFile = new File([pdfBlob], `${baseName}.pdf`, { type: 'application/pdf' });
            }
            field('receiptFile', storageFile);
            field('scanMsg', '✓ Fields pre-filled — review and save.');

        } catch (err) {
            const msg = err.message || '';
            if (msg === 'no_key' || msg.includes('no_key')) {
                field('receiptFile', file);
                field('scanMsg', 'No Gemini key set in Control Center — file attached without auto-fill.');
            } else {
                field('receiptFile', file);
                field('scanMsg', 'Auto-fill failed — check signal. File attached. Fill fields manually and save.');
            }
        } finally {
            field('scanning', false);
        }
    };

    // ── Save transaction + optional receipt upload ───────────────────────────
    const handleSave = async () => {
        if (state.saving) return;
        dispatch({ type: 'SET_FIELD', field: 'saving', value: true });
        dispatch({ type: 'SET_MSG', value: 'Saving...' });
        try {
            const payload = {
                expense_date: date,
                vendor, category,
                amount_cents: Math.round(Number(amount || 0) * 100),
                tax_deductible: deduct,
                is_subscription: isSub,
                billing_cycle: isSub ? (billingCycle || null) : null,
                needs_review: flagged,
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

            if (receiptFile && !receiptLink) {
                dispatch({ type: 'SET_MSG', value: 'Uploading receipt...' });
                const fd = new FormData();
                fd.append('file', await compressImage(receiptFile));
                try {
                    const withReceipt = await apiUpload(`/receipts/expenses/${updated.id}`, fd);
                    updated = withReceipt;
                    dispatch({ type: 'RECEIPT_UPLOADED', link: updated.receipt_link });
                    dispatch({ type: 'SET_MSG', value: updated.merged ? 'Receipt attached to your bank transaction.' : 'Saved with receipt.' });
                } catch (err) {
                    dispatch({ type: 'SET_MSG', value: `Saved, but receipt upload failed: ${err?.message || err}` });
                }
            } else {
                if (updated.merged) {
                    dispatch({ type: 'SET_MSG', value: 'Matched to your existing bank transaction.' });
                } else if (!transaction?.id && !savedId) {
                    dispatch({ type: 'SAVED_NEW', id: updated.id });
                } else {
                    dispatch({ type: 'SET_MSG', value: 'Saved.' });
                }
            }

            // Tip-split merge: if the receipt scanner found a separate tip charge in the
            // bank feed, merge it into the transaction we just saved. keepId = the new/merged
            // transaction, deleteId = the orphaned tip-only charge.
            if (tipSplitPair?.found && updated?.id) {
                try {
                    const keepId   = updated.id;
                    const deleteId = tipSplitPair.tipId;
                    if (keepId !== deleteId) {
                        await apiPost('/expenses/manual-merge', {
                            keepId,
                            deleteId,
                            overrides: {
                                notes: notes
                                    ? `${notes} (tip merged)`
                                    : `Tip $${tipBreakdown?.tip?.toFixed(2)} merged`,
                            },
                        });
                        dispatch({ type: 'SET_MSG', value: `Saved — tip charge merged in.` });
                    }
                } catch (_) { /* non-fatal */ }
            }

            if (onSave) onSave(updated);
            onClose();
        } catch (err) {
            dispatch({ type: 'SET_MSG', value: `Save failed: ${err?.message || err}` });
        } finally {
            dispatch({ type: 'SET_FIELD', field: 'saving', value: false });
        }
    };

    // ── Manual receipt upload (for already-saved transactions) ───────────────
    const handleUpload = async () => {
        if (!receiptFile) { dispatch({ type: 'SET_MSG', value: 'Choose a file first.' }); return; }
        if (!effectiveId) { dispatch({ type: 'SET_MSG', value: 'Save the transaction first.' }); return; }
        dispatch({ type: 'SET_MSG', value: 'Uploading...' });
        try {
            const fd = new FormData();
            fd.append('file', await compressImage(receiptFile));
            const updated = await apiUpload(`/receipts/expenses/${effectiveId}`, fd);
            dispatch({ type: 'RECEIPT_UPLOADED', link: updated.receipt_link });
            if (onSave) onSave(updated);
        } catch (err) {
            dispatch({ type: 'SET_MSG', value: `Upload failed: ${err.message}` });
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

    if (!transaction) return null;

    const hasReceipt = !!(receiptFile || receiptLink);

    return (
        <div className="drawer" onClick={(e) => { if (e.target.className === 'drawer') onClose(); }}>
            <div className="drawer-panel" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>

                {/* ── Sticky header ── */}
                <div style={{
                    position: 'sticky', top: 0, zIndex: 100,
                    background: 'rgba(15, 26, 51, 1)', backdropFilter: 'blur(10px)',
                    padding: '20px 24px', borderBottom: '1px solid var(--line)',
                    display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center'
                }}>
                    <h3 style={{ margin: 0 }}>{effectiveId ? 'Edit Transaction' : 'New Transaction'}</h3>
                    <button className="btn secondary" onClick={onClose}>Close</button>
                </div>

                <div className="drawer-content" style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>

                    {/* ── Receipt scanner (TOP) ──────────────────────── */}
                    <div style={{
                        marginBottom: '20px', padding: '14px 16px',
                        background: 'rgba(255,255,255,0.03)', borderRadius: '10px',
                        border: '1px solid var(--line)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <small className="muted">Receipt</small>
                            {hasReceipt && !scanning && (
                                <span style={{ color: '#4ade80', fontSize: '12px' }}>✓ Attached</span>
                            )}
                        </div>

                        {scanning ? (
                            <div style={{ marginTop: '10px', color: 'var(--muted)', fontSize: '13px' }}>
                                🔍 Scanning receipt…
                            </div>
                        ) : hasReceipt ? (
                            <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ fontSize: '12px', color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {receiptFile ? receiptFile.name : receiptLink}
                                </span>
                                {receiptLink && (
                                    <button
                                        className="btn secondary"
                                        style={{ fontSize: '12px', padding: '4px 10px', flexShrink: 0 }}
                                        onClick={async () => {
                                            try {
                                                const json = await apiGet(`/receipts/signed-url?path=${encodeURIComponent(receiptLink)}`);
                                                if (json.url) window.open(json.url, '_blank');
                                                else modal.alert('Could not load receipt: ' + (json.error || 'Unknown error'));
                                            } catch (err) {
                                                modal.alert('Could not load receipt: ' + (err?.message || err));
                                            }
                                        }}
                                    >
                                        View
                                    </button>
                                )}
                                <button
                                    className="btn secondary"
                                    style={{ fontSize: '12px', padding: '4px 10px', flexShrink: 0 }}
                                    onClick={() => { field('receiptFile', null); field('receiptLink', ''); field('scanMsg', ''); field('tipBreakdown', null); field('tipSplitPair', null); }}
                                >
                                    Remove
                                </button>
                            </div>
                        ) : (
                            <>
                                <label style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    cursor: 'pointer', marginTop: '10px', padding: '12px',
                                    borderRadius: '8px', background: 'rgba(255,255,255,0.04)',
                                    border: '1px dashed rgba(255,255,255,0.15)'
                                }}>
                                    <span style={{ fontSize: '22px' }}>📷</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: '14px' }}>Scan or Upload Receipt</div>
                                        <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>Fields auto-fill · Saved as PDF</div>
                                    </div>
                                    {/* No capture attr — iOS shows native "Scan Documents" option in picker */}
                                    <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleScan} />
                                </label>
                                <input
                                    value={receiptLink}
                                    onChange={e => field('receiptLink', e.target.value)}
                                    placeholder="Or paste a link (Google Drive, etc.)"
                                    style={{ marginTop: '8px', fontSize: '12px' }}
                                />
                            </>
                        )}

                        {scanMsg && (
                            <div style={{
                                marginTop: '8px', fontSize: '12px',
                                color: scanMsg.startsWith('✓') ? '#4ade80' : '#f59e0b'
                            }}>
                                {scanMsg}
                            </div>
                        )}

                        {/* Tip breakdown — shown when receipt includes a tip */}
                        {tipBreakdown?.tip > 0 && (
                            <div style={{
                                marginTop: '10px', padding: '10px 12px', borderRadius: '8px',
                                background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)',
                                fontSize: '12px', lineHeight: 1.6
                            }}>
                                <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: '4px' }}>Tip detected on receipt</div>
                                <div className="muted">
                                    Subtotal <strong style={{ color: 'var(--text)' }}>${tipBreakdown.subtotal?.toFixed(2)}</strong>
                                    {' + '}tip <strong style={{ color: 'var(--text)' }}>${tipBreakdown.tip?.toFixed(2)}</strong>
                                    {tipBreakdown.tax > 0 && <> + tax <strong style={{ color: 'var(--text)' }}>${tipBreakdown.tax?.toFixed(2)}</strong></>}
                                    {' = '}
                                    <strong style={{ color: '#4ade80' }}>${tipBreakdown.total?.toFixed(2)}</strong> saved
                                </div>
                            </div>
                        )}

                        {/* Split-charge alert — two separate bank charges detected */}
                        {tipSplitPair?.found && (
                            <div style={{
                                marginTop: '8px', padding: '10px 12px', borderRadius: '8px',
                                background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.25)',
                                fontSize: '12px', lineHeight: 1.6
                            }}>
                                <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '4px' }}>Split charge found</div>
                                <div className="muted">
                                    Your bank posted the meal and tip as two separate charges.
                                    They'll be <strong style={{ color: 'var(--text)' }}>merged into one entry</strong> when you save.
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Date + Amount ── */}
                    <div className="row two">
                        <div>
                            <small className="muted">Date</small>
                            <input
                                type="date"
                                value={date}
                                onChange={e => field('date', e.target.value)}
                                style={{ colorScheme: 'dark' }}
                            />
                        </div>
                        <div>
                            <small className="muted">Amount</small>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={amount}
                                onFocus={() => { if (!amount || amount === '0.00' || amount === '0') field('amount', ''); }}
                                onChange={e => field('amount', e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    {/* ── Vendor + Category ── */}
                    <div className="row" style={{ marginTop: '10px' }}>
                        <div>
                            <small className="muted">Vendor</small>
                            <input value={vendor} onChange={e => field('vendor', e.target.value)} placeholder="Vendor" />
                        </div>
                        <div style={{ marginTop: '10px' }}>
                            <small className="muted">Category</small>
                            <CategorySelect
                                value={ALL_KNOWN.includes(category) ? category : ''}
                                onChange={val => {
                                    if (val === '__new_category__') {
                                        setShowNewCat(true);
                                        return;
                                    }
                                    field('category', val);
                                    // Auto-map category → tax bucket + deductible + business_use_pct
                                    const mapping = CATEGORY_TAX_BUCKET_MAP[val];
                                    if (mapping) {
                                        field('taxBucket', mapping.bucket);
                                        field('deduct', mapping.bucket !== 'Personal Expense');
                                        if (mapping.pct !== undefined) field('bizPct', mapping.pct);
                                    } else {
                                        field('taxBucket', '');
                                        field('deduct', false);
                                    }
                                    const INCOME_CATS = ['Photo Income', 'Freelance Income', 'Contract Income', 'Side Income', 'Interest Income', 'Dividend Income'];
                                    if (INCOME_CATS.includes(val) && Number(amount || 0) < 0) {
                                        field('deduct', true);
                                    }
                                }}
                                emptyLabel="Select category…"
                                showCustom
                                customCats={customCats}
                                style={{ padding: '10px' }}
                            />
                            {/* Inline new-category form */}
                            {showNewCat && (
                                <div style={{
                                    marginTop: '8px', padding: '12px', borderRadius: '8px',
                                    background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.2)'
                                }}>
                                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8', marginBottom: '8px' }}>New Category</div>
                                    <input
                                        value={newCatName}
                                        onChange={e => setNewCatName(e.target.value)}
                                        placeholder="Category name…"
                                        style={{ marginBottom: '6px' }}
                                        autoFocus
                                        onKeyDown={e => { if (e.key === 'Enter') handleNewCatSave(); if (e.key === 'Escape') setShowNewCat(false); }}
                                    />
                                    <select
                                        value={newCatType}
                                        onChange={e => setNewCatType(e.target.value)}
                                        style={{ width: '100%', padding: '8px', marginBottom: '8px' }}
                                    >
                                        <option value="expense">Expense</option>
                                        <option value="income">Income</option>
                                        <option value="misc_income">Misc Income</option>
                                    </select>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button className="btn" onClick={handleNewCatSave} disabled={newCatSaving} style={{ fontSize: '12px', padding: '6px 14px', flex: 1 }}>
                                            {newCatSaving ? 'Saving…' : 'Save'}
                                        </button>
                                        <button className="btn secondary" onClick={() => setShowNewCat(false)} style={{ fontSize: '12px', padding: '6px 14px' }}>Cancel</button>
                                    </div>
                                </div>
                            )}
                            {/* Show current category if it exists but isn't in either list (legacy freeform) */}
                            {category && !ALL_KNOWN.includes(category) && (
                                <div style={{ marginTop: '6px', fontSize: '12px', color: '#f59e0b' }}>
                                    Current: <strong>{category}</strong> — not in category list.{' '}
                                    <button
                                        style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '12px', padding: 0, textDecoration: 'underline' }}
                                        onClick={async () => {
                                            try {
                                                const type = category.toLowerCase().includes('income') || category.toLowerCase().includes('refund') ? 'income' : 'expense';
                                                const created = await apiPost('/categories', { name: category, type });
                                                await loadCustomCats();
                                                field('category', created.name);
                                            } catch (err) {
                                                alert(err?.message || 'Failed to save category.');
                                            }
                                        }}
                                    >Save it</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Tax bucket + Business use % ── */}
                    <div className="row two" style={{ marginTop: '10px' }}>
                        <div>
                            <small className="muted">Tax bucket</small>
                            {(() => {
                                const ALL_BUCKETS = [
                                    'Advertising', 'Car and truck', 'Commissions and fees', 'Contract labor',
                                    'Depreciation', 'Insurance', 'Interest', 'Legal and professional',
                                    'Office expense', 'Rent/lease', 'Repairs and maintenance', 'Supplies',
                                    'Taxes and licenses', 'Travel', 'Meals (50%)', 'Utilities', 'Wages', 'Other',
                                    'Personal Expense'
                                ];
                                // When a category has a direct mapping, only show that bucket
                                // + Personal Expense as a manual override option.
                                const mapped = CATEGORY_TAX_BUCKET_MAP[category];
                                const buckets = mapped
                                    ? [...new Set([mapped.bucket, 'Personal Expense'])]
                                    : ALL_BUCKETS;
                                return (
                                    <select
                                        value={taxBucket}
                                        onChange={e => {
                                            const newBucket = e.target.value;
                                            field('taxBucket', newBucket);
                                            if (newBucket === 'Personal Expense') {
                                                field('deduct', false);
                                            } else if (newBucket) {
                                                field('deduct', true);
                                            }
                                        }}
                                        style={{ width: '100%', padding: '8px' }}
                                    >
                                        <option value="">-- Unassigned --</option>
                                        {buckets.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                );
                            })()}
                        </div>
                        <div>
                            <small className="muted">Business use %</small>
                            <input type="number" inputMode="numeric" min="0" max="100" step="1" value={bizPct} onChange={e => field('bizPct', e.target.value)} />
                        </div>
                    </div>

                    {/* ── Checkboxes ── */}
                    <div className="row" style={{ marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'nowrap', alignItems: 'center' }}>
                        <label className="tag" style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, minWidth: 0, opacity: taxBucket ? 1 : 0.4 }}>
                            <input type="checkbox" checked={deduct} onChange={e => field('deduct', e.target.checked)} disabled={!taxBucket} style={{ width: 'auto', margin: 0, flexShrink: 0 }} />
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {Number(amount || 0) < 0 ? 'Biz Income' : 'Tax Deductible'}
                            </span>
                        </label>
                        <label className="tag" style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, minWidth: 0, background: 'rgba(56, 189, 248, 0.05)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                            <input type="checkbox" checked={isSub} onChange={e => field('isSub', e.target.checked)} style={{ width: 'auto', margin: 0, flexShrink: 0 }} />
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Recurring</span>
                        </label>
                        <label className="tag" style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, minWidth: 0, background: flagged ? 'rgba(249,115,22,0.1)' : 'transparent', color: flagged ? '#f97316' : 'rgba(255,255,255,0.5)', border: `1px solid ${flagged ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.1)'}`, transition: 'all 0.15s' }}>
                            <input type="checkbox" checked={flagged} onChange={e => field('flagged', e.target.checked)} style={{ width: 'auto', margin: 0, flexShrink: 0, accentColor: '#f97316' }} />
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>🚩 Review</span>
                        </label>
                    </div>

                    {/* ── Billing Cycle (only relevant when Recurring is checked) ── */}
                    {isSub && (
                        <div className="row" style={{ marginTop: '10px' }}>
                            <div>
                                <small className="muted">Billing Cycle</small>
                                <select value={billingCycle} onChange={e => field('billingCycle', e.target.value)} style={{ width: '100%', padding: '8px' }}>
                                    <option value="">-- Not sure yet --</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="quarterly">Quarterly</option>
                                    <option value="annual">Annual</option>
                                </select>
                                <div className="muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                                    How often this actually charges — set this for an annual/quarterly renewal (e.g. a domain or insurance) so it doesn't get averaged into a monthly figure on your dashboard.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Notes ── */}
                    <div className="row" style={{ marginTop: '10px' }}>
                        <div>
                            <small className="muted">Notes</small>
                            <textarea value={notes} onChange={e => field('notes', e.target.value)} placeholder="Notes..." />
                        </div>
                    </div>

                    {/* ── Account / Source ── */}
                    <div className="row" style={{ marginTop: '10px' }}>
                        <div>
                            <small className="muted">Account</small>
                            <select value={source} onChange={e => field('source', e.target.value)} style={{ width: '100%', padding: '8px' }}>
                                <option value="manual">Manual Entry</option>
                                {accounts
                                    .filter(a => a.source !== 'manual')
                                    .map(a => (
                                        <option key={a.source} value={a.source}>
                                            {a.display_name || SOURCE_LABELS[a.source] || formatSourceKey(a.source)}
                                        </option>
                                    ))
                                }
                                {/* Fallback: if current tx source isn't in the accounts list, still show it */}
                                {source && source !== 'manual' && !accounts.find(a => a.source === source) && (
                                    <option value={source}>
                                        {SOURCE_LABELS[source] || formatSourceKey(source)}
                                    </option>
                                )}
                            </select>
                            {accounts.length === 0 && (
                                <div className="muted" style={{ fontSize: '11px', marginTop: '6px' }}>
                                    Import a bank CSV or connect Plaid to see your accounts here.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Controls ── */}
                    <div className="controls" style={{ marginTop: '12px' }}>
                        <button className="btn" onClick={handleSave} disabled={state.saving} style={{ opacity: state.saving ? 0.5 : 1 }}>
                            {state.saving ? 'Saving...' : 'Save'}
                        </button>
                        {effectiveId && receiptFile && !receiptLink && (
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
