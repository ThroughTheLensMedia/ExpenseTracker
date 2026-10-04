import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../api';
import ImportedDataModal from '../components/ImportedDataModal.jsx';

// Read-only vendor directory. Vendors arrive through "Import from another system"; expenses keep
// their own free-text vendor name, so this page is the home for contact details, 1099 status and
// the masked tax ID. Editing and manual add are tracked in ROADMAP.md (Phase F3).
export default function Vendors() {
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filterText, setFilterText] = useState('');
    const [viewing, setViewing] = useState(null);
    const [showImported, setShowImported] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        apiGet('/crm-import/vendors')
            .then(r => { if (!cancelled) { setVendors(r.data || []); setError(''); } })
            .catch(e => { if (!cancelled) setError(e.message); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [reloadKey]);
    const retry = () => { setLoading(true); setReloadKey(k => k + 1); };

    const shown = useMemo(() => {
        const term = filterText.trim().toLowerCase();
        return vendors.filter(v => !term || [v.name, v.email, v.phone, v.website].some(x => (x || '').toLowerCase().includes(term)));
    }, [vendors, filterText]);

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {showImported && viewing && <ImportedDataModal entity="vendor" id={viewing.id} title={viewing.name} onClose={() => setShowImported(false)} />}

            <div className="card glass glow-blue" style={{ border: 'none', padding: '30px', margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 950, letterSpacing: '-0.02em' }}>Vendors</h1>
                        <div className="muted" style={{ marginTop: '4px', fontSize: '15px' }}>Contact details for the people and companies you pay</div>
                    </div>
                    <Link to="/import/migrate" className="btn secondary" style={{ minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}>Import vendors</Link>
                </div>
                <div className="stat glass" style={{ marginTop: '24px', textAlign: 'center', padding: '20px' }}>
                    <div className="muted small" style={{ fontWeight: 800 }}>VENDORS ON FILE</div>
                    <div style={{ fontSize: '2.4rem', fontWeight: 950, marginTop: '8px' }}>{vendors.length}</div>
                </div>
            </div>

            <div className="card glass" style={{ padding: '24px', margin: 0 }}>
                {error && <div className="tag bad" style={{ width: '100%', padding: 12, marginBottom: 16, whiteSpace: 'normal' }}>{error} <button className="btn sm secondary" style={{ marginLeft: 10, minHeight: 44 }} onClick={retry}>Retry</button></div>}
                <input placeholder="Search vendors by name, email, phone, or website..." value={filterText} onChange={e => setFilterText(e.target.value)} style={{ maxWidth: '360px', minHeight: '44px', marginBottom: '16px' }} aria-label="Search vendors" />

                {loading && !vendors.length ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading vendors...</div>
                ) : !shown.length ? (
                    <div className="empty-state muted" style={{ padding: '40px', textAlign: 'center' }}>
                        {vendors.length ? 'No vendors match your search.' : 'No vendors yet. Use Import vendors to bring them over from your old system.'}
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '10px' }}>
                        {shown.map(v => (
                            <button key={v.id} type="button" onClick={() => setViewing(v)} aria-label={`Open ${v.name}`}
                                style={{ width: '100%', color: 'inherit', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '14px 16px', minHeight: '44px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer' }}>
                                <div style={{ minWidth: '200px', flex: 1 }}>
                                    <div style={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{v.name}</div>
                                    <div className="muted small" style={{ overflowWrap: 'anywhere' }}>{[v.email, v.phone].filter(Boolean).join(' · ') || 'no contact details'}</div>
                                </div>
                                {v.track_1099 && <span className="tag warn">1099</span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {viewing && (
                <div className="drawer">
                    <div className="drawer-panel" style={{ width: 'min(520px, 100%)', padding: '24px' }}>
                        <h2 style={{ marginTop: 0, overflowWrap: 'anywhere' }}>{viewing.name}</h2>
                        <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
                            {[['Email', viewing.email], ['Phone', viewing.phone], ['Website', viewing.website], ['Address', viewing.address]].filter(([, val]) => val).map(([k, val]) => (
                                <div key={k} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                                    <div className="muted extra-small" style={{ fontWeight: 800 }}>{k.toUpperCase()}</div>
                                    <div style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{val}</div>
                                </div>
                            ))}
                            <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                                <div className="muted extra-small" style={{ fontWeight: 800 }}>1099 TRACKING</div>
                                <div>{viewing.track_1099 ? 'Yes — track payments to this vendor' : 'No'}</div>
                            </div>
                            {viewing.tax_id_masked && (
                                <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                                    <div className="muted extra-small" style={{ fontWeight: 800 }}>TAX ID{viewing.tin_type ? ` (${viewing.tin_type})` : ''} · ENCRYPTED</div>
                                    <div>{viewing.tax_id_masked}</div>
                                </div>
                            )}
                            {viewing.notes && <div className="muted small" style={{ padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 8, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{viewing.notes}</div>}
                        </div>
                        {viewing.import_batch_id && (
                            <button type="button" className="muted small" onClick={() => setShowImported(true)}
                                style={{ background: 'none', border: 'none', padding: 0, minHeight: '44px', textDecoration: 'underline', cursor: 'pointer' }}>
                                View imported data
                            </button>
                        )}
                        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                            <button className="btn secondary" style={{ minHeight: '44px' }} onClick={() => setViewing(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
