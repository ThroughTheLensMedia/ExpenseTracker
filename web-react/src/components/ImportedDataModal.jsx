import React, { useEffect, useState } from 'react';
import { apiGet } from '../api';
import ModalShell from './ModalShell.jsx';

// Shows the columns that came over from the old system but have no dedicated field in Ledger
// ("holding area"). Read-only; tax IDs are only ever shown masked.
export default function ImportedDataModal({ entity, id, title, onClose }) {
    const [state, setState] = useState({ loading: true, data: {}, taxId: null, error: '' });

    useEffect(() => {
        let cancelled = false;
        apiGet(`/crm-import/holding/${entity}/${id}`)
            .then(r => { if (!cancelled) setState({ loading: false, data: r.data || {}, taxId: r.taxId, error: '' }); })
            .catch(e => { if (!cancelled) setState({ loading: false, data: {}, taxId: null, error: e.message }); });
        return () => { cancelled = true; };
    }, [entity, id]);

    const { _import: meta, ...fields } = state.data;
    const show = v => (Array.isArray(v) ? v.join(' · ') : String(v));

    return (
        <ModalShell accent="#4c7dff">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: 20, overflowWrap: 'anywhere' }}>Imported data{title ? ` · ${title}` : ''}</h2>
                <button className="btn sm secondary" style={{ minHeight: 44, minWidth: 44 }} onClick={onClose} aria-label="Close">✕</button>
            </div>
            <div className="muted small" style={{ marginBottom: 14 }}>Fields from your old system that don't have a dedicated spot in Lumière Ledger. They're kept here so nothing is lost.</div>

            {state.loading && <div className="muted">Loading…</div>}
            {state.error && <div className="tag bad" style={{ width: '100%', padding: 12, whiteSpace: 'normal' }}>{state.error}</div>}
            {!state.loading && !state.error && !Object.keys(fields).length && !state.taxId && !meta && <div className="muted">Nothing extra was kept for this record.</div>}

            <div style={{ display: 'grid', gap: 8 }}>
                {state.taxId && (
                    <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                        <div className="muted extra-small" style={{ fontWeight: 800 }}>TAX ID (ENCRYPTED)</div>
                        <div style={{ fontWeight: 700 }}>{state.taxId}</div>
                    </div>
                )}
                {Object.entries(fields).map(([k, v]) => (
                    <div key={k} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                        <div className="muted extra-small" style={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{k.toUpperCase()}</div>
                        <div style={{ fontWeight: 600, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{show(v)}</div>
                    </div>
                ))}
                {meta && (
                    <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                        <div className="muted extra-small" style={{ fontWeight: 800 }}>ORIGINAL VALUES IN FILE</div>
                        <div className="small" style={{ overflowWrap: 'anywhere' }}>
                            {meta.source_status ? `Status: ${meta.source_status}` : ''}
                            {meta.source_total_cents != null ? ` · Total: $${(meta.source_total_cents / 100).toFixed(2)}` : ''}
                            {meta.source_balance_cents != null ? ` · Balance: $${(meta.source_balance_cents / 100).toFixed(2)}` : ''}
                            {meta.source_invoice_id ? ` · ID: ${meta.source_invoice_id}` : ''}
                            {meta.original_invoice_number ? ` · Original number: ${meta.original_invoice_number}` : ''}
                        </div>
                    </div>
                )}
            </div>
        </ModalShell>
    );
}
