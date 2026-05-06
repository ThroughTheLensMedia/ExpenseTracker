// IntegrationTab.jsx — Website Lead Capture integration management
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../api';
import { useModal } from '../ModalContext.jsx';

const INTAKE_URL = 'https://app.throughthelens.media/api/intake';

function CopyButton({ value, label = 'Copy' }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    return (
        <button onClick={handleCopy} className="btn sm secondary" style={{ fontSize: '11px', minWidth: '70px' }}>
            {copied ? '✓ Copied' : label}
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
        <div style={{ position: 'relative', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
                <CopyButton value={snippet} label="Copy Snippet" />
            </div>
            <pre style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1.6, paddingRight: '90px' }}>
                {snippet}
            </pre>
        </div>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* Header */}
            <div className="card glass" style={{ margin: 0, padding: '28px', borderTop: '4px solid #38bdf8' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '32px' }}>🔗</span>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>Website Lead Capture</h2>
                        <div className="muted" style={{ fontSize: '13px', marginTop: '4px' }}>Connect your photography website to route booking requests directly into your CRM pipeline.</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
                    <div style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', padding: '10px 16px', fontSize: '12px', fontWeight: 700 }}>
                        📍 Intake URL: <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{INTAKE_URL}</span>
                    </div>
                    <CopyButton value={INTAKE_URL} label="Copy URL" />
                </div>
            </div>

            {/* Generate New Key */}
            <div className="card glass" style={{ margin: 0, padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Generate Integration Key</h3>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <input
                        value={newLabel}
                        onChange={e => setNewLabel(e.target.value)}
                        placeholder="Label (e.g. throughthelens.media)"
                        style={{ flex: 1, minWidth: '200px', padding: '12px' }}
                        onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                    />
                    <button className="btn glow-blue" onClick={handleGenerate} disabled={generating} style={{ padding: '12px 24px', fontWeight: 900 }}>
                        {generating ? 'Generating...' : '+ Generate Key'}
                    </button>
                </div>
            </div>

            {/* Keys List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {loading && <div className="muted" style={{ textAlign: 'center', padding: '40px' }}>Loading keys...</div>}

                {!loading && keys.length === 0 && (
                    <div className="card glass" style={{ margin: 0, padding: '40px', textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔑</div>
                        <div style={{ fontWeight: 800, marginBottom: '8px' }}>No integration keys yet</div>
                        <div className="muted" style={{ fontSize: '13px' }}>Generate a key above to connect your website.</div>
                    </div>
                )}

                {keys.map(k => (
                    <div key={k.id} className="card glass" style={{ margin: 0, padding: '20px', border: expandedKey === k.id ? '1px solid rgba(56,189,248,0.3)' : undefined }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 900, fontSize: '14px' }}>{k.label}</div>
                                <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#38bdf8', marginTop: '4px', wordBreak: 'break-all' }}>{k.key}</div>
                                <div className="muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                                    Created {new Date(k.created_at).toLocaleDateString()}
                                    {k.last_used_at && ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                <CopyButton value={k.key} label="Copy Key" />
                                <button
                                    className="btn sm secondary"
                                    onClick={() => setExpandedKey(expandedKey === k.id ? null : k.id)}
                                    style={{ fontSize: '11px' }}
                                >
                                    {expandedKey === k.id ? 'Hide Setup' : 'View Setup'}
                                </button>
                                <button
                                    onClick={() => handleRevoke(k.id)}
                                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 800 }}
                                >
                                    Revoke
                                </button>
                            </div>
                        </div>

                        {expandedKey === k.id && (
                            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', color: '#a8b6dd' }}>
                                    Cloudflare / Backend Setup
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                                    {[
                                        { label: 'LUMIERE_INTAKE_URL', value: INTAKE_URL },
                                        { label: 'LUMIERE_INTAKE_SECRET', value: k.key }
                                    ].map(v => (
                                        <div key={v.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px 14px' }}>
                                            <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#fbbf24', minWidth: '200px' }}>{v.label}</span>
                                            <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'rgba(255,255,255,0.7)', flex: 1, wordBreak: 'break-all' }}>{v.value}</span>
                                            <CopyButton value={v.value} />
                                        </div>
                                    ))}
                                </div>
                                <div style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', color: '#a8b6dd' }}>
                                    Code Snippet
                                </div>
                                <CodeSnippet intakeKey={k.key} />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
