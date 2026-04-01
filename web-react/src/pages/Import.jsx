import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { invalidateExpensesCache, formatMoney, formatDate } from '../api';
import { useAuth, supabase } from '../components/AuthContext';
import PlaidLink from '../components/PlaidLink';

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

// ── DuplicateReviewPanel ────────────────────────────────────────────────────
function DuplicateReviewPanel({ pairs, onMerge, onKeepBoth, onDismissAll }) {
    const [processing, setProcessing] = useState({});

    const handleMerge = async (pair, idx) => {
        setProcessing(p => ({ ...p, [idx]: 'merging' }));
        await onMerge(pair, idx);
        setProcessing(p => ({ ...p, [idx]: 'done' }));
    };

    const handleKeepBoth = (idx) => {
        onKeepBoth(idx);
    };

    const high = pairs.filter(p => p.confidence === 'high');
    const medium = pairs.filter(p => p.confidence === 'medium');

    return (
        <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                    <div style={{ fontWeight: 900, fontSize: '15px' }}>
                        🔍 {pairs.length} Potential Duplicate{pairs.length !== 1 ? 's' : ''} Found
                    </div>
                    <div className="muted" style={{ fontSize: '12px', marginTop: '4px' }}>
                        Review each pair and decide: merge (keep manual details + bank source) or keep both.
                    </div>
                </div>
                <button className="btn secondary" style={{ fontSize: '12px', padding: '6px 14px' }} onClick={onDismissAll}>
                    Dismiss All ✕
                </button>
            </div>

            {high.length > 0 && (
                <div style={{ marginBottom: '8px', fontSize: '11px', fontWeight: 800, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    ⚡ High Confidence — Same Vendor
                </div>
            )}
            {pairs.map((pair, idx) => {
                const { rowA, rowB, confidence } = pair;
                const isManualA = rowA.source === 'manual';
                const manual = isManualA ? rowA : rowB;
                const bank = isManualA ? rowB : rowA;
                const isDone = processing[idx] === 'done' || processing[idx] === 'dismissed';

                if (isDone) return null;

                return (
                    <div key={idx} style={{
                        marginBottom: '12px', borderRadius: '14px', overflow: 'hidden',
                        border: `1px solid ${confidence === 'high' ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.08)'}`,
                        background: 'rgba(0,0,0,0.2)'
                    }}>
                        {/* Confidence badge */}
                        <div style={{
                            padding: '8px 16px', fontSize: '10px', fontWeight: 900,
                            letterSpacing: '0.06em', textTransform: 'uppercase',
                            background: confidence === 'high' ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.04)',
                            color: confidence === 'high' ? '#f97316' : 'var(--muted)',
                            borderBottom: '1px solid rgba(255,255,255,0.05)'
                        }}>
                            {confidence === 'high' ? '⚡ High Confidence — Vendors Match' : '🔎 Medium Confidence — Same Amount, Manual Entry'}
                        </div>

                        {/* Side-by-side comparison */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                            {[
                                { row: manual, label: 'Manual Entry', icon: '✍️', color: '#38bdf8', win: 'category, notes, receipt, tax' },
                                { row: bank, label: 'Bank Import', icon: '🏦', color: '#4ade80', win: 'vendor, date, amount, source' }
                            ].map(({ row, label, icon, color, win }, side) => (
                                <div key={side} style={{
                                    padding: '16px',
                                    borderRight: side === 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                    background: side === 0 ? 'rgba(56,189,248,0.03)' : 'rgba(74,222,128,0.03)'
                                }}>
                                    <div style={{ fontSize: '10px', fontWeight: 900, color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                                        {icon} {label}
                                    </div>
                                    <div style={{ fontSize: '13px', fontWeight: 800, marginBottom: '4px' }}>{row.vendor}</div>
                                    <div className="muted" style={{ fontSize: '11px', marginBottom: '2px' }}>{formatDate(row.expense_date)}</div>
                                    <div style={{ fontWeight: 900, fontSize: '15px', color: '#fff', marginBottom: '8px' }}>{formatMoney(row.amount_cents)}</div>
                                    <div className="muted" style={{ fontSize: '10px', wordBreak: 'break-all' }}>{row.source}</div>
                                    {row.category && <div style={{ marginTop: '4px', fontSize: '10px', color: '#94a3b8' }}>📂 {row.category}</div>}
                                    {row.notes && <div style={{ marginTop: '4px', fontSize: '10px', color: '#94a3b8' }}>📝 {row.notes.slice(0, 60)}{row.notes.length > 60 ? '…' : ''}</div>}
                                    {row.receipt_link && <div style={{ marginTop: '4px', fontSize: '10px', color: '#4ade80' }}>🧾 Receipt attached</div>}
                                    <div style={{ marginTop: '8px', fontSize: '9px', color: color, fontWeight: 700, opacity: 0.7 }}>
                                        KEEPS: {win}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '10px', padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.1)' }}>
                            <button
                                id={`merge-pair-${idx}`}
                                className="btn glow-blue"
                                style={{ flex: 1, padding: '10px', fontSize: '12px', fontWeight: 900 }}
                                disabled={processing[idx] === 'merging'}
                                onClick={() => handleMerge(pair, idx)}
                            >
                                {processing[idx] === 'merging' ? '⏳ Merging…' : '⚡ Merge — Keep Best of Both'}
                            </button>
                            <button
                                className="btn secondary"
                                style={{ flex: 1, padding: '10px', fontSize: '12px', fontWeight: 700 }}
                                onClick={() => handleKeepBoth(idx)}
                            >
                                Keep Both
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── Main Import Page ────────────────────────────────────────────────────────
export default function Import() {
    const fileInputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [rmMsg, setRmMsg] = useState('');
    const [rmErrors, setRmErrors] = useState([]);
    const [importSource, setImportSource] = useState('rocketmoney');
    const [detecting, setDetecting] = useState(false);
    const [detectedSource, setDetectedSource] = useState(null);
    const [pendingFile, setPendingFile] = useState(null);
    const [showPlaid, setShowPlaid] = useState(false);

    // Duplicate scanner state
    const [scanning, setScanning] = useState(false);
    const [scanResult, setScanResult] = useState(null); // { merged, pending, total_scanned }
    const [pendingPairs, setPendingPairs] = useState([]);
    const [dismissedPairs, setDismissedPairs] = useState(new Set());

    const navigate = useNavigate();

    const getFreshAuthHeader = async () => {
        try {
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            const t = currentSession?.access_token;
            return t ? { 'Authorization': `Bearer ${t}` } : {};
        } catch (e) {
            return {};
        }
    };

    const detectAndStage = async (file) => {
        if (!file) return;
        setDetecting(true);
        setDetectedSource(null);
        setPendingFile(file);
        setRmMsg('');
        setRmErrors([]);
        try {
            const headers = await getFreshAuthHeader();
            const fd = new FormData();
            fd.append('file', file);
            const r = await fetch('/api/import/detect', { method: 'POST', credentials: 'include', headers, body: fd });
            const data = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(data.error || `${r.status} ${r.statusText}`);
            if (data.detected) {
                setImportSource(data.detected);
                setDetectedSource(data.detected);
                const profile = BANK_PROFILES.find(p => p.key === data.detected);
                setRmMsg(`🔍 Auto-detected: ${profile?.label || data.detected}. Confirm and click Import.`);
            } else {
                setRmMsg('⚠️ Could not auto-detect bank format. Please select your bank from the dropdown below, then click Import.');
            }
        } catch (e) {
            setRmMsg(`⚠️ Detection failed: ${e.message}`);
        } finally {
            setDetecting(false);
        }
    };

    const runImport = async (file, source) => {
        if (!file) return;
        setRmMsg('Importing…');
        setRmErrors([]);
        try {
            const headers = await getFreshAuthHeader();
            const fd = new FormData();
            fd.append('file', file);
            fd.append('source', source);
            const r = await fetch('/api/import/csv', { method: 'POST', credentials: 'include', headers, body: fd });
            const data = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(data?.error || `${r.status} ${r.statusText}`);
            const ins = Number(data.inserted || 0);
            const mrg = Number(data.merged || 0);
            const sk = Number(data.skipped || 0);
            const parts = [];
            if (ins > 0) parts.push(`${ins.toLocaleString()} new`);
            if (mrg > 0) parts.push(`${mrg.toLocaleString()} merged with manual entries`);
            if (sk > 0) parts.push(`${sk.toLocaleString()} exact duplicates skipped`);
            setRmMsg(`✅ Done — ${parts.join(', ')}.`);
            setPendingFile(null);
            if (Array.isArray(data.errors) && data.errors.length) setRmErrors(data.errors);
            invalidateExpensesCache();
        } catch (e) {
            setRmMsg(`❌ Import failed: ${e.message}`);
        }
    };

    const runDuplicateScan = async (autoMerge = false) => {
        setScanning(true);
        setScanResult(null);
        setPendingPairs([]);
        setDismissedPairs(new Set());
        try {
            const headers = await getFreshAuthHeader();
            const r = await fetch('/api/import/find-duplicates', {
                method: 'POST',
                credentials: 'include',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ auto_merge: autoMerge })
            });
            const data = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(data?.error || r.statusText);
            setScanResult(data);
            setPendingPairs(data.pending || []);
            if (autoMerge || data.merged > 0) invalidateExpensesCache();
        } catch (e) {
            setScanResult({ error: e.message });
        } finally {
            setScanning(false);
        }
    };

    const handleConfirmMerge = async (pair, idx) => {
        try {
            const headers = await getFreshAuthHeader();
            // Keep the manual entry's ID; drop the bank row's ID
            const isManualA = pair.rowA.source === 'manual';
            const keepId = isManualA ? pair.rowA.id : pair.rowB.id;
            const dropId = isManualA ? pair.rowB.id : pair.rowA.id;
            const r = await fetch('/api/import/confirm-merge', {
                method: 'POST',
                credentials: 'include',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ keepId, dropId })
            });
            const data = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(data?.error || r.statusText);
            invalidateExpensesCache();
            // Remove pair from list
            setPendingPairs(prev => prev.filter((_, i) => i !== idx));
        } catch (e) {
            console.error('Merge failed:', e.message);
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

    const visiblePairs = pendingPairs.filter((_, i) => !dismissedPairs.has(i));

    return (
        <section style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '100px' }}>
            <div className="card glass glow-blue" style={{ padding: '24px 30px', border: 'none', marginBottom: '20px' }}>
                <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 950, letterSpacing: '-0.02em' }}>Bank Data Import</h1>
                <div className="muted" style={{ fontWeight: 600 }}>Import transactions from your bank via CSV · Duplicate merging enabled</div>
            </div>

            {/* Plaid Auto-Sync */}
            <div className="card glass" style={{ margin: '0 0 20px 0', padding: 0, overflow: 'hidden' }}>
                <button
                    onClick={() => setShowPlaid(!showPlaid)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '13px', fontWeight: 800, letterSpacing: '0.03em' }}
                >
                    <span>🏦 Bank Auto-Sync via Plaid {!showPlaid && <span style={{ opacity: 0.4, fontWeight: 500, marginLeft: '8px' }}>Coming Soon</span>}</span>
                    <span style={{ fontSize: '11px', transition: 'transform 0.2s', transform: showPlaid ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                </button>
                {showPlaid && (
                    <div style={{ padding: '0 24px 24px' }}>
                        <PlaidLink onSync={() => invalidateExpensesCache()} />
                    </div>
                )}
            </div>

            {/* CSV Import Card */}
            <div className="card glass" style={{ padding: '30px', marginBottom: '20px' }}>
                <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hide" onChange={handleFileSelect} />

                <div
                    className={`dropzone ${isDragging ? 'drag' : ''}`}
                    onClick={() => !pendingFile && fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    style={{ textAlign: 'center', padding: '40px 20px', cursor: pendingFile ? 'default' : 'pointer', border: '2px dashed var(--line)', borderRadius: '20px', background: 'rgba(0,0,0,0.2)', transition: 'all 0.2s ease' }}
                >
                    {detecting ? (
                        <><div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div><div style={{ fontWeight: 800, fontSize: '18px' }}>Detecting bank format…</div></>
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
                    <select value={importSource} onChange={e => setImportSource(e.target.value)} style={{ width: '100%', fontSize: '14px', padding: '12px' }}>
                        {BANK_PROFILES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                    </select>
                    <div className="muted" style={{ marginTop: '10px', fontSize: '12px', lineHeight: 1.6, background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px' }}>
                        💡 <strong>Pro Tip:</strong> {BANK_TIPS[importSource] || 'Select your bank above.'}
                    </div>
                </div>

                {/* Merge behavior note */}
                <div style={{ marginTop: '14px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)', fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                    🔀 <strong style={{ color: '#4ade80' }}>Smart Merge Active:</strong> If this import matches a manual entry within ±2 days (same amount), it will automatically merge — keeping your category, notes & receipt, updating it with the bank's authoritative source and date.
                </div>

                {rmMsg && (
                    <div style={{ marginTop: '20px', padding: '14px 18px', borderRadius: '14px', background: rmMsg.startsWith('✅') ? 'rgba(25,195,125,0.1)' : rmMsg.startsWith('❌') ? 'rgba(255,77,77,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${rmMsg.startsWith('✅') ? 'rgba(25,195,125,0.3)' : rmMsg.startsWith('❌') ? 'rgba(255,77,77,0.3)' : 'var(--line)'}`, fontSize: '14px', fontWeight: 600 }}>
                        {rmMsg}
                    </div>
                )}

                {rmMsg.startsWith('✅') && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '20px' }}>
                        <button className="btn secondary" style={{ padding: '16px', fontWeight: 900, borderRadius: '14px' }} onClick={() => navigate('/')}>📊 GO TO DASHBOARD</button>
                        <button className="btn primary glow-blue" style={{ padding: '16px', fontWeight: 900, borderRadius: '14px' }} onClick={() => navigate('/transactions')}>📑 VIEW LEDGER</button>
                    </div>
                )}

                {pendingFile && !rmMsg.startsWith('✅') && !rmMsg.startsWith('Importing') && (
                    <button className="btn glow-blue" style={{ width: '100%', marginTop: '20px', fontSize: '16px', padding: '16px', fontWeight: 900 }} onClick={() => runImport(pendingFile, importSource)}>
                        🚀 Start Import from {BANK_PROFILES.find(p => p.key === importSource)?.label?.replace(/^.\s/, '') || importSource}
                    </button>
                )}

                {rmMsg.startsWith('Importing') && (
                    <div style={{ marginTop: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px', fontWeight: 700 }}>⏳ Processing ledger... please wait…</div>
                )}

                {/* Import log */}
                {rmErrors.length > 0 && (
                    <div className="tableWrap" style={{ marginTop: '20px', maxHeight: '350px', borderRadius: '12px', border: '1px solid var(--line)', background: 'rgba(0,0,0,0.2)' }}>
                        <table style={{ margin: 0 }}>
                            <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
                                <tr>
                                    <th style={{ width: '60px' }}>Row</th>
                                    <th>Processing Details &amp; Import Context</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rmErrors.slice(0, 100).map((e, i) => (
                                    <tr key={i}>
                                        <td style={{ fontSize: '11px', opacity: 0.6 }}>{e.row}</td>
                                        <td style={{
                                            fontSize: '11px',
                                            color: e.type === 'merged' ? '#4ade80' : e.type === 'info' ? 'var(--muted)' : '#ff7777',
                                            fontWeight: e.type === 'info' ? 500 : 700
                                        }}>
                                            {e.type === 'merged' ? '⚡ ' : e.type === 'info' ? 'ℹ️ ' : '⚠️ '}
                                            {e.error}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Retroactive Duplicate Scanner ───────────────────────────────── */}
            <div className="card glass" style={{ padding: '24px 30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
                    <div>
                        <div style={{ fontWeight: 900, fontSize: '16px', marginBottom: '6px' }}>🔍 Retroactive Duplicate Scanner</div>
                        <div className="muted" style={{ fontSize: '13px', lineHeight: 1.6 }}>
                            Scans your entire ledger for existing duplicates — catches entries made before the smart merge was added, or ones that slipped through.
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <button
                        id="scan-review-btn"
                        className="btn secondary"
                        style={{ padding: '14px', fontWeight: 900, fontSize: '13px', borderColor: 'rgba(56,189,248,0.4)', color: '#38bdf8' }}
                        disabled={scanning}
                        onClick={() => runDuplicateScan(false)}
                    >
                        {scanning ? '⏳ Scanning…' : '🔎 Scan & Review'}
                    </button>
                    <button
                        id="scan-auto-merge-btn"
                        className="btn secondary"
                        style={{ padding: '14px', fontWeight: 900, fontSize: '13px', borderColor: 'rgba(249,115,22,0.4)', color: '#f97316' }}
                        disabled={scanning}
                        onClick={() => runDuplicateScan(true)}
                    >
                        {scanning ? '⏳ Scanning…' : '⚡ Auto-Merge High Confidence'}
                    </button>
                </div>

                {/* Scan result summary */}
                {scanResult && !scanResult.error && (
                    <div style={{ marginTop: '16px', padding: '14px 18px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)', fontSize: '13px' }}>
                        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                            <div><span style={{ fontWeight: 900, color: '#4ade80' }}>{scanResult.merged}</span> <span className="muted">auto-merged</span></div>
                            <div><span style={{ fontWeight: 900, color: '#38bdf8' }}>{visiblePairs.length}</span> <span className="muted">pending review</span></div>
                            <div><span style={{ fontWeight: 900, color: 'var(--muted)' }}>{scanResult.total_scanned?.toLocaleString()}</span> <span className="muted">rows scanned</span></div>
                        </div>
                        {scanResult.merged > 0 && (
                            <div style={{ marginTop: '10px', fontSize: '12px', color: '#4ade80', fontWeight: 700 }}>
                                ✅ {scanResult.merged} duplicate{scanResult.merged !== 1 ? 's' : ''} merged. Your ledger is cleaner!
                            </div>
                        )}
                        {visiblePairs.length === 0 && scanResult.merged === 0 && (
                            <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--muted)' }}>
                                🎉 No duplicates found — your ledger is clean!
                            </div>
                        )}
                    </div>
                )}

                {scanResult?.error && (
                    <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(255,77,77,0.1)', border: '1px solid rgba(255,77,77,0.3)', fontSize: '13px', color: '#ff7777' }}>
                        ❌ Scan failed: {scanResult.error}
                    </div>
                )}

                {/* Review pairs */}
                {visiblePairs.length > 0 && (
                    <DuplicateReviewPanel
                        pairs={visiblePairs}
                        onMerge={async (pair, visibleIdx) => {
                            // Find real index in pendingPairs
                            const realPair = visiblePairs[visibleIdx];
                            const realIdx = pendingPairs.indexOf(realPair);
                            await handleConfirmMerge(realPair, realIdx);
                        }}
                        onKeepBoth={(visibleIdx) => {
                            const realPair = visiblePairs[visibleIdx];
                            const realIdx = pendingPairs.indexOf(realPair);
                            setDismissedPairs(prev => new Set([...prev, realIdx]));
                        }}
                        onDismissAll={() => {
                            const allIdxs = pendingPairs.map((_, i) => i);
                            setDismissedPairs(new Set(allIdxs));
                        }}
                    />
                )}
            </div>
        </section>
    );
}
