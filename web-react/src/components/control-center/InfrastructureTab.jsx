import React, { useState } from 'react';
import { apiPost } from '../../api';
import { useModal } from '../ModalContext.jsx';

export default function InfrastructureTab({ subscription, onReload }) {
    const modal = useModal();
    const [betaCode, setBetaCode] = useState('');
    const [redeeming, setRedeeming] = useState(false);
    const [purging, setPurging] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [msg, setMsg] = useState('');

    const handleRedeemCode = async () => {
        if (!betaCode) return;
        setRedeeming(true);
        try {
            const res = await apiPost('/subscription/redeem', { code: betaCode });
            modal.alert(res.message);
            setBetaCode('');
            onReload(true);
        } catch (err) { modal.alert(err.message); }
        finally { setRedeeming(false); }
    };

    const handlePurge = async () => {
        setPurging(true); setMsg('');
        try {
            await new Promise(r => setTimeout(r, 1000));
            setMsg('GLOBAL CACHE PURGED');
            setTimeout(() => setMsg(''), 3000);
        } catch (err) { modal.alert(err.message); }
        finally { setPurging(false); }
    };

    return (
        <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16 }}>
                <section className="card glass" style={{ margin: 0, padding: 'clamp(16px, 3vw, 24px)' }} id="redeem" aria-labelledby="license-activation-heading">
                    <h2 id="license-activation-heading" style={{ margin: 0, fontSize: 20 }}>License activation</h2>
                    <p className="muted" style={{ margin: '8px 0 18px', fontSize: 14, lineHeight: 1.55 }}>Enter an activation key to extend or upgrade account access.</p>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <input
                            value={betaCode}
                            onChange={e => setBetaCode(e.target.value.toUpperCase())}
                            placeholder="XXXX-XXXX-XXXX"
                            aria-label="Activation key"
                            style={{ padding: 12, flex: '1 1 200px', minWidth: 0 }}
                        />
                        <button className="btn primary" onClick={handleRedeemCode} disabled={redeeming || !betaCode}>
                            {redeeming ? 'Activating…' : 'Redeem key'}
                        </button>
                    </div>
                    <div className="muted small" style={{ marginTop: 12 }}>
                        Current plan: <span style={{ fontWeight: 800, color: 'var(--accent)' }}>{subscription?.plan_type?.toUpperCase() || 'UNKNOWN'}</span>
                    </div>
                </section>

                <section className="card glass" style={{ margin: 0, padding: 'clamp(16px, 3vw, 24px)' }} aria-labelledby="edge-purge-heading">
                    <h2 id="edge-purge-heading" style={{ margin: 0, fontSize: 20 }}>Edge network purge</h2>
                    <p className="muted" style={{ margin: '8px 0 18px', fontSize: 14, lineHeight: 1.55 }}>Force-clear stagnant cache on global edge nodes when interface data appears delayed.</p>
                    <button className="btn secondary" onClick={handlePurge} style={{ width: '100%', minHeight: 46 }}>{purging ? 'Purging nodes…' : 'Execute purge'}</button>
                    {msg && <div className="tag ok" role="status" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}>{msg}</div>}
                </section>
            </div>

            <section className="card glass" style={{ margin: 0, padding: 'clamp(16px, 3vw, 24px)' }} aria-labelledby="restore-hub-heading">
                <h2 id="restore-hub-heading" style={{ margin: 0, fontSize: 20 }}>Restore hub</h2>
                <p className="muted" style={{ margin: '8px 0 18px', fontSize: 14, lineHeight: 1.55 }}>Upload a Lumière Ledger archive (.json) to restore a previous system state.</p>
                <label className="btn secondary" style={{ width: '100%', cursor: 'pointer', minHeight: 46, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <input type="file" accept=".json" onChange={async (e) => {
                        const file = e.target.files[0]; if (!file) return; setRestoring(true);
                        const reader = new FileReader(); reader.onload = async (ev) => {
                            try {
                                const data = JSON.parse(ev.target.result);
                                await apiPost('/admin/import-all', data);
                                await modal.alert("Ledger state restored successfully.");
                                onReload();
                            } catch (err) { modal.alert(err.message); }
                            finally { setRestoring(false); }
                        }; reader.readAsText(file);
                    }} style={{ display: 'none' }} />
                    {restoring ? 'Restoring archive…' : 'Upload and restore snapshot'}
                </label>
            </section>

            <section className="card glass" style={{ margin: 0, padding: 'clamp(16px, 3vw, 24px)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 18 }} aria-labelledby="cloud-database-heading">
                <div style={{ flex: '1 1 360px', minWidth: 0 }}>
                    <h2 id="cloud-database-heading" style={{ margin: 0, fontSize: 20 }}>Cloud database portal</h2>
                    <p className="muted" style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.55 }}>Open the secure Supabase environment to manage raw data, run SQL, or view infrastructure health.</p>
                </div>
                <a href="https://supabase.com/dashboard/projects" target="_blank" rel="noopener noreferrer" className="btn primary">Open cloud console</a>
            </section>

            <section className="card glass" style={{ margin: 0, padding: 'clamp(16px, 3vw, 24px)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 18 }} aria-labelledby="business-download-heading">
                <div style={{ flex: '1 1 360px', minWidth: 0 }}>
                    <h2 id="business-download-heading" style={{ margin: 0, fontSize: 20 }}>Master business download</h2>
                    <p className="muted" style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.55 }}>Download the complete ledger — transactions, equipment, CRM, and invoices — for archival or tax purposes.</p>
                </div>
                <a href="/api/admin/export-all" download className="btn secondary">Download archive</a>
            </section>

        </div>
    );
}
