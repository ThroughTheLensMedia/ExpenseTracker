import React, { useState } from 'react';
import { apiPost } from '../api';

export default function Backup() {
    const [msg, setMsg] = useState('');

    const handlePurge = async () => {
        setMsg("Purging...");
        try {
            await apiPost("/admin/purge-cloudflare", { purge_everything: true });
            setMsg("Purge requested. Hard refresh (Shift+Reload) if the UI still looks stale.");
        } catch (e) {
            setMsg(`Purge failed: ${e.message}`);
        }
    };

    return (
        <section className="card">
            <h2>Backup & Cache</h2>
            <div className="muted" style={{ marginBottom: '12px' }}>Phase 2—one-click DB export + receipts zip.</div>

            <div className="card" style={{ margin: 0 }}>
                <h2 style={{ marginBottom: '6px' }}>Cache management</h2>
                <div className="muted" style={{ marginBottom: '10px' }}>
                    If you deploy new UI code but still see an older version, purge Cloudflare cache—then hard refresh.
                </div>

                <div className="controls">
                    <button className="btn secondary" onClick={handlePurge}>Purge Cloudflare cache</button>
                    <div className="muted" style={{ minHeight: '18px' }}>{msg}</div>
                </div>

                <div className="muted" style={{ marginTop: '10px' }}>
                    Requires env vars—<span className="mono">CF_API_TOKEN</span> and optionally <span className="mono">CF_ZONE_ID</span>.
                </div>
            </div>

            <div className="card" style={{ marginTop: '20px' }}>
                <h2 style={{ marginBottom: '6px' }}>Data Portability</h2>
                <div className="muted" style={{ marginBottom: '14px' }}>
                    Download a full snapshot of your entire database (Expenses, Equipment, Clients, and Invoices) as a JSON file for your records.
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <a href="/api/admin/export-all" download className="btn primary">
                        📥 Download Full Backup (.json)
                    </a>
                    <span className="muted small">Recommended before major manual edits.</span>
                </div>
            </div>
        </section>
    );
}
