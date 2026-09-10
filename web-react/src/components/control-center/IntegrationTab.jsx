// IntegrationTab.jsx — Website Lead Capture integration management
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../api';
import { useModal } from '../ModalContext.jsx';

const INTAKE_URL = 'https://www.lumiereledger.com/api/intake';

function CopyButton({ value, label = 'Copy' }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    return (
        <button type="button" onClick={handleCopy} className="btn sm secondary" style={{ minWidth: 76, fontSize: 12 }}>
            {copied ? 'Copied' : label}
        </button>
    );
}

function CodeSnippet({ intakeKey }) {
    const snippet = `// Add this to your website's form submit handler
const formData = {
  name: "Client Name",
  email: "client@email.com",
  phone: "555-555-5555",
  shootType: "Portrait Session",
  idealDate: "2026-06-15",
  location: "Red Rock Canyon",
  message: "Looking to book a session",
  turnstileToken: token // your Turnstile token
};

fetch("https://your-site.com/api/form", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(formData)
});

// In your Cloudflare Worker / backend, set these env vars:
// LUMIERE_INTAKE_URL  = ${INTAKE_URL}
// LUMIERE_INTAKE_SECRET = ${intakeKey}`;

    return (
        <div style={{ background: 'rgba(0,0,0,.28)', borderRadius: 12, padding: 16, border: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                <CopyButton value={snippet} label="Copy snippet" />
            </div>
            <pre style={{ margin: 0, overflowX: 'auto', fontSize: 12, color: 'rgba(255,255,255,.7)', fontFamily: 'var(--mono)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.6 }}>
                {snippet}
            </pre>
        </div>
    );
}

function EmailReceiptCard() {
    const [address, setAddress] = useState(null);
    const [addrLoading, setAddrLoading] = useState(true);

    useEffect(() => {
        apiGet('/receipts/my-address')
            .then(d => setAddress(d.address))
            .catch(() => setAddress(null))
            .finally(() => setAddrLoading(false));
    }, []);

    return (
        <section className="card glass" style={{ margin: 0, padding: 'clamp(16px, 3vw, 24px)' }} aria-labelledby="receipt-forwarding-heading">
            <div style={{ maxWidth: 760, marginBottom: 16 }}>
                <h2 id="receipt-forwarding-heading" style={{ margin: 0, fontSize: 20 }}>Email receipt forwarding</h2>
                <div className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.55 }}>
                    Forward any receipt email to your personal address below and it will be automatically parsed and attached to the matching transaction. Save it as a contact for quick access.
                </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ maxWidth: '100%', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 10, padding: '10px 14px', overflowWrap: 'anywhere', fontSize: 13, fontWeight: 700 }}>
                    {addrLoading ? (
                        <span className="muted" style={{ fontFamily: 'monospace' }}>Loading your address…</span>
                    ) : address ? (
                        <span style={{ color: '#f59e0b', fontFamily: 'monospace' }}>{address}</span>
                    ) : (
                        <span className="muted" style={{ fontFamily: 'monospace' }}>Unavailable — contact support</span>
                    )}
                </div>
                {address && <CopyButton value={address} label="Copy address" />}
            </div>
            <div className="muted" style={{ fontSize: '12px', marginTop: '12px' }}>
                This address is unique to your account. Works with JPEG/PNG photo attachments and plain-text receipt emails. Receipts that arrive before the bank transaction posts will match automatically when your bank syncs (1–3 days).
            </div>
        </section>
    );
}

export default function IntegrationTab() {
    const modal = useModal();
    const [keys, setKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [newLabel, setNewLabel] = useState('');
    const [expandedKey, setExpandedKey] = useState(null);

    const loadKeys = async () => {
        try {
            const res = await apiGet('/intake-keys');
            setKeys(res.keys || []);
        } catch (e) {
            console.error('Failed to load intake keys:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadKeys(); }, []);

    const handleGenerate = async () => {
        const label = newLabel.trim() || 'Website Integration';
        setGenerating(true);
        try {
            const key = await apiPost('/intake-keys', { label });
            setKeys(prev => [key, ...prev]);
            setNewLabel('');
            setExpandedKey(key.id);
        } catch (e) {
            modal.alert(e.message);
        } finally {
            setGenerating(false);
        }
    };

    const handleRevoke = async (keyId) => {
        const confirmed = await modal.confirm('Revoke this key? Any website using it will stop sending leads immediately.');
        if (!confirmed) return;
        try {
            await fetch(`/api/intake-keys/${keyId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${(await import('../AuthContext')).supabase?.auth.getSession().then(r => r.data.session?.access_token)}` }
            });
            setKeys(prev => prev.filter(k => k.id !== keyId));
            if (expandedKey === keyId) setExpandedKey(null);
        } catch (e) {
            modal.alert(e.message);
        }
    };

    return (
        <div style={{ display: 'grid', gap: 16 }}>

            {/* Email Receipt Forwarding */}
            <EmailReceiptCard />

            {/* Header */}
            <section className="card glass" style={{ margin: 0, padding: 'clamp(16px, 3vw, 24px)' }} aria-labelledby="lead-capture-heading">
                <div style={{ maxWidth: 760, marginBottom: 16 }}>
                    <h2 id="lead-capture-heading" style={{ margin: 0, fontSize: 20 }}>Website lead capture</h2>
                    <div className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.55 }}>Send booking requests from your website directly into the CRM pipeline.</div>
                </div>
                <div className="controls" style={{ alignItems: 'center' }}>
                    <div style={{ maxWidth: '100%', background: 'rgba(56,189,248,.08)', border: '1px solid rgba(56,189,248,.2)', borderRadius: 10, padding: '10px 14px', overflowWrap: 'anywhere', fontSize: 12, fontWeight: 700 }}>
                        Intake URL: <span style={{ color: '#38bdf8', fontFamily: 'var(--mono)' }}>{INTAKE_URL}</span>
                    </div>
                    <CopyButton value={INTAKE_URL} label="Copy URL" />
                </div>
            </section>

            {/* Generate New Key */}
            <section className="card glass" style={{ margin: 0, padding: 'clamp(16px, 3vw, 24px)' }} aria-labelledby="integration-key-heading">
                <h2 id="integration-key-heading" style={{ margin: 0, fontSize: 20 }}>Integration keys</h2>
                <p className="muted" style={{ margin: '8px 0 16px', fontSize: 14, lineHeight: 1.55 }}>Create a separate key for each website so a connection can be revoked without affecting the others.</p>
                <div className="controls" style={{ alignItems: 'stretch' }}>
                    <input
                        aria-label="Integration key label"
                        value={newLabel}
                        onChange={e => setNewLabel(e.target.value)}
                        placeholder="Website name or domain"
                        style={{ flex: '1 1 240px', minHeight: 48 }}
                        onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                    />
                    <button type="button" className="btn" onClick={handleGenerate} disabled={generating} style={{ minHeight: 48 }}>
                        {generating ? 'Generating…' : 'Generate key'}
                    </button>
                </div>
            </section>

            {/* Keys List */}
            <div style={{ display: 'grid', gap: 12 }}>
                {loading && <div className="card glass" style={{ margin: 0 }}><div className="empty-state">Loading integration keys…</div></div>}

                {!loading && keys.length === 0 && (
                    <div className="card glass" style={{ margin: 0 }}>
                        <div className="empty-state">
                            <strong>No integration keys yet</strong>
                            <span className="muted">Generate a key above to connect your website.</span>
                        </div>
                    </div>
                )}

                {keys.map(k => (
                    <section key={k.id} className="card glass" style={{ margin: 0, padding: 'clamp(16px, 3vw, 20px)', border: expandedKey === k.id ? '1px solid rgba(56,189,248,0.3)' : undefined }} aria-label={`Integration key ${k.label}`}>
                        <div className="mobile-break" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 900, fontSize: '14px' }}>{k.label}</div>
                                <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#38bdf8', marginTop: '4px', wordBreak: 'break-all' }}>{k.key}</div>
                                <div className="muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                                    Created {new Date(k.created_at).toLocaleDateString()}
                                    {k.last_used_at && ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                                </div>
                            </div>
                            <div className="controls" style={{ alignItems: 'center', flexShrink: 0 }}>
                                <CopyButton value={k.key} label="Copy key" />
                                <button
                                    type="button"
                                    className="btn sm secondary"
                                    onClick={() => setExpandedKey(expandedKey === k.id ? null : k.id)}
                                    style={{ fontSize: '11px' }}
                                >
                                    {expandedKey === k.id ? 'Hide setup' : 'View setup'}
                                </button>
                                <button
                                    type="button"
                                    className="btn secondary"
                                    onClick={() => handleRevoke(k.id)}
                                    style={{ borderColor: 'rgba(239,68,68,.25)', color: 'var(--bad)', fontSize: 11 }}
                                >
                                    Revoke
                                </button>
                            </div>
                        </div>

                        {expandedKey === k.id && (
                            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 12, color: 'var(--muted)' }}>
                                    Cloudflare or backend environment variables
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                                    {[
                                        { label: 'LUMIERE_INTAKE_URL', value: INTAKE_URL },
                                        { label: 'LUMIERE_INTAKE_SECRET', value: k.key }
                                    ].map(v => (
                                        <div key={v.label} className="mobile-break" style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,.3)', borderRadius: 10, padding: '10px 14px' }}>
                                            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: '#fbbf24', minWidth: 200 }}>{v.label}</span>
                                            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'rgba(255,255,255,.7)', flex: 1, wordBreak: 'break-all' }}>{v.value}</span>
                                            <CopyButton value={v.value} />
                                        </div>
                                    ))}
                                </div>
                                <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 12, color: 'var(--muted)' }}>
                                    Example implementation
                                </div>
                                <CodeSnippet intakeKey={k.key} />
                            </div>
                        )}
                    </section>
                ))}
            </div>
        </div>
    );
}
