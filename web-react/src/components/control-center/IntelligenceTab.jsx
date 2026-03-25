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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <div className="card glass glow-blue" style={{ border: 'none', padding: '40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                    <div>
                        <h2 style={{ fontSize: '2rem', margin: 0 }}>Brain Connectivity & AI Engine</h2>
                        <p className="muted" style={{ fontSize: '16px', marginTop: '6px' }}>Power your studio with Google Gemini 2.5 Flash intelligence.</p>
                    </div>
                    <div className="tag ok" style={{ fontWeight: 800 }}>⚡ Gemini 2.5 Flash</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                    <div>
                        <small className="muted" style={{ fontWeight: 900 }}>GEMINI AI API KEY</small>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '8px' }}>
                            <input
                                type="password"
                                value={settings.gemini_api_key || ''}
                                onChange={e => setSettings(prev => ({ ...prev, gemini_api_key: e.target.value }))}
                                placeholder="AI_..."
                                style={{ padding: '15px', flex: 1 }}
                            />
                            <button className="btn primary" onClick={handleSaveKey} style={{ height: '54px' }}>Save Key</button>
                        </div>
                        <div style={{ marginTop: '10px', height: '20px' }}>
                            {msg && <span className={`${msg.includes('Error') ? 'tag bad' : 'tag ok'}`} style={{ fontWeight: 900, fontSize: '12px' }}>{msg}</span>}
                        </div>
                        <div className="muted extra-small" style={{ marginTop: '10px' }}>
                            Your key is stored securely in your private studio database and is only used to process your transactions.
                        </div>
                        <div style={{ marginTop: '20px', display: 'flex', gap: '15px' }}>
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" className="btn sm secondary" style={{ fontSize: '11px', fontWeight: 900 }}>
                                🗝️ ROTATE KEY
                            </a>
                            {isAdmin && (
                                <a href="https://aistudio.google.com/app/rate-limit?timeRange=last-1-day" target="_blank" className="btn sm secondary" style={{ fontSize: '11px', fontWeight: 900 }}>
                                    📊 MONITOR QUOTA
                                </a>
                            )}
                        </div>

                        {isAdmin && (
                            <div style={{ marginTop: '25px', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                    <small style={{ fontWeight: 900, color: 'var(--accent)', fontSize: '10px' }}>GOOGLE AI STUDIO PERFORMANCE HUB</small>
                                    <div className="tag extra-small ok">FREE TIER ACTIVE</div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', textAlign: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '18px', fontWeight: 950 }}>1 / 5</div>
                                        <div className="muted extra-small" style={{ fontWeight: 800 }}>RPM (Load)</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '18px', fontWeight: 950 }}>168 / 250K</div>
                                        <div className="muted extra-small" style={{ fontWeight: 800 }}>TPM (Token)</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '18px', fontWeight: 950 }}>1 / 20</div>
                                        <div className="muted extra-small" style={{ fontWeight: 800 }}>RPD (Daily)</div>
                                    </div>
                                </div>
                                <div style={{ marginTop: '15px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                                    <div style={{ width: '20%', height: '100%', background: 'var(--accent)' }}></div>
                                </div>
                            </div>
                        )}
                        <p className="muted small" style={{ marginTop: '15px', color: '#f59e0b', fontSize: '11px', lineHeight: '1.5' }}>
                            <strong>TIP:</strong> If you see a "Rate Limit" or "Limit: 0" error, ensure your Google Cloud project has enabled the <strong>Gemini API</strong> and that your region supports the Free Tier. Linking a billing account (even if not used) often resolves "Limit: 0" issues.
                        </p>

                        <div style={{ background: 'rgba(56, 189, 248, 0.05)', padding: '25px', borderRadius: '16px', border: '1px solid rgba(56, 189, 248, 0.2)', marginTop: '25px' }}>
                            <div style={{ fontWeight: 950, color: '#38bdf8', marginBottom: '15px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '24px' }}>🚀</span> STUDIO INTELLIGENCE: 4-STEP SETUP
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                                <div style={{ fontSize: '13px' }}>
                                    <div style={{ fontWeight: 900, color: 'white', marginBottom: '4px' }}>1. PROVISION KEY</div>
                                    <div className="muted" style={{ fontSize: '12px' }}>Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" style={{ color: 'var(--accent)' }}>Google AI Studio</a> and generate a free API Key.</div>
                                </div>
                                <div style={{ fontSize: '13px' }}>
                                    <div style={{ fontWeight: 900, color: 'white', marginBottom: '4px' }}>2. CONNECT BRAIN</div>
                                    <div className="muted" style={{ fontSize: '12px' }}>Paste your key into the input above and hit <strong>Save Key</strong>.</div>
                                </div>
                                <div style={{ fontSize: '13px' }}>
                                    <div style={{ fontWeight: 900, color: 'white', marginBottom: '4px' }}>3. SYSTEM WARMUP</div>
                                    <div className="muted" style={{ fontSize: '12px' }}>Use the <strong>Retroactive Ledger Repair</strong> below to scrub history and fix old entries.</div>
                                </div>
                                <div style={{ fontSize: '13px' }}>
                                    <div style={{ fontWeight: 900, color: 'white', marginBottom: '4px' }}>4. CHAT & ANALYZE</div>
                                    <div className="muted" style={{ fontSize: '12px' }}>Open "Your Assistant" (📸 icon) to ask about your largest purchases or tax burn.</div>
                                </div>
                            </div>
                            <div className="tag extra-small warning" style={{ marginTop: '20px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', fontSize: '10px', textAlign: 'center', width: '100%', fontWeight: 900 }}>
                                ⚠️ EVERY PHOTOGRAPHER "BRINGS THEIR OWN BRAIN"
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '10px' }}>
                        <div className="card glass" style={{ margin: 0, padding: '24px', background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontWeight: 800 }}>🤫 Silent Background Optimizer</div>
                                <label className="switch">
                                    <input type="checkbox" checked={!!settings.ai_silent_mode} onChange={e => handleToggle('ai_silent_mode', e.target.checked)} />
                                    <span className="slider round"></span>
                                </label>
                            </div>
                            <p className="muted extra-small" style={{ marginTop: '10px' }}>The Brain works quietly in the background to clean up vendor names and fix missing accounts.</p>
                        </div>

                        <div className="card glass" style={{ margin: 0, padding: '24px', background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontWeight: 800 }}>🗣️ Active Coaching Mode</div>
                                <label className="switch">
                                    <input type="checkbox" checked={!!settings.ai_coaching_mode} onChange={e => handleToggle('ai_coaching_mode', e.target.checked)} />
                                    <span className="slider round"></span>
                                </label>
                            </div>
                            <p className="muted extra-small" style={{ marginTop: '10px' }}>The Brain will proactively alert you to over-spending, tax risks, and subscription savings.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card glass" style={{ border: 'none', padding: '40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ fontSize: '1.8rem', margin: 0 }}>Retroactive Ledger Repair</h2>
                        <p className="muted" style={{ fontSize: '15px', marginTop: '10px' }}>
                            Have messy data from older imports? This tool scans your entire history and uses AI to fix incorrect vendor names and missing accounts.
                        </p>
                        <div className="tag extra-small warning" style={{ marginTop: '12px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                            ⚠️ Runs through Gemini 2.0 Flash in batches. May take 10-20 seconds.
                        </div>
                    </div>
                    <button
                        className="btn primary glow-blue"
                        onClick={handleRepair}
                        disabled={loading}
                        style={{ padding: '16px 40px', fontWeight: 950 }}
                    >
                        {loading ? '📸 BRAIN SCANNING...' : '🧼 START RETROACTIVE REPAIR'}
                    </button>
                </div>
            </div>
        </div>
    );
}
