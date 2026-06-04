import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../AuthContext';

const DOC_TYPES = [
    { value: 'general',   label: 'General' },
    { value: 'warranty',  label: 'Warranty' },
    { value: 'contract',  label: 'Contract' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'loan',      label: 'Loan / Financing' },
];

const TYPE_COLORS = {
    warranty:  '#4ade80',
    contract:  '#818cf8',
    insurance: '#f97316',
    loan:      '#fbbf24',
    general:   'rgba(255,255,255,0.4)',
};

async function getFreshHeader() {
    const { data: { session } } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${session?.access_token}` };
}

export default function DocumentsTab({ settings }) {
    const [docs, setDocs]         = useState([]);
    const [loading, setLoading]   = useState(true);
    const [uploading, setUploading] = useState(false);
    const [docType, setDocType]   = useState('general');
    const [msg, setMsg]           = useState('');
    const [deleting, setDeleting] = useState(null);
    const fileRef = useRef(null);

    const hasKey = !!settings?.gemini_api_key;

    const loadDocs = async () => {
        try {
            const headers = await getFreshHeader();
            const res = await fetch('/api/documents', { headers });
            const data = await res.json();
            setDocs(Array.isArray(data) ? data : []);
        } catch (_) {
            setDocs([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadDocs(); }, []);

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        setUploading(true);
        setMsg('Indexing document…');

        try {
            const headers = await getFreshHeader();
            const fd = new FormData();
            fd.append('file', file);
            fd.append('doc_type', docType);

            const res = await fetch('/api/documents/upload', {
                method:  'POST',
                headers,
                body:    fd,
            });
            const data = await res.json();

            if (!res.ok) {
                if (data.error === 'no_key') {
                    setMsg('⚠️ Set your Gemini API key in AI Intelligence first.');
                } else {
                    setMsg(`❌ ${data.error || 'Upload failed'}`);
                }
                return;
            }

            setMsg(`✓ "${data.filename}" indexed — ${data.chunk_count} sections ready for Brain.`);
            await loadDocs();
        } catch (e) {
            setMsg(`❌ Upload failed: ${e.message}`);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id, filename) => {
        if (!confirm(`Remove "${filename}" from Brain's knowledge? This cannot be undone.`)) return;
        setDeleting(id);
        try {
            const headers = await getFreshHeader();
            await fetch(`/api/documents/${id}`, { method: 'DELETE', headers });
            setDocs(prev => prev.filter(d => d.id !== id));
            setMsg(`Removed "${filename}".`);
        } catch (_) {
            setMsg('Delete failed — try again.');
        } finally {
            setDeleting(null);
        }
    };

    const formatDate = (iso) => {
        if (!iso) return '';
        return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Upload card */}
            <div className="card glass" style={{ padding: '24px 28px' }}>
                <div style={{ fontWeight: 900, fontSize: '16px', marginBottom: '6px' }}>📄 Index a Document</div>
                <div className="muted" style={{ fontSize: '13px', marginBottom: '18px', lineHeight: 1.6 }}>
                    Upload a contract, warranty, insurance policy, or loan document. Brain will read it and answer questions about it — expiration dates, coverage limits, interest rates, serial numbers, anything in the text.
                </div>

                {!hasKey && (
                    <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)', fontSize: '13px', color: '#f97316', marginBottom: '16px' }}>
                        ⚠️ Set your Gemini API key in the <strong>AI Intelligence</strong> tab first — indexing requires it.
                    </div>
                )}

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select
                        value={docType}
                        onChange={e => setDocType(e.target.value)}
                        style={{ padding: '10px 12px', fontSize: '13px', minWidth: '160px' }}
                        disabled={uploading}
                    >
                        {DOC_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>

                    <label style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        padding: '10px 18px', borderRadius: '10px', cursor: uploading || !hasKey ? 'not-allowed' : 'pointer',
                        background: uploading || !hasKey ? 'rgba(255,255,255,0.04)' : 'rgba(129,140,248,0.12)',
                        border: `1px solid ${uploading || !hasKey ? 'rgba(255,255,255,0.1)' : 'rgba(129,140,248,0.4)'}`,
                        color: uploading || !hasKey ? 'rgba(255,255,255,0.3)' : '#818cf8',
                        fontWeight: 700, fontSize: '13px', userSelect: 'none',
                        opacity: uploading || !hasKey ? 0.6 : 1,
                    }}>
                        {uploading ? '⏳ Indexing…' : '⬆ Upload PDF or Image'}
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".pdf,image/*"
                            style={{ display: 'none' }}
                            onChange={handleUpload}
                            disabled={uploading || !hasKey}
                        />
                    </label>
                </div>

                {msg && (
                    <div style={{
                        marginTop: '14px', fontSize: '13px',
                        color: msg.startsWith('✓') ? '#4ade80' : msg.startsWith('⚠') ? '#f97316' : msg.startsWith('❌') ? '#f87171' : 'var(--muted)',
                    }}>
                        {msg}
                    </div>
                )}
            </div>

            {/* Indexed documents list */}
            <div className="card glass" style={{ padding: '24px 28px' }}>
                <div style={{ fontWeight: 900, fontSize: '16px', marginBottom: '16px' }}>Indexed Documents</div>

                {loading ? (
                    <div className="muted" style={{ fontSize: '13px' }}>Loading…</div>
                ) : docs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0' }}>
                        <div style={{ fontSize: '32px', marginBottom: '10px' }}>📂</div>
                        <div style={{ fontWeight: 700, marginBottom: '6px' }}>No documents indexed yet</div>
                        <div className="muted" style={{ fontSize: '13px', lineHeight: 1.6, maxWidth: '340px', margin: '0 auto' }}>
                            Upload a contract or warranty above and Brain will be able to answer questions about it instantly.
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {docs.map(doc => (
                            <div key={doc.id} style={{
                                display: 'flex', alignItems: 'center', gap: '14px',
                                padding: '14px 16px', borderRadius: '12px',
                                background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)',
                            }}>
                                <div style={{
                                    width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                                    background: TYPE_COLORS[doc.doc_type] || TYPE_COLORS.general,
                                }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {doc.filename}
                                    </div>
                                    <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                                        {DOC_TYPES.find(t => t.value === doc.doc_type)?.label || 'General'}
                                        {' · '}{doc.chunk_count} section{doc.chunk_count !== 1 ? 's' : ''}
                                        {' · '}{formatDate(doc.created_at)}
                                    </div>
                                </div>
                                <button
                                    className="btn secondary"
                                    style={{ fontSize: '11px', padding: '4px 10px', flexShrink: 0, color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}
                                    disabled={deleting === doc.id}
                                    onClick={() => handleDelete(doc.id, doc.filename)}
                                >
                                    {deleting === doc.id ? '…' : 'Remove'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
}
