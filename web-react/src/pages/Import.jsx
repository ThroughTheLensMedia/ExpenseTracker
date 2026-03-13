import React, { useState, useRef } from 'react';
import { invalidateExpensesCache } from '../api';

const BANK_PROFILES = [
    { key: 'rocketmoney', label: '🟣 Rocket Money' },
    { key: 'usbank', label: '🔵 US Bank' },
    { key: 'chase', label: '🔵 Chase' },
    { key: 'bankofamerica', label: '🔴 Bank of America' },
    { key: 'wellsfargo', label: '🟡 Wells Fargo' },
    { key: 'applecard', label: '⬛ Apple Card' },
    { key: 'capitalone', label: '🔴 Capital One' },
    { key: 'usaa', label: '🦅 USAA' },
    { key: 'navyfcu', label: '⚓ Navy Federal' },
    { key: 'wise', label: '🌍 Wise Bank' },
    { key: 'universal', label: '✨ Universal / Generic' },
];

const BANK_TIPS = {
    rocketmoney: 'Export from Rocket Money → Settings → Export. Positive = expense, negative = income.',
    usbank: 'Download CSV from US Bank online → Accounts → Download. Personal accounts use a single Amount column.',
    chase: 'Download from Chase → Account Activity → Download. Negative amounts = expenses.',
    bankofamerica: 'Download from BofA → Account Details → Download. Negative amounts = expenses.',
    wellsfargo: 'Download from Wells Fargo → Account Activity → Download Account Activity.',
    applecard: 'Export from iPhone Wallet app → Apple Card → Statements → Export Transactions.',
    capitalone: 'Download from Capital One → View Transactions → Download CSV. Uses separate Debit/Credit columns.',
    usaa: 'Download CSV from USAA Account Activity. Typically uses Date, Description, Amount format.',
    navyfcu: 'Export CSV from Navy Federal Online Banking. Supports both Transaction and Post date headers.',
    wise: 'Export statement as CSV from Wise. Supports multi-currency and merchant identification headers.',
    universal: 'For unsupported banks. We will attempt to match standard headers like "Date", "Amount", and "Vendor".',
};

export default function Import() {
    const fileInputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [rmMsg, setRmMsg] = useState('');
    const [rmErrors, setRmErrors] = useState([]);
    const [importSource, setImportSource] = useState('rocketmoney');
    const [detecting, setDetecting] = useState(false);
    const [detectedSource, setDetectedSource] = useState(null);
    const [pendingFile, setPendingFile] = useState(null);

    const detectAndStage = async (file) => {
        if (!file) return;
        setDetecting(true);
        setDetectedSource(null);
        setPendingFile(file);
        setRmMsg('');
        setRmErrors([]);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const r = await fetch('/api/import/detect', { method: 'POST', credentials: 'include', body: fd });
            const data = await r.json().catch(() => ({}));
            if (data.detected) {
                setImportSource(data.detected);
                setDetectedSource(data.detected);
                const profile = BANK_PROFILES.find(p => p.key === data.detected);
                setRmMsg(`🔍 Auto-detected: ${profile?.label || data.detected}. Confirm and click Import.`);
            } else {
                setRmMsg('⚠️ Could not auto-detect bank format. Please select your bank from the dropdown below, then click Import.');
            }
        } catch (e) {
            setRmMsg('⚠️ Detection failed. Select your bank manually and click Import.');
        } finally {
            setDetecting(false);
        }
    };

    const runImport = async (file, source) => {
        if (!file) return;
        setRmMsg('Importing…');
        setRmErrors([]);
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('source', source);
            const r = await fetch('/api/import/csv', { method: 'POST', credentials: 'include', body: fd });
            const data = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(data?.error || `${r.status} ${r.statusText}`);
            const ins = Number(data.inserted || 0), sk = Number(data.skipped || 0);
            setRmMsg(`✅ Done — ${ins.toLocaleString()} new, ${sk.toLocaleString()} duplicates skipped.`);
            setPendingFile(null);
            if (Array.isArray(data.errors) && data.errors.length) setRmErrors(data.errors);
            invalidateExpensesCache();
        } catch (e) {
            setRmMsg(`❌ Import failed: ${e.message}`);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) detectAndStage(e.dataTransfer.files[0]);
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files[0]) detectAndStage(e.target.files[0]);
    };

    return (
        <section style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '100px' }}>
            <div className="card glass glow-blue" style={{ padding: '24px 30px', border: 'none', marginBottom: '20px' }}>
                <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 950, letterSpacing: '-0.02em' }}>Bank Data Import</h1>
                <div className="muted" style={{ fontWeight: 600 }}>Sync External Accounts via CSV</div>
            </div>

            <div className="card glass" style={{ padding: '30px' }}>
                <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hide" onChange={handleFileSelect} />

                <div
                    className={`dropzone ${isDragging ? 'drag' : ''}`}
                    onClick={() => !pendingFile && fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    style={{
                        textAlign: 'center',
                        padding: '40px 20px',
                        cursor: pendingFile ? 'default' : 'pointer',
                        border: '2px dashed var(--line)',
                        borderRadius: '20px',
                        background: 'rgba(0,0,0,0.2)',
                        transition: 'all 0.2s ease'
                    }}
                >
                    {detecting ? (
                        <><div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
                            <div style={{ fontWeight: 800, fontSize: '18px' }}>Detecting bank format…</div></>
                    ) : pendingFile ? (
                        <><div style={{ fontSize: '32px', marginBottom: '12px' }}>📄</div>
                            <div style={{ fontWeight: 900, fontSize: '16px', color: '#fff' }}>{pendingFile.name}</div>
                            <button className="btn secondary" style={{ marginTop: '16px', fontSize: '12px' }} onClick={e => { e.stopPropagation(); setPendingFile(null); setRmMsg(''); setDetectedSource(null); fileInputRef.current.value = ''; }}>✕ Remove File</button></>
                    ) : (
                        <><div style={{ fontSize: '48px', marginBottom: '16px' }}>📂</div>
                            <div style={{ fontWeight: 950, fontSize: '20px', color: '#fff' }}>Drop your Bank CSV here</div>
                            <div className="muted" style={{ marginTop: '8px', fontSize: '14px' }}>or click to browse your computer</div></>
                    )}
                </div>

                <div style={{ marginTop: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <small className="muted" style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bank / Transaction Source</small>
                        {detectedSource && <span className="tag ok" style={{ fontSize: '10px', padding: '2px 8px' }}>Auto-detected</span>}
                    </div>
                    <select
                        value={importSource}
                        onChange={e => setImportSource(e.target.value)}
                        style={{ width: '100%', fontSize: '14px', padding: '12px' }}
                    >
                        {BANK_PROFILES.map(p => (
                            <option key={p.key} value={p.key}>{p.label}</option>
                        ))}
                    </select>
                    <div className="muted" style={{ marginTop: '10px', fontSize: '12px', lineHeight: 1.6, background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px' }}>
                        💡 <strong>Pro Tip:</strong> {BANK_TIPS[importSource] || 'Select your bank above.'}
                    </div>
                </div>

                {rmMsg && (
                    <div style={{
                        marginTop: '20px', padding: '14px 18px', borderRadius: '14px',
                        background: rmMsg.startsWith('✅') ? 'rgba(25,195,125,0.1)' : rmMsg.startsWith('❌') ? 'rgba(255,77,77,0.1)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${rmMsg.startsWith('✅') ? 'rgba(25,195,125,0.3)' : rmMsg.startsWith('❌') ? 'rgba(255,77,77,0.3)' : 'var(--line)'}`,
                        fontSize: '14px',
                        fontWeight: 600
                    }}>
                        {rmMsg}
                    </div>
                )}

                {pendingFile && !rmMsg.startsWith('✅') && !rmMsg.startsWith('Importing') && (
                    <button
                        className="btn glow-blue"
                        style={{ width: '100%', marginTop: '20px', fontSize: '16px', padding: '16px', fontWeight: 900 }}
                        onClick={() => runImport(pendingFile, importSource)}
                    >
                        🚀 Start Import from {BANK_PROFILES.find(p => p.key === importSource)?.label?.replace(/^.\s/, '') || importSource}
                    </button>
                )}

                {rmMsg.startsWith('Importing') && (
                    <div style={{ marginTop: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px', fontWeight: 700 }}>⏳ Processing ledger... please wait…</div>
                )}

                {rmErrors.length > 0 && (
                    <div className="tableWrap" style={{ marginTop: '20px', maxHeight: '250px', borderRadius: '12px', border: '1px solid rgba(255,77,77,0.2)' }}>
                        <table style={{ margin: 0 }}>
                            <thead style={{ background: 'rgba(255,77,77,0.05)' }}><tr><th>Row</th><th>Error Details</th></tr></thead>
                            <tbody>
                                {rmErrors.slice(0, 50).map((e, i) => (
                                    <tr key={i}><td>{e.row}</td><td style={{ color: '#ff7777', fontSize: '11px' }}>{e.error}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </section>
    );
}
