import React, { useState } from 'react';
import { apiPost } from '../../api';
import { useModal } from '../ModalContext.jsx';

export default function IntelligenceTab({ settings, setSettings, user, loading, setLoading, onReload }) {
    const modal = useModal();
    const [msg, setMsg] = useState('');
    const isAdmin = user?.email === 'joshua.deuermeyer@gmail.com' || user?.email === 'info@throughthelens.media';

    const handleSaveKey = async (e) => {
        e?.preventDefault?.();
        setMsg("Saving...");
        try {
            await apiPost('/settings', settings);
            setMsg("Key saved!");
            setTimeout(() => setMsg(''), 3000);
            onReload(true);
        } catch (err) { setMsg(`Error: ${err.message}`); }
    };

    const handleToggle = async (key, val) => {
        setSettings(prev => ({ ...prev, [key]: val }));
        await apiPost('/settings', { ...settings, [key]: val });
    };

    const handleRepair = async () => {
        if (!settings.gemini_api_key) return modal.alert("Please save your Gemini API Key first.");
        const ok = await modal.confirm("This will process your historical ledger through the AI Brain to fix old 'Rocket Money' entries. Proceed?");
        if (!ok) return;
        setLoading(true);
        try {
            const res = await apiPost('/brain/repair-ledger');
            const nextBatch = res.scanned === 50 ? "\n\n(Batch Limit: 50. Run again for next batch)" : "";
            modal.alert(`Success! The Brain scanned ${res.scanned} transactions and repaired ${res.updated} of them.${nextBatch}`);
            onReload(true);
        } catch (err) {
            modal.alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'grid', gap: 16 }}>
            <section className="card glass" style={{ margin: 0, padding: 'clamp(16px, 3vw, 24px)' }} aria-labelledby="ai-connection-heading">
                <div className="mobile-break" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22 }}>
                    <div style={{ maxWidth: 720 }}>
                        <h2 id="ai-connection-heading" style={{ fontSize: 20, margin: 0 }}>Connect your AI assistant</h2>
                        <p className="muted" style={{ fontSize: 14, lineHeight: 1.55, margin: '8px 0 0' }}>Add your own Google Gemini API key to enable financial questions, document analysis, and ledger cleanup.</p>
                    </div>
                    <div className="tag ok" style={{ fontWeight: 800 }}>Gemini 2.5 Flash</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                    <div>
                        <label htmlFor="gemini-api-key" className="muted" style={{ display: 'block', fontSize: 12, fontWeight: 900, letterSpacing: '.06em' }}>GEMINI API KEY</label>
                        <div className="mobile-break" style={{ display: 'flex', gap: 10, alignItems: 'stretch', marginTop: 8 }}>
                            <input
                                id="gemini-api-key"
                                type="password"
                                value={settings.gemini_api_key || ''}
                                onChange={e => setSettings(prev => ({ ...prev, gemini_api_key: e.target.value }))}
                                placeholder="Enter your Gemini API key"
                                autoComplete="off"
                                style={{ minHeight: 48, flex: 1 }}
                            />
                            <button type="button" className="btn primary" onClick={handleSaveKey} style={{ minHeight: 48, paddingInline: 20 }}>Save key</button>
                        </div>
                        <div role="status" aria-live="polite" style={{ marginTop: 10, minHeight: 20 }}>
                            {msg && <span className={`tag ${msg.includes('Error') ? 'bad' : 'ok'}`} style={{ fontWeight: 800 }}>{msg}</span>}
                        </div>
                        <div className="muted" style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5 }}>
                            Your key is saved to your account and used only when Lumière sends your requests to Gemini.
                        </div>
                        <div className="controls" style={{ alignItems: 'center', marginTop: 16 }}>
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="btn secondary">
                                Get or rotate key
                            </a>
                            {isAdmin && (
                                <a href="https://aistudio.google.com/app/rate-limit?timeRange=last-1-day" target="_blank" rel="noreferrer" className="btn secondary">
                                    Monitor quota
                                </a>
                            )}
                        </div>

                        {isAdmin && (
                            <div style={{ marginTop: '25px', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                    <small style={{ fontWeight: 900, color: 'var(--accent)', fontSize: '10px' }}>GOOGLE AI STUDIO — STUDIOTRACKER PROJECT</small>
                                    <div className="tag extra-small ok">TIER 1 ACTIVE</div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', textAlign: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '18px', fontWeight: 950 }}>1,000</div>
                                        <div className="muted extra-small" style={{ fontWeight: 800 }}>RPM LIMIT</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '18px', fontWeight: 950 }}>1M</div>
                                        <div className="muted extra-small" style={{ fontWeight: 800 }}>TPM LIMIT</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '18px', fontWeight: 950 }}>10,000</div>
                                        <div className="muted extra-small" style={{ fontWeight: 800 }}>RPD LIMIT</div>
                                    </div>
                                </div>
                                <div className="muted" style={{ marginTop: '12px', fontSize: '10px', textAlign: 'center', opacity: 0.5 }}>
                                    Reference limits — click MONITOR QUOTA for real-time usage
                                </div>
                            </div>
                        )}
                        <p className="muted" style={{ marginTop: 16, color: 'var(--warn)', fontSize: 12, lineHeight: 1.5 }}>
                            If Google reports a rate limit or zero limit, confirm that the Gemini API is enabled for the key's project and that Gemini 2.5 Flash is available in your region.
                        </p>

                        <div style={{ background: 'rgba(255,255,255,.02)', padding: 'clamp(14px, 2.5vw, 20px)', borderRadius: 14, border: '1px solid var(--line)', marginTop: 22 }}>
                            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Set up in four steps</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                                <div style={{ fontSize: '13px' }}>
                                    <div style={{ fontWeight: 850, marginBottom: 4 }}>1. Create a key</div>
                                    <div className="muted" style={{ fontSize: 13, lineHeight: 1.45 }}>Open Google AI Studio and generate an API key.</div>
                                </div>
                                <div style={{ fontSize: '13px' }}>
                                    <div style={{ fontWeight: 850, marginBottom: 4 }}>2. Connect Gemini</div>
                                    <div className="muted" style={{ fontSize: 13, lineHeight: 1.45 }}>Paste the key above and select <strong>Save key</strong>.</div>
                                </div>
                                <div style={{ fontSize: '13px' }}>
                                    <div style={{ fontWeight: 850, marginBottom: 4 }}>3. Clean up history</div>
                                    <div className="muted" style={{ fontSize: 13, lineHeight: 1.45 }}>Use ledger repair when older imports need attention.</div>
                                </div>
                                <div style={{ fontSize: '13px' }}>
                                    <div style={{ fontWeight: 850, marginBottom: 4 }}>4. Ask questions</div>
                                    <div className="muted" style={{ fontSize: 13, lineHeight: 1.45 }}>Open Your Assistant to analyze your finances and documents.</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 14, marginTop: 20 }}>
                        <div style={{ padding: 18, border: '1px solid var(--line)', borderRadius: 14, background: 'rgba(255,255,255,.02)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label htmlFor="ai-silent-mode" style={{ fontWeight: 800 }}>Background cleanup</label>
                                <label className="switch">
                                    <input id="ai-silent-mode" type="checkbox" checked={!!settings.ai_silent_mode} onChange={e => handleToggle('ai_silent_mode', e.target.checked)} />
                                    <span className="slider round"></span>
                                </label>
                            </div>
                            <p className="muted" style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.5 }}>Quietly standardize vendor names and repair missing account information.</p>
                        </div>

                        <div style={{ padding: 18, border: '1px solid var(--line)', borderRadius: 14, background: 'rgba(255,255,255,.02)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label htmlFor="ai-coaching-mode" style={{ fontWeight: 800 }}>Proactive guidance</label>
                                <label className="switch">
                                    <input id="ai-coaching-mode" type="checkbox" checked={!!settings.ai_coaching_mode} onChange={e => handleToggle('ai_coaching_mode', e.target.checked)} />
                                    <span className="slider round"></span>
                                </label>
                            </div>
                            <p className="muted" style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.5 }}>Surface possible overspending, tax risks, and recurring-charge savings.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="card glass" style={{ margin: 0, padding: 'clamp(16px, 3vw, 24px)' }} aria-labelledby="ledger-repair-heading">
                <div className="mobile-break" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}>
                    <div style={{ flex: 1 }}>
                        <h2 id="ledger-repair-heading" style={{ fontSize: 20, margin: 0 }}>Repair historical ledger data</h2>
                        <p className="muted" style={{ fontSize: 14, lineHeight: 1.55, margin: '8px 0 0' }}>
                            Scan older imports with Gemini to correct inconsistent vendor names and missing account details in batches of up to 50 transactions.
                        </p>
                        <span className="tag warn" style={{ marginTop: 12 }}>Usually takes 10–20 seconds per batch</span>
                    </div>
                    <button
                        type="button"
                        className="btn primary glow-blue"
                        onClick={handleRepair}
                        disabled={loading}
                        style={{ minHeight: 48, padding: '12px 20px' }}
                    >
                        {loading ? 'Scanning ledger…' : 'Start ledger repair'}
                    </button>
                </div>
            </section>
        </div>
    );
}
