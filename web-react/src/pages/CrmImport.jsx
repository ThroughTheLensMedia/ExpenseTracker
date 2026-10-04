import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiPost, apiUpload, apiDelete, formatMoney, invalidateCache } from '../api';
import { useModal } from '../components/ModalContext.jsx';

const TYPES = [
    { key: 'contacts', label: 'Contacts / Clients', hint: 'Your customer list', ready: true },
    { key: 'invoices', label: 'Invoices', hint: 'Import contacts first', ready: true },
    { key: 'vendors', label: 'Vendors', hint: 'Who you pay', ready: true },
    { key: 'expenses', label: 'Expenses', hint: 'Import vendors first', ready: true },
];
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const HOLDING = '__holding__';
const IGNORE = '__ignore__';
const BOX = { background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)', borderRadius: 12, padding: 14 };
const CTRL = { minHeight: 44, fontSize: 14 };

const KIND_LABEL = {
    already_imported: 'Already imported from this system',
    email: 'Same email as an existing client',
    name: 'Same name as an existing client',
    in_file: 'Repeated earlier in this file',
    number: 'Invoice number already exists',
    exact: 'Same date, vendor and amount already in your ledger',
    similar: 'Same amount within 2 days — likely the same purchase from your bank',
};
const NOUN = { contacts: 'client', vendors: 'vendor', invoices: 'invoice', expenses: 'record' }; // expense imports also carry mileage trips

function downloadReport(filename, errors, warnings) {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['type', 'where', 'message'].join(',')];
    errors.forEach(e => lines.push([esc('error'), esc(e.invoice ? `invoice ${e.invoice}` : `row ${e.row}`), esc(e.error)].join(',')));
    warnings.forEach(w => (w.messages || []).forEach(m => lines.push([esc('warning'), esc(w.invoice ? `invoice ${w.invoice}` : `row ${w.row}`), esc(m)].join(','))));
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

function Stat({ label, value, color }) {
    return (
        <div className="stat glass" style={{ textAlign: 'center', padding: 16 }}>
            <div className="muted small" style={{ fontWeight: 800 }}>{label}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 950, color, marginTop: 4 }}>{value}</div>
        </div>
    );
}

export default function CrmImport() {
    const modal = useModal();
    const fileRef = useRef(null);
    const [type, setType] = useState('contacts');
    const [file, setFile] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [mapping, setMapping] = useState({});
    const [aiTags, setAiTags] = useState({});
    const [preview, setPreview] = useState(null);
    const [decisions, setDecisions] = useState({});
    const [createMissing, setCreateMissing] = useState(true);
    const [markDeductible, setMarkDeductible] = useState(true);
    const [result, setResult] = useState(null);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [showMatched, setShowMatched] = useState(false);
    const [batches, setBatches] = useState([]);
    const [dragging, setDragging] = useState(false);

    const step = result ? 'done' : preview ? 'review' : analysis ? 'map' : 'upload';

    const loadBatches = useCallback(() => apiGet('/crm-import/batches').then(r => setBatches(r.data || [])).catch(() => { }), []);
    useEffect(() => { loadBatches(); }, [loadBatches]);

    const reset = () => { setMarkDeductible(true); setFile(null); setAnalysis(null); setMapping({}); setAiTags({}); setPreview(null); setDecisions({}); setResult(null); setError(''); setShowMatched(false); if (fileRef.current) fileRef.current.value = ''; };

    const form = (extra = {}) => {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('type', type);
        Object.entries(extra).forEach(([k, v]) => fd.append(k, typeof v === 'string' ? v : JSON.stringify(v)));
        return fd;
    };

    const analyze = async f => {
        // Vercel rejects request bodies over ~4.5MB, and each step re-sends the file.
        if (f.size > MAX_FILE_BYTES) { setError(`That file is ${(f.size / 1048576).toFixed(1)} MB. The limit is 4 MB — export it in smaller pieces (for example one year at a time) and import them one after another.`); return; }
        setError(''); setBusy('Reading your file…'); setFile(f);
        try {
            const fd = new FormData();
            fd.append('file', f); fd.append('type', type);
            const a = await apiUpload('/crm-import/analyze', fd);
            setAnalysis(a);
            setMapping(Object.fromEntries(Object.entries(a.mapping).map(([h, m]) => [h, m.target])));
            if (a.aiAvailable && a.unresolved.length) suggest(a);
        } catch (e) { setError(e.message); setFile(null); } finally { setBusy(''); }
    };

    // Optional Gemini pass: sends header names only; the user can always override.
    const suggest = async a => {
        try {
            const r = await apiPost('/crm-import/suggest', { type: a.type, headers: a.unresolved.map(u => u.header) });
            const tags = r.suggestions || {};
            setAiTags(tags);
            setMapping(m => { const next = { ...m }; Object.entries(tags).forEach(([h, s]) => { if (a.unresolved.some(u => u.header === h)) next[h] = s.target; }); return next; });
        } catch { /* suggestions are a convenience */ }
    };

    const runPreview = async () => {
        setError(''); setBusy('Checking for duplicates and problems…');
        try {
            const p = await apiUpload('/crm-import/preview', form({ sourceSystem: analysis.detectedSource, mapping, markDeductible: String(markDeductible) }));
            setPreview(p);
            setDecisions(Object.fromEntries((p.duplicates || []).map(d => [d.key, d.defaultDecision])));
            setCreateMissing(true);
        } catch (e) { setError(e.message); } finally { setBusy(''); }
    };

    const commit = async () => {
        setError(''); setBusy('Importing… this can take a minute for large files.');
        try {
            const r = await apiUpload('/crm-import/commit', form({ sourceSystem: analysis.detectedSource, mapping, decisions, createMissingClients: String(createMissing), markDeductible: String(markDeductible) }));
            setResult(r);
            invalidateCache('clients'); invalidateCache('invoices');
            loadBatches();
        } catch (e) { setError(e.message); } finally { setBusy(''); }
    };

    const undo = async batch => {
        if (!(await modal.confirm(`Undo the ${batch.entity_type} import "${batch.filename || 'file'}"? Records it created will be removed. Clients that were merged into existing ones stay as they are.`))) return;
        try { await apiDelete(`/crm-import/batches/${batch.id}`); invalidateCache('clients'); invalidateCache('invoices'); await loadBatches(); if (result?.batchId === batch.id) reset(); }
        catch (e) { await modal.alert(e.message); }
    };

    const unresolvedHeaders = analysis ? analysis.unresolved.map(u => u.header) : [];
    const matched = analysis ? analysis.headers.filter(h => !unresolvedHeaders.includes(h) && analysis.mapping[h].confidence !== 'empty') : [];
    const emptyCols = analysis ? analysis.headers.filter(h => analysis.mapping[h].confidence === 'empty') : [];
    const labelOf = key => analysis?.targets.find(t => t.key === key)?.label || key;
    const targetOptions = analysis?.targets || [];
    const usedTargets = h => new Set(Object.entries(mapping).filter(([k, v]) => k !== h && v !== HOLDING && v !== IGNORE).map(([, v]) => v));

    const s = preview?.summary;
    // Records that will actually be written: new rows plus any duplicate the user chose to merge / keep / renumber.
    const actionCount = preview ? s.newCount + (s.mileageCount || 0) + (preview.duplicates || []).filter(d => (decisions[d.key] || d.defaultDecision) !== 'skip').length : 0;

    return (
        <div className="page" style={{ maxWidth: 980, margin: '0 auto', padding: '0 16px 60px' }}>
            <div style={{ marginBottom: 20 }}>
                <Link to="/import" className="muted small" style={{ fontWeight: 700 }}>← Back to Import</Link>
                <h1 style={{ margin: '8px 0 4px' }}>Import from another system</h1>
                <div className="muted" style={{ fontWeight: 600 }}>Bring your clients and invoice history over from your old software. Nothing is written until you review it, and every import can be undone.</div>
            </div>

            {error && <div className="tag bad" style={{ width: '100%', padding: 14, marginBottom: 16, whiteSpace: 'normal' }}>{error}</div>}
            {busy && <div className="card glass" style={{ padding: 20, marginBottom: 16, textAlign: 'center', fontWeight: 800 }}>⏳ {busy}</div>}

            {step === 'upload' && (
                <div className="card glass" style={{ padding: 24, marginBottom: 20 }}>
                    <small className="muted" style={{ fontWeight: 800, letterSpacing: '0.05em' }}>1 · WHAT ARE YOU IMPORTING?</small>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, margin: '12px 0 8px' }}>
                        {TYPES.map(t => (
                            <button key={t.key} type="button" disabled={!t.ready} onClick={() => setType(t.key)} aria-pressed={type === t.key}
                                className={`btn ${type === t.key ? 'glow-blue' : 'secondary'}`} style={{ ...CTRL, textAlign: 'left', padding: '10px 14px', opacity: t.ready ? 1 : 0.5, display: 'block' }}>
                                <div style={{ fontWeight: 900 }}>{t.label}</div>
                                <div className="small" style={{ opacity: 0.7 }}>{t.hint}</div>
                            </button>
                        ))}
                    </div>
                    <div className="muted small" style={{ marginBottom: 16 }}>Import <strong>contacts first</strong>, then invoices, so each invoice links to its client. Import <strong>vendors before expenses</strong>.</div>

                    <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={e => e.target.files[0] && analyze(e.target.files[0])} />
                    <div role="button" tabIndex={0} onClick={() => !busy && fileRef.current?.click()} onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
                        onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
                        onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0] && !busy) analyze(e.dataTransfer.files[0]); }}
                        style={{ textAlign: 'center', padding: '40px 20px', cursor: 'pointer', border: `2px dashed ${dragging ? '#4c7dff' : 'var(--line)'}`, borderRadius: 20, background: 'rgba(0,0,0,0.2)' }}>
                        <div style={{ fontSize: 40, marginBottom: 10 }}>📂</div>
                        <div style={{ fontWeight: 900, fontSize: 18 }}>Drop your {TYPES.find(t => t.key === type).label} CSV here</div>
                        <div className="muted small" style={{ marginTop: 6 }}>or click to browse · the first row must be the column headers</div>
                    </div>
                </div>
            )}

            {step === 'map' && analysis && (
                <div className="card glass" style={{ padding: 24, marginBottom: 20 }}>
                    <small className="muted" style={{ fontWeight: 800, letterSpacing: '0.05em' }}>2 · CHECK THE COLUMN MATCHING</small>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '10px 0' }}>
                        <strong>{analysis.filename}</strong>
                        <span className="muted small">{analysis.rowCount.toLocaleString()} rows</span>
                        {analysis.detectedSource === 'zoho' && <span className="tag ok">Zoho Books export detected</span>}
                    </div>
                    {analysis.typeWarning && <div className="tag warn" style={{ width: '100%', padding: 12, marginBottom: 12, whiteSpace: 'normal' }}>{analysis.typeWarning}</div>}

                    <div style={{ ...BOX, marginBottom: 14 }}>
                        <button type="button" className="btn sm secondary" style={CTRL} onClick={() => setShowMatched(v => !v)}>
                            ✅ {matched.length} columns matched automatically {showMatched ? '▲' : '▼'}
                        </button>
                        {showMatched && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 8, marginTop: 12 }}>
                                {matched.map(h => (
                                    <div key={h} className="small" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                                        <span style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{h}</span>
                                        <span className="muted" style={{ textAlign: 'right' }}>{mapping[h] === HOLDING ? 'holding area' : mapping[h] === IGNORE ? 'ignored' : labelOf(mapping[h])}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {emptyCols.length > 0 && <div className="muted small" style={{ marginTop: 10 }}>{emptyCols.length} empty column{emptyCols.length === 1 ? '' : 's'} skipped automatically.</div>}
                    </div>

                    {analysis.unresolved.length > 0 ? (
                        <>
                            <div style={{ fontWeight: 900, marginBottom: 4 }}>{analysis.unresolved.length} column{analysis.unresolved.length === 1 ? '' : 's'} need your help</div>
                            <div className="muted small" style={{ marginBottom: 12 }}>Pick where each one belongs. "Keep in holding area" saves it with the record so nothing is lost.</div>
                            <div style={{ display: 'grid', gap: 10 }}>
                                {analysis.unresolved.map(u => {
                                    const taken = usedTargets(u.header);
                                    return (
                                        <div key={u.header} style={BOX}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                                                <strong style={{ overflowWrap: 'anywhere' }}>{u.header}</strong>
                                                {aiTags[u.header] && <span className="tag" title="Suggested by your Gemini key from the column name only">✨ AI suggestion · {aiTags[u.header].confidence}</span>}
                                            </div>
                                            <div className="muted small" style={{ margin: '4px 0 8px', overflowWrap: 'anywhere' }}>e.g. {u.samples.join(' · ') || '—'}</div>
                                            <select value={mapping[u.header]} onChange={e => setMapping(m => ({ ...m, [u.header]: e.target.value }))} style={{ ...CTRL, width: '100%' }} aria-label={`Where should ${u.header} go?`}>
                                                {targetOptions.filter(t => !taken.has(t.key) || t.key === mapping[u.header] || t.key === HOLDING || t.key === IGNORE).map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                                            </select>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : <div className="tag ok" style={{ padding: 12 }}>Every column with data was matched — nothing to decide.</div>}

                    {type === 'expenses' && (
                        <label style={{ ...BOX, display: 'flex', gap: 10, alignItems: 'flex-start', minHeight: 44, cursor: 'pointer', marginTop: 14 }}>
                            <input type="checkbox" checked={markDeductible} onChange={e => setMarkDeductible(e.target.checked)} style={{ width: 22, height: 22, flexShrink: 0 }} />
                            <span><strong>Mark imported business expenses as tax deductible</strong><span className="muted small" style={{ display: 'block' }}>Only categories with a clear Schedule C match are marked; anything else stays for you to decide. Your own rules always win. You can review everything on the Tax page.</span></span>
                        </label>
                    )}

                    <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
                        <button className="btn secondary" style={CTRL} onClick={reset}>← Choose another file</button>
                        <button className="btn glow-blue" style={{ ...CTRL, flex: 1, fontWeight: 900 }} onClick={runPreview} disabled={!!busy}>Preview import →</button>
                    </div>
                </div>
            )}

            {step === 'review' && preview && (
                <div className="card glass" style={{ padding: 24, marginBottom: 20 }}>
                    <small className="muted" style={{ fontWeight: 800, letterSpacing: '0.05em' }}>3 · REVIEW — NOTHING IS SAVED YET</small>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 12, margin: '14px 0' }}>
                        <Stat label="NEW" value={s.newCount} color="#4ade80" />
                        <Stat label="DUPLICATES" value={s.duplicates} color="#fbbf24" />
                        <Stat label="PROBLEMS" value={s.errors} color={s.errors ? '#ff7777' : undefined} />
                        <Stat label="NOTES" value={s.warnings} />
                        {preview.type === 'invoices' && <Stat label="STILL OPEN" value={s.openCount} color="#fb923c" />}
                        {preview.type === 'expenses' && <Stat label="MILEAGE TRIPS" value={s.mileageCount} color="#38bdf8" />}
                    </div>

                    {preview.type === 'expenses' && (
                        <div style={{ ...BOX, marginBottom: 14 }}>
                            <strong>{formatMoney(s.totalCents)} across {s.newCount} new expense{s.newCount === 1 ? '' : 's'}{s.dateFrom ? ` · ${s.dateFrom} to ${s.dateTo}` : ''}</strong>
                            <div className="muted small" style={{ marginTop: 4 }}>
                                {s.categoriesMapped} account name{s.categoriesMapped === 1 ? '' : 's'} matched to Ledger categories; {s.categoriesKept} kept under your own label.
                                {markDeductible ? ` ${s.deductibleCount} marked tax deductible.` : ' None marked tax deductible.'}
                                {s.mileageCount > 0 && ` ${s.mileageCount} mileage entr${s.mileageCount === 1 ? 'y goes' : 'ies go'} to your Mileage log instead of expenses, so the deduction isn't counted twice.`}
                                {s.mileageSkipped > 0 && ` ${s.mileageSkipped} trip${s.mileageSkipped === 1 ? ' was' : 's were'} already in your log.`}
                            </div>
                            {preview.categories.length > 0 && (
                                <details style={{ marginTop: 8 }}>
                                    <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>See how accounts were matched</summary>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 6 }}>
                                        {preview.categories.map(c => (
                                            <div key={c.original} className="small" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                                                <span style={{ overflowWrap: 'anywhere' }}>{c.original} <span className="muted">({c.count})</span></span>
                                                <span className="muted" style={{ textAlign: 'right' }}>{c.mapped ? `→ ${c.category}` : 'kept as is'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            )}
                        </div>
                    )}

                    {preview.type === 'invoices' && s.openCount > 0 && (
                        <div style={{ ...BOX, borderColor: 'rgba(251,146,60,0.4)', marginBottom: 14 }}>
                            <strong>{s.openCount} unpaid invoice{s.openCount === 1 ? '' : 's'} · {formatMoney(s.openBalanceCents)} outstanding</strong>
                            <div className="muted small" style={{ marginTop: 4 }}>They'll be flagged <strong>Open in old system</strong> so you can finish them in both places. The flag stays until you clear it yourself.{s.partialCount > 0 && ` ${s.partialCount} partly paid invoice${s.partialCount === 1 ? ' is' : 's are'} imported at the balance still owed.`}</div>
                        </div>
                    )}
                    {(preview.type === 'contacts' || preview.type === 'vendors') && s.withTaxId > 0 && <div className="muted small" style={{ marginBottom: 14 }}>🔒 {s.withTaxId} tax ID{s.withTaxId === 1 ? '' : 's'} will be stored encrypted and shown masked.</div>}

                    {preview.type === 'invoices' && preview.unmatchedCount > 0 && (
                        <div style={{ ...BOX, marginBottom: 14 }}>
                            <strong>{preview.unmatchedCount} customer{preview.unmatchedCount === 1 ? ' isn\'t' : 's aren\'t'} in your clients yet</strong>
                            <div className="muted small" style={{ margin: '4px 0 8px', overflowWrap: 'anywhere' }}>{preview.unmatchedCustomers.slice(0, 8).map(u => `${u.name} (${u.invoiceCount})`).join(' · ')}{preview.unmatchedCount > 8 ? ' …' : ''}</div>
                            <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, cursor: 'pointer' }}>
                                <input type="checkbox" checked={createMissing} onChange={e => setCreateMissing(e.target.checked)} style={{ width: 22, height: 22 }} />
                                <span>Create these clients automatically (or cancel and import Contacts first for full details)</span>
                            </label>
                        </div>
                    )}

                    {preview.duplicates.length > 0 && (
                        <div style={{ marginBottom: 14 }}>
                            <div style={{ fontWeight: 900, marginBottom: 8 }}>Possible duplicates</div>
                            <div style={{ display: 'grid', gap: 8 }}>
                                {preview.duplicates.map(d => (
                                    <div key={d.key} style={{ ...BOX, display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <div style={{ minWidth: 200, flex: 1 }}>
                                            <div style={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{preview.type === 'invoices' ? `#${d.invoiceNumber}` : preview.type === 'expenses' ? `${d.vendor} · ${formatMoney(d.amountCents)} · ${d.date}` : d.name}{d.email ? ` · ${d.email}` : ''}</div>
                                            <div className="muted small">{KIND_LABEL[d.kind]}{d.existingName ? `: ${d.existingName}` : d.existingNumber ? `: #${d.existingNumber}` : d.existingVendor ? `: ${d.existingVendor} on ${d.existingDate}${d.existingSource ? ` (${d.existingSource})` : ''}` : ''}</div>
                                        </div>
                                        <select value={decisions[d.key] || d.defaultDecision} onChange={e => setDecisions(x => ({ ...x, [d.key]: e.target.value }))} style={{ ...CTRL, minWidth: 180 }} aria-label="What to do with this duplicate">
                                            {preview.type === 'contacts' ? (<>
                                                <option value="merge" disabled={d.kind === 'in_file'}>Merge into existing</option>
                                                <option value="keep_both">Keep both</option>
                                                <option value="skip">Skip</option>
                                            </>) : preview.type === 'vendors' ? (<>
                                                <option value="merge" disabled={d.kind === 'in_file'}>Merge into existing</option>
                                                <option value="skip">Skip</option>
                                            </>) : preview.type === 'expenses' ? (<>
                                                <option value="merge" disabled={d.kind === 'exact' || d.kind === 'already_imported' || d.kind === 'in_file'}>Add details to existing</option>
                                                <option value="keep_both">Import as separate</option>
                                                <option value="skip">Skip</option>
                                            </>) : (<>
                                                <option value="skip">Skip</option>
                                                <option value="renumber" disabled={d.kind === 'already_imported'}>Import with new number</option>
                                            </>)}
                                        </select>
                                    </div>
                                ))}
                            </div>
                            {s.duplicates > preview.duplicates.length && <div className="muted small" style={{ marginTop: 6 }}>Showing the first {preview.duplicates.length}; the rest follow the defaults.</div>}
                        </div>
                    )}

                    {(preview.errors.length > 0 || preview.warnings.length > 0) && (
                        <div style={{ marginBottom: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                                <div style={{ fontWeight: 900 }}>Problems &amp; notes</div>
                                <button className="btn sm secondary" style={CTRL} onClick={() => downloadReport('import-report.csv', preview.errors, preview.warnings)}>Download report</button>
                            </div>
                            <div style={{ maxHeight: 280, overflowY: 'auto', display: 'grid', gap: 6 }}>
                                {preview.errors.map((e, i) => (
                                    <div key={`e${i}`} style={{ ...BOX, padding: '8px 12px' }}>
                                        <span style={{ color: '#ff7777', fontWeight: 800 }}>⚠️ {e.invoice ? `#${e.invoice}` : `Row ${e.row}`}</span>
                                        <span className="small" style={{ marginLeft: 8, overflowWrap: 'anywhere' }}>{e.error}</span>
                                    </div>
                                ))}
                                {preview.warnings.map((w, i) => (
                                    <div key={`w${i}`} style={{ ...BOX, padding: '8px 12px' }}>
                                        <span style={{ fontWeight: 800 }}>ℹ️ {w.invoice ? `#${w.invoice}` : `Row ${w.row}`}</span>
                                        <span className="small" style={{ marginLeft: 8, overflowWrap: 'anywhere' }}>{w.messages.join(' ')}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="muted small" style={{ marginTop: 6 }}>Rows with problems are skipped; everything else imports.</div>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button className="btn secondary" style={CTRL} onClick={() => setPreview(null)}>← Back to matching</button>
                        <button className="btn glow-blue" style={{ ...CTRL, flex: 1, fontWeight: 900 }} onClick={commit} disabled={!!busy || actionCount === 0}>
                            Import {actionCount} {NOUN[preview.type]}{actionCount === 1 ? '' : 's'}
                        </button>
                    </div>
                </div>
            )}

            {step === 'done' && result && (
                <div className="card glass" style={{ padding: 24, marginBottom: 20 }}>
                    <div style={{ fontSize: 22, fontWeight: 950, marginBottom: 12 }}>{result.created || result.merged ? '✅ Import complete' : 'Nothing was imported'}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 12, marginBottom: 14 }}>
                        <Stat label="CREATED" value={result.created} color="#4ade80" />
                        {result.merged !== undefined && <Stat label="MERGED" value={result.merged} />}
                        <Stat label="SKIPPED" value={result.skipped} />
                        <Stat label="PROBLEMS" value={result.errorCount ?? result.errors.length} color={(result.errorCount || result.errors.length) ? '#ff7777' : undefined} />
                        {result.openCount !== undefined && <Stat label="STILL OPEN" value={result.openCount} color="#fb923c" />}
                        {result.mileageCreated !== undefined && <Stat label="MILEAGE TRIPS" value={result.mileageCreated} color="#38bdf8" />}
                    </div>
                    {result.clientsCreated > 0 && <div className="muted small" style={{ marginBottom: 10 }}>{result.clientsCreated} new client{result.clientsCreated === 1 ? ' was' : 's were'} created from invoice customers.</div>}
                    {result.openCount > 0 && <div className="muted" style={{ marginBottom: 14 }}>Find the {result.openCount} unpaid invoice{result.openCount === 1 ? '' : 's'} ({formatMoney(result.openBalanceCents)}) under <strong>Invoices → Open in old system</strong>.</div>}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <Link className="btn glow-blue" style={{ ...CTRL, display: 'inline-flex', alignItems: 'center' }} to={{ invoices: '/crm/financials', vendors: '/vendors', expenses: '/transactions', contacts: '/clients' }[type]}>View {{ invoices: 'invoices', vendors: 'vendors', expenses: 'transactions', contacts: 'clients' }[type]}</Link>
                        <button className="btn secondary" style={CTRL} onClick={reset}>Import another file</button>
                        {(result.errors.length > 0 || result.warnings.length > 0) && <button className="btn secondary" style={CTRL} onClick={() => downloadReport('import-report.csv', result.errors, result.warnings)}>Download report</button>}
                        {result.batchId && <button className="btn secondary" style={{ ...CTRL, color: '#ff7777' }} onClick={() => undo({ id: result.batchId, entity_type: type, filename: file?.name })}>Undo this import</button>}
                    </div>
                </div>
            )}

            {batches.length > 0 && (
                <div className="card glass" style={{ padding: 24 }}>
                    <div style={{ fontWeight: 900, marginBottom: 10 }}>Import history</div>
                    <div style={{ display: 'grid', gap: 8 }}>
                        {batches.map(b => (
                            <div key={b.id} style={{ ...BOX, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', opacity: b.status === 'undone' ? 0.55 : 1 }}>
                                <div style={{ minWidth: 200, flex: 1 }}>
                                    <div style={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{b.filename || b.entity_type} <span className="tag" style={{ marginLeft: 6 }}>{b.entity_type}</span></div>
                                    <div className="muted small">{new Date(b.created_at).toLocaleString()} · {b.counts?.created ?? 0} created{b.counts?.merged ? `, ${b.counts.merged} merged` : ''}{b.status === 'undone' ? ' · undone' : ''}</div>
                                </div>
                                {b.status === 'committed' && <button className="btn sm secondary" style={CTRL} onClick={() => undo(b)}>Undo</button>}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
