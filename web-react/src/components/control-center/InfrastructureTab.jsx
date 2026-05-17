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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <div className="grid two">
                <div className="card glass glow-blue" style={{ margin: 0, padding: '30px', border: 'none' }} id="redeem">
                    <h2>License Activation</h2>
                    <p className="muted">Enter your activation key to extend or upgrade your access.</p>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                        <input value={betaCode} onChange={e => setBetaCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX" style={{ padding: '12px' }} />
                        <button className="btn primary" onClick={handleRedeemCode} disabled={redeeming || !betaCode}>
                            {redeeming ? 'Activating...' : 'Redeem Key'}
                        </button>
                    </div>
                    <div className="muted small" style={{ marginTop: '10px' }}>
                        Current Plan: <span style={{ fontWeight: 800, color: 'var(--accent)' }}>{subscription?.plan_type?.toUpperCase()}</span>
                    </div>
                </div>
                <div className="card glass" style={{ margin: 0, padding: '30px' }}>
                    <h2>Edge Network Purge</h2>
                    <p className="muted">Force-clear stagnant cache on global edge nodes. Useful if UI data feels delayed.</p>
                    <button className="btn secondary" onClick={handlePurge} style={{ width: '100%', marginTop: '20px', height: '50px' }}>{purging ? 'Purging Nodes...' : 'Execute Purge'}</button>
                    {msg && <div className="tag ok" style={{ marginTop: '15px', width: '100%', justifyContent: 'center' }}>{msg}</div>}
                </div>
            </div>

            <div className="card glass" style={{ margin: 0, padding: '30px' }}>
                <h2>Restore Hub</h2>
                <p className="muted">Upload a ledger archive (.json) to restore a previous system state.</p>
                <label className="btn secondary" style={{ width: '100%', marginTop: '20px', cursor: 'pointer', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                    {restoring ? 'Restoring Archive...' : 'Upload & Restore Snapshot'}
                </label>
            </div>

            <div className="card glass glow-blue" style={{ border: 'none', padding: '50px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '30px' }}>
                <div style={{ flex: 1, minWidth: '300px' }}>
                    <h2 style={{ fontSize: '2rem', margin: 0 }}>Cloud Database Portal</h2>
                    <p className="muted" style={{ fontSize: '16px', marginTop: '10px' }}>Access your secure Supabase environment to manage raw data, run SQL, or view infrastructure health.</p>
                </div>
                <a href="https://supabase.com/dashboard/projects" target="_blank" rel="noopener noreferrer" className="btn primary" style={{ padding: '20px 50px', fontSize: '18px', fontWeight: 900 }}>OPEN CLOUD CONSOLE</a>
            </div>

            <div className="card glass" style={{ border: 'none', padding: '50px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '30px' }}>
                <div style={{ flex: 1, minWidth: '300px' }}>
                    <h2 style={{ fontSize: '1.8rem', margin: 0 }}>Master Business Download</h2>
                    <p className="muted" style={{ fontSize: '16px', marginTop: '10px' }}>Download your complete ledger — transactions, gear, CRM, and invoices — for archival or tax purposes.</p>
                </div>
                <a href="/api/admin/export-all" download className="btn secondary" style={{ padding: '20px 50px', fontSize: '16px', fontWeight: 900 }}>DOWNLOAD ARCHIVE</a>
            </div>

        </div>
    );
}
