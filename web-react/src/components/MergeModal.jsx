import React, { useState, useEffect } from 'react';
import { formatMoney } from '../api';

/**
 * MergeModal — lets the user pick the base record and choose which
 * enrichment fields to carry into the merged transaction.
 *
 * Props:
 *   txA, txB   — the two transaction objects
 *   onConfirm  — called with { keepId, deleteId, overrides }
 *   onCancel   — called when user dismisses
 */
// Derive a human-readable source label for a transaction
function sourceLabel(tx) {
    if (!tx.source || tx.source === 'manual') return 'Manual';
    return 'Imported';
}

export default function MergeModal({ txA, txB, onConfirm, onCancel }) {
    // Which record is the "base" (date + vendor + amount)
    const [baseId, setBaseId] = useState(txA.id);

    const base   = baseId === txA.id ? txA : txB;
    const other  = baseId === txA.id ? txB : txA;

    // Field selections — each entry: which record's value to use ('base' | 'other' | 'both' | 'none')
    // We build the available options dynamically based on what each record has.

    const [useReceipt,      setUseReceipt]      = useState(null);   // id of record to take receipt from
    const [useCategory,     setUseCategory]     = useState('base');  // 'base' | 'other'
    const [useNotes,        setUseNotes]        = useState('both');  // 'base' | 'other' | 'both' | 'none'
    const [useTaxDed,       setUseTaxDed]       = useState(true);
    const [useTaxBucket,    setUseTaxBucket]    = useState('base');
    const [useBizPct,       setUseBizPct]       = useState('base');

    // Reset sensible defaults when base flips
    useEffect(() => {
        const b = baseId === txA.id ? txA : txB;
        const o = baseId === txA.id ? txB : txA;
        // Receipt: default to whichever has one
        if (b.receipt_link)       setUseReceipt(b.id);
        else if (o.receipt_link)  setUseReceipt(o.id);
        else                      setUseReceipt(null);
        // Category: prefer base, fall back to other
        setUseCategory(b.category ? 'base' : (o.category ? 'other' : 'base'));
        // Notes: combine if both have notes
        if (b.notes && o.notes)   setUseNotes('both');
        else if (b.notes)         setUseNotes('base');
        else if (o.notes)         setUseNotes('other');
        else                      setUseNotes('none');
        // Tax
        setUseTaxDed(b.tax_deductible || o.tax_deductible || false);
        setUseTaxBucket(b.tax_bucket ? 'base' : (o.tax_bucket ? 'other' : 'base'));
        setUseBizPct(b.business_use_pct != null ? 'base' : (o.business_use_pct != null ? 'other' : 'base'));
    }, [baseId, txA, txB]);

    const handleConfirm = () => {
        const b = baseId === txA.id ? txA : txB;
        const o = baseId === txA.id ? txB : txA;

        const overrides = {};

        // Receipt
        if (useReceipt === o.id && o.receipt_link)  overrides.receipt_link = o.receipt_link;
        else if (useReceipt === null)                overrides.receipt_link = null;
        // (if useReceipt === b.id, base already has it — no override needed)

        // Category
        if (useCategory === 'other' && o.category) overrides.category = o.category;

        // Notes
        if (useNotes === 'other')       overrides.notes = o.notes || null;
        else if (useNotes === 'both')   overrides.notes = [b.notes, o.notes].filter(Boolean).join(' | ');
        else if (useNotes === 'none')   overrides.notes = null;
        // 'base' — no override needed

        // Tax deductible
        if (useTaxDed !== (b.tax_deductible || false)) overrides.tax_deductible = useTaxDed;

        // Tax bucket
        if (useTaxBucket === 'other' && o.tax_bucket) overrides.tax_bucket = o.tax_bucket;

        // Business use %
        if (useBizPct === 'other' && o.business_use_pct != null) overrides.business_use_pct = o.business_use_pct;

        onConfirm({ keepId: b.id, deleteId: o.id, overrides });
    };

    const has = (tx, field) => tx[field] != null && tx[field] !== '' && tx[field] !== false;
    const eitherHas = (field) => has(txA, field) || has(txB, field);

    const b = baseId === txA.id ? txA : txB;
    const o = baseId === txA.id ? txB : txA;

    const RecordRadio = ({ tx, label }) => (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', borderRadius: '10px', border: `1px solid ${baseId === tx.id ? 'rgba(74,222,128,0.5)' : 'rgba(255,255,255,0.08)'}`, background: baseId === tx.id ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', marginBottom: '8px' }}>
            <input type="radio" name="base" checked={baseId === tx.id} onChange={() => setBaseId(tx.id)} style={{ marginTop: '2px', accentColor: '#4ade80' }} />
            <div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: baseId === tx.id ? '#4ade80' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>{label}</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{tx.vendor} &nbsp;·&nbsp; {formatMoney(tx.amount_cents)} &nbsp;·&nbsp; {tx.expense_date}</div>
            </div>
        </label>
    );

    const Section = ({ title, children }) => (
        <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>{title}</div>
            {children}
        </div>
    );

    const FieldRow = ({ label, children }) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', marginBottom: '6px' }}>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)' }}>{label}</div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>{children}</div>
        </div>
    );

    const Chip = ({ active, onClick, children }) => (
        <button onClick={onClick} style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', border: `1px solid ${active ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.1)'}`, background: active ? 'rgba(99,102,241,0.2)' : 'transparent', color: active ? '#a5b4fc' : '#64748b', cursor: 'pointer' }}>
            {children}
        </button>
    );

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', padding: '20px' }}>
            <div style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '18px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>

                {/* Header */}
                <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Merge Duplicate Transactions</span>
                </div>

                <div style={{ padding: '18px 22px' }}>

                    {/* Step 1 — Base record */}
                    <Section title="Step 1 — Which record is the base?">
                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>The base record's date, vendor, and amount are kept.</div>
                        <RecordRadio tx={txA} label={sourceLabel(txA)} />
                        <RecordRadio tx={txB} label={sourceLabel(txB)} />
                    </Section>

                    {/* Divider */}
                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0 16px' }} />

                    {/* Step 2 — Fields */}
                    <Section title="Step 2 — Which details to keep?">

                        {/* Receipt */}
                        {eitherHas('receipt_link') && (
                            <FieldRow label="Receipt">
                                {has(b, 'receipt_link') && <Chip active={useReceipt === b.id} onClick={() => setUseReceipt(b.id)}>{sourceLabel(b)}</Chip>}
                                {has(o, 'receipt_link') && <Chip active={useReceipt === o.id} onClick={() => setUseReceipt(o.id)}>{sourceLabel(o)}</Chip>}
                                <Chip active={useReceipt === null} onClick={() => setUseReceipt(null)}>None</Chip>
                            </FieldRow>
                        )}

                        {/* Category */}
                        {eitherHas('category') && (
                            <FieldRow label="Category">
                                {b.category !== o.category ? (
                                    <>
                                        <Chip active={useCategory === 'base'} onClick={() => setUseCategory('base')}>{b.category || '—'} ({sourceLabel(b)})</Chip>
                                        <Chip active={useCategory === 'other'} onClick={() => setUseCategory('other')}>{o.category || '—'} ({sourceLabel(o)})</Chip>
                                    </>
                                ) : (
                                    <span style={{ fontSize: '12px', color: '#4ade80' }}>✓ Same on both</span>
                                )}
                            </FieldRow>
                        )}

                        {/* Notes */}
                        {eitherHas('notes') && (
                            <FieldRow label="Notes">
                                {has(b, 'notes') && <Chip active={useNotes === 'base'} onClick={() => setUseNotes('base')}>{sourceLabel(b)}</Chip>}
                                {has(o, 'notes') && <Chip active={useNotes === 'other'} onClick={() => setUseNotes('other')}>{sourceLabel(o)}</Chip>}
                                {has(b, 'notes') && has(o, 'notes') && <Chip active={useNotes === 'both'} onClick={() => setUseNotes('both')}>Both</Chip>}
                                <Chip active={useNotes === 'none'} onClick={() => setUseNotes('none')}>None</Chip>
                            </FieldRow>
                        )}

                        {/* Tax deductible */}
                        {eitherHas('tax_deductible') && (
                            <FieldRow label="Tax deductible">
                                <Chip active={useTaxDed === true} onClick={() => setUseTaxDed(true)}>Yes</Chip>
                                <Chip active={useTaxDed === false} onClick={() => setUseTaxDed(false)}>No</Chip>
                            </FieldRow>
                        )}

                        {/* Tax bucket */}
                        {eitherHas('tax_bucket') && b.tax_bucket !== o.tax_bucket && (
                            <FieldRow label="Tax bucket">
                                {has(b, 'tax_bucket') && <Chip active={useTaxBucket === 'base'} onClick={() => setUseTaxBucket('base')}>{b.tax_bucket} ({sourceLabel(b)})</Chip>}
                                {has(o, 'tax_bucket') && <Chip active={useTaxBucket === 'other'} onClick={() => setUseTaxBucket('other')}>{o.tax_bucket} ({sourceLabel(o)})</Chip>}
                            </FieldRow>
                        )}

                        {/* Business use % */}
                        {eitherHas('business_use_pct') && b.business_use_pct !== o.business_use_pct && (
                            <FieldRow label="Business use %">
                                {b.business_use_pct != null && <Chip active={useBizPct === 'base'} onClick={() => setUseBizPct('base')}>{b.business_use_pct}% ({sourceLabel(b)})</Chip>}
                                {o.business_use_pct != null && <Chip active={useBizPct === 'other'} onClick={() => setUseBizPct('other')}>{o.business_use_pct}% ({sourceLabel(o)})</Chip>}
                            </FieldRow>
                        )}

                    </Section>
                </div>

                {/* Actions */}
                <div style={{ padding: '0 22px 20px', display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                    <button className="btn secondary" style={{ padding: '9px 20px' }} onClick={onCancel}>Cancel</button>
                    <button className="btn" style={{ padding: '9px 22px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }} onClick={handleConfirm}>
                        Merge →
                    </button>
                </div>
            </div>
        </div>
    );
}
