import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { apiGet } from '../../api';

// ─── Constants ────────────────────────────────────────────────────────────────

const SINCE_OPTIONS = [
    { value: '1h',  label: 'Last 1 Hour' },
    { value: '6h',  label: 'Last 6 Hours' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d',  label: 'Last 7 Days' },
];

const LEVEL_OPTIONS = [
    { value: '',      label: 'All Levels' },
    { value: 'error', label: 'Errors Only' },
    { value: 'warn',  label: 'Warnings Only' },
    { value: 'info',  label: 'Info Only' },
];

const SOURCE_LABELS = {
    'email-inbound':    'Receipt Email',
    'pending-receipts': 'Pending Receipts',
    'plaid':            'Plaid Bank Sync',
    'auth':             'Authentication',
    'server':           'Server',
    'mailer':           'Email / Mailer',
    'brain':            'AI Brain',
    'documents':        'Documents',
    'receipts':         'Receipts',
    'mileage':          'Mileage',
    'invoices':         'Invoices',
    'import':           'Bank Import',
};

const LEVEL_STYLES = {
    error: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.4)', color: '#ef4444', dot: '#ef4444', label: 'ERROR' },
    warn:  { bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.35)', color: '#fbbf24', dot: '#fbbf24', label: 'WARN' },
    info:  { bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)',  color: '#818cf8', dot: '#818cf8', label: 'INFO' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(cents) {
    if (cents == null) return null;
    return `$${(cents / 100).toFixed(2)}`;
}

function fmtTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtDateTime(iso) {
    const d = new Date(iso);
    return d.toLocaleString([], {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
}

/**
 * groupEmailSessions(logs)
 * Takes all email-inbound log rows (newest-first from API) and clusters them
 * into sessions. Rows within 90 seconds of the previous row in that cluster
 * belong to the same email processing run.
 * Returns sessions newest-first.
 */
function groupEmailSessions(logs) {
    const emailLogs = [...logs]
        .filter(l => l.source === 'email-inbound')
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); // oldest first for grouping

    const sessions = [];
    const GAP_MS   = 90_000; // 90-second gap = new session

    for (const log of emailLogs) {
        const ts = new Date(log.created_at).getTime();
        const last = sessions[sessions.length - 1];
        if (!last || ts - last._lastTs > GAP_MS) {
            sessions.push({ _lastTs: ts, rows: [log] });
        } else {
            last.rows.push(log);
            last._lastTs = ts;
        }
    }

    // Derive summary fields from each session's rows
    return sessions.reverse().map(s => { // newest first
        const rows = s.rows;

        // "Email received" row → subject, from, attachments
        const received = rows.find(r => r.message === 'Email received');
        const subject       = received?.metadata?.subject || null;
        const from          = received?.metadata?.from    || null;
        const attachNames   = received?.metadata?.attachmentNames || [];
        const attachCount   = received?.metadata?.attachmentCount ?? 0;

        // "Attachment parse result" or "Body parse result" → vendor, amount, date, category
        const parseResult = rows.find(r =>
            r.message === 'Attachment parse result' || r.message === 'Body parse result'
        );
        const extracted = parseResult?.metadata?.extracted || null;
        const vendor    = extracted?.vendor   || null;
        const amount    = extracted?.amount_cents != null ? extracted.amount_cents : null;
        const recDate   = extracted?.date     || null;
        const category  = extracted?.category || null;
        const confidence = extracted?.confidence || null;
        const notes     = extracted?.notes    || null;

        // "Match query result" → match counts
        const matchRow  = rows.find(r => r.message === 'Match query result');
        const matchMeta = matchRow?.metadata || null;

        // Outcome — determined by the terminal message
        let outcome = 'processing';
        let outcomeDetail = null;
        if (rows.find(r => r.message === 'Receipt matched and attached')) {
            outcome = 'matched';
            const m = rows.find(r => r.message === 'Receipt matched and attached');
            outcomeDetail = m?.metadata || null;
        } else if (rows.find(r => r.message === 'No match — stored as pending receipt')) {
            outcome = 'pending';
        } else if (rows.find(r => r.message === 'No amount extracted — sending failed email')) {
            outcome = 'failed';
        } else if (rows.find(r => r.message === 'Transaction already has receipt')) {
            outcome = 'already_linked';
        } else if (rows.find(r => r.level === 'error')) {
            outcome = 'error';
        } else if (!rows.find(r => r.message === 'Match query result')) {
            outcome = 'incomplete'; // Lambda may have been killed mid-run
        }

        // Errors in the session
        const errors = rows.filter(r => r.level === 'error' || r.level === 'warn');

        return {
            id:         rows[0].id, // stable key
            startedAt:  rows[0].created_at,
            subject,
            from,
            attachCount,
            attachNames,
            vendor,
            amount,
            recDate,
            category,
            confidence,
            notes,
            matchMeta,
            outcome,
            outcomeDetail,
            errors,
            rows,
        };
    });
}

// ─── Outcome Badge ────────────────────────────────────────────────────────────

const OUTCOME_CONFIG = {
    matched:      { icon: '✅', label: 'MATCHED',      color: '#4ade80', bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.3)' },
    pending:      { icon: '⏳', label: 'PENDING',      color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' },
    failed:       { icon: '❌', label: 'FAILED',       color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)' },
    already_linked:{ icon:'🔗', label: 'ALREADY LINKED',color:'#818cf8', bg:'rgba(99,102,241,0.1)', border:'rgba(99,102,241,0.3)' },
    error:        { icon: '🔴', label: 'ERROR',        color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)' },
    incomplete:   { icon: '⚠️', label: 'INCOMPLETE',   color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' },
    processing:   { icon: '🔄', label: 'PROCESSING',   color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.3)' },
};

function OutcomeBadge({ outcome }) {
    const c = OUTCOME_CONFIG[outcome] || OUTCOME_CONFIG.processing;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '3px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 900,
            letterSpacing: '0.06em', background: c.bg, border: `1px solid ${c.border}`, color: c.color,
            flexShrink: 0,
        }}>
            {c.icon} {c.label}
        </span>
    );
}

// ─── Receipt Session Card ─────────────────────────────────────────────────────

function ReceiptSessionCard({ session }) {
    const [expanded, setExpanded] = useState(false);
    const [logsOpen, setLogsOpen] = useState(false);
    const c = OUTCOME_CONFIG[session.outcome] || OUTCOME_CONFIG.processing;

    return (
        <div style={{
            borderRadius: '12px',
            border: `1px solid ${c.border}`,
            background: 'rgba(255,255,255,0.02)',
            overflow: 'hidden',
        }}>
            {/* ── Card Header — always visible ── */}
            <div
                style={{
                    padding: '14px 18px',
                    display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
                    cursor: 'pointer',
                    borderBottom: expanded ? `1px solid ${c.border}` : 'none',
                    background: expanded ? 'rgba(255,255,255,0.015)' : 'transparent',
                }}
                onClick={() => setExpanded(e => !e)}
            >
                {/* Outcome badge */}
                <OutcomeBadge outcome={session.outcome} />

                {/* Subject line — primary identifier */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: '13px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {session.subject || '(no subject)'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '2px', fontWeight: 600 }}>
                        {fmtDateTime(session.startedAt)} · {session.from || 'unknown sender'}
                    </div>
                </div>

                {/* Amount pill — most important at a glance */}
                {session.amount != null && (
                    <span style={{
                        fontWeight: 900, fontSize: '15px', flexShrink: 0,
                        color: c.color,
                    }}>
                        {fmt$(session.amount)}
                    </span>
                )}

                {/* Error count indicator */}
                {session.errors.length > 0 && (
                    <span style={{
                        padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 900,
                        background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444',
                    }}>
                        {session.errors.length} {session.errors.length === 1 ? 'issue' : 'issues'}
                    </span>
                )}

                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', flexShrink: 0 }}>
                    {expanded ? '▲' : '▼'}
                </span>
            </div>

            {/* ── Expanded Detail ── */}
            {expanded && (
                <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Three-column detail grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>

                        {/* Receipt / AI Parse */}
                        <DetailBlock title="Receipt Parsed by AI">
                            <DetailRow label="Vendor"     value={session.vendor || '—'} highlight />
                            <DetailRow label="Amount"     value={fmt$(session.amount) || '—'} highlight />
                            <DetailRow label="Date"       value={session.recDate || '—'} />
                            <DetailRow label="Category"   value={session.category || '—'} />
                            <DetailRow label="Notes"      value={session.notes || '—'} />
                            <DetailRow label="Confidence" value={session.confidence || '—'} />
                        </DetailBlock>

                        {/* Email Info */}
                        <DetailBlock title="Email">
                            <DetailRow label="Subject"     value={session.subject || '—'} />
                            <DetailRow label="From"        value={session.from || '—'} />
                            <DetailRow label="Attachments" value={
                                session.attachCount === 0
                                    ? 'None (body parsed)'
                                    : session.attachNames.join(', ') || `${session.attachCount} file(s)`
                            } />
                        </DetailBlock>

                        {/* Match Result */}
                        <DetailBlock title="Transaction Match">
                            {session.matchMeta ? (<>
                                <DetailRow label="Total matches"    value={String(session.matchMeta.totalMatches ?? '—')} />
                                <DetailRow label="Unlinked"         value={String(session.matchMeta.unlinked ?? '—')} highlight={session.matchMeta.unlinked === 1} />
                                <DetailRow label="Already linked"   value={String(session.matchMeta.alreadyLinked ?? '—')} />
                                <DetailRow label="Date window"      value={session.matchMeta.dateWindow || '—'} />
                                <DetailRow label="Outcome"          value={
                                    session.outcome === 'matched'       ? 'Receipt attached ✅'
                                  : session.outcome === 'pending'       ? 'Stored as pending ⏳'
                                  : session.outcome === 'already_linked'? 'Already on file 🔗'
                                  : '—'
                                } />
                            </>) : (
                                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
                                    {session.outcome === 'failed' ? 'AI could not extract an amount — no match attempted.' :
                                     session.outcome === 'incomplete' ? 'Processing did not complete. Lambda may have timed out.' :
                                     'No match data available.'}
                                </div>
                            )}
                        </DetailBlock>
                    </div>

                    {/* Errors / warnings in this session */}
                    {session.errors.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.06em', color: '#ef4444', opacity: 0.7 }}>ISSUES IN THIS SESSION</div>
                            {session.errors.map(e => (
                                <div key={e.id} style={{
                                    padding: '10px 12px', borderRadius: '8px',
                                    background: e.level === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(251,191,36,0.06)',
                                    border: e.level === 'error' ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(251,191,36,0.25)',
                                }}>
                                    <div style={{ fontWeight: 700, fontSize: '12px', color: e.level === 'error' ? '#fca5a5' : '#fde68a' }}>
                                        {e.message}
                                    </div>
                                    {e.metadata?.error && (
                                        <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', wordBreak: 'break-all' }}>
                                            {e.metadata.error}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Raw log events toggle */}
                    <button
                        onClick={e => { e.stopPropagation(); setLogsOpen(o => !o); }}
                        style={{
                            background: 'none', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px', padding: '6px 14px', cursor: 'pointer',
                            fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.4)',
                            alignSelf: 'flex-start',
                        }}
                    >
                        {logsOpen ? '▲ Hide' : '▼ Show'} {session.rows.length} raw log event{session.rows.length !== 1 ? 's' : ''}
                    </button>

                    {logsOpen && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
                            {session.rows.map(row => (
                                <div key={row.id} style={{
                                    padding: '8px 12px', background: 'rgba(0,0,0,0.2)',
                                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                                    display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap',
                                }}>
                                    <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'rgba(255,255,255,0.3)', flexShrink: 0, paddingTop: '1px' }}>
                                        {fmtTime(row.created_at)}
                                    </span>
                                    <LevelBadge level={row.level} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>{row.message}</div>
                                        {row.metadata && Object.keys(row.metadata).length > 0 && (
                                            <div style={{ fontFamily: 'monospace', fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '3px', wordBreak: 'break-all' }}>
                                                {JSON.stringify(row.metadata)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Small reusable detail blocks
function DetailBlock({ title, children }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.3)', marginBottom: '2px' }}>
                {title.toUpperCase()}
            </div>
            {children}
        </div>
    );
}

function DetailRow({ label, value, highlight }) {
    return (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontWeight: 700, flexShrink: 0, minWidth: '90px' }}>{label}</span>
            <span style={{ fontSize: '12px', fontWeight: highlight ? 800 : 600, color: highlight ? '#e2e8f0' : 'rgba(255,255,255,0.6)', wordBreak: 'break-word' }}>
                {value}
            </span>
        </div>
    );
}

// ─── Level Badge ──────────────────────────────────────────────────────────────

function LevelBadge({ level }) {
    const s = LEVEL_STYLES[level] || LEVEL_STYLES.info;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 900,
            letterSpacing: '0.06em', background: s.bg, border: `1px solid ${s.border}`, color: s.color,
            flexShrink: 0, whiteSpace: 'nowrap',
        }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: s.dot, display: 'inline-block', flexShrink: 0 }} />
            {s.label}
        </span>
    );
}

function SourceChip({ source }) {
    const label = SOURCE_LABELS[source] || source;
    return (
        <span style={{
            padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.55)', flexShrink: 0, whiteSpace: 'nowrap',
        }}>
            {label}
        </span>
    );
}

function MetaView({ metadata }) {
    if (!metadata || Object.keys(metadata).length === 0) return null;
    return (
        <div style={{
            marginTop: '8px', padding: '10px 12px',
            background: 'rgba(0,0,0,0.25)', borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.06)',
            fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.6,
            color: 'rgba(255,255,255,0.65)',
            display: 'flex', flexDirection: 'column', gap: '3px',
        }}>
            {Object.entries(metadata).map(([key, val]) => (
                <div key={key} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#60a5fa', fontWeight: 700, flexShrink: 0 }}>{key}</span>
                    <span style={{ color: 'rgba(255,255,255,0.55)', wordBreak: 'break-all' }}>
                        {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                    </span>
                </div>
            ))}
        </div>
    );
}

function LogRow({ log }) {
    const [expanded, setExpanded] = useState(false);
    const hasDetail = log.metadata && Object.keys(log.metadata).length > 0;
    const isError = log.level === 'error';
    const isWarn  = log.level === 'warn';

    const ts = new Date(log.created_at);
    const timeStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = ts.toLocaleDateString([], { month: 'short', day: 'numeric' });

    const rowBorder = isError ? '2px solid rgba(239,68,68,0.5)'
                    : isWarn  ? '2px solid rgba(251,191,36,0.35)'
                    : '2px solid transparent';

    return (
        <div
            style={{
                borderLeft: rowBorder, paddingLeft: '12px',
                paddingTop: '10px', paddingBottom: hasDetail && expanded ? '12px' : '10px',
                paddingRight: '16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                cursor: hasDetail ? 'pointer' : 'default',
                background: isError ? 'rgba(239,68,68,0.03)' : isWarn ? 'rgba(251,191,36,0.02)' : 'transparent',
            }}
            onClick={() => hasDetail && setExpanded(e => !e)}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ flexShrink: 0, textAlign: 'right', minWidth: '80px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace' }}>{timeStr}</div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>{dateStr}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                    <LevelBadge level={log.level} />
                    <SourceChip source={log.source} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                        fontSize: '12.5px', fontWeight: isError ? 700 : 600,
                        color: isError ? '#fca5a5' : isWarn ? '#fde68a' : 'rgba(255,255,255,0.82)',
                        wordBreak: 'break-word',
                    }}>
                        {log.message}
                    </span>
                    {!expanded && hasDetail && (() => {
                        const m = log.metadata;
                        const preview = m.error ? `— ${m.error}`
                            : m.vendor ? `— ${m.vendor}${m.amountCents != null ? ` · $${(m.amountCents/100).toFixed(2)}` : ''}`
                            : m.amountCents != null ? `— $${(m.amountCents/100).toFixed(2)}`
                            : m.dateWindow ? `— ${m.dateWindow}` : '';
                        return preview ? (
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginLeft: '6px', fontFamily: 'monospace' }}>
                                {preview}
                            </span>
                        ) : null;
                    })()}
                </div>
                {hasDetail && (
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', flexShrink: 0, alignSelf: 'flex-start', paddingTop: '2px' }}>
                        {expanded ? '▲' : '▼'}
                    </span>
                )}
            </div>
            {expanded && <MetaView metadata={log.metadata} />}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SystemLogsTab() {
    const [logs, setLogs]         = useState([]);
    const [sources, setSources]   = useState([]);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState(null);
    const [lastRefreshed, setLastRefreshed] = useState(null);

    // View toggle
    const [view, setView] = useState('receipts'); // 'receipts' | 'all'

    // Filters
    const [source, setSource] = useState('');
    const [level,  setLevel]  = useState('');
    const [since,  setSince]  = useState('24h');
    const [search, setSearch] = useState('');

    // Auto-refresh
    const [autoRefresh, setAutoRefresh] = useState(false);
    const intervalRef = useRef(null);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Always fetch all email-inbound + whatever other filters are set
            let path = `/admin/logs?since=${since}&limit=500`;
            if (source) path += `&source=${encodeURIComponent(source)}`;
            if (level)  path += `&level=${encodeURIComponent(level)}`;
            const data = await apiGet(path);

            // Also fetch email-inbound if not already included (for sessions view)
            let allLogs = data.logs || [];
            if (source && source !== 'email-inbound') {
                const emailData = await apiGet(`/admin/logs?since=${since}&limit=500&source=email-inbound`);
                allLogs = [...allLogs, ...(emailData.logs || [])];
            }

            setLogs(allLogs);
            setSources(data.sources || []);
            setLastRefreshed(new Date());
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [source, level, since]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    useEffect(() => {
        if (autoRefresh) {
            intervalRef.current = setInterval(fetchLogs, 30000);
        } else {
            clearInterval(intervalRef.current);
        }
        return () => clearInterval(intervalRef.current);
    }, [autoRefresh, fetchLogs]);

    // Receipt sessions — derived from all email-inbound logs
    const receiptSessions = useMemo(() => groupEmailSessions(logs), [logs]);

    // Raw log filter
    const filtered = useMemo(() => {
        let base = source ? logs.filter(l => l.source === source) : logs;
        if (level)  base = base.filter(l => l.level === level);
        if (search) {
            const q = search.toLowerCase();
            base = base.filter(l =>
                l.message.toLowerCase().includes(q) ||
                l.source.toLowerCase().includes(q) ||
                JSON.stringify(l.metadata || {}).toLowerCase().includes(q)
            );
        }
        return base;
    }, [logs, source, level, search]);

    const counts = filtered.reduce((acc, l) => { acc[l.level] = (acc[l.level] || 0) + 1; return acc; }, {});
    const fmtRefreshed = d => d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* ── Page Header ── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>System Logs</h2>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                        Live backend event stream — email processing, errors, Plaid sync, and more.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: autoRefresh ? '#4ade80' : 'rgba(255,255,255,0.4)' }}>
                        <div onClick={() => setAutoRefresh(a => !a)} style={{
                            width: '32px', height: '18px', borderRadius: '9px', position: 'relative', cursor: 'pointer',
                            background: autoRefresh ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.1)',
                            border: autoRefresh ? '1px solid rgba(74,222,128,0.5)' : '1px solid rgba(255,255,255,0.15)',
                            transition: 'all 0.2s',
                        }}>
                            <div style={{
                                width: '12px', height: '12px', borderRadius: '50%',
                                background: autoRefresh ? '#4ade80' : 'rgba(255,255,255,0.4)',
                                position: 'absolute', top: '2px', left: autoRefresh ? '16px' : '2px',
                                transition: 'all 0.2s',
                            }} />
                        </div>
                        Live (30s)
                    </label>
                    <button className="btn secondary" onClick={fetchLogs} disabled={loading}
                        style={{ fontSize: '11px', padding: '6px 14px', fontWeight: 800 }}>
                        {loading ? 'Loading…' : '🔄 Refresh'}
                    </button>
                </div>
            </div>

            {/* ── View Toggle ── */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '2px' }}>
                {[
                    { key: 'receipts', label: `📨  Receipt Email Sessions (${receiptSessions.length})` },
                    { key: 'all',      label: `📋  All Events (${filtered.length})` },
                ].map(({ key, label }) => (
                    <button key={key} onClick={() => setView(key)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: '8px 16px', fontSize: '12px', fontWeight: 800,
                        color: view === key ? '#38bdf8' : 'rgba(255,255,255,0.35)',
                        borderBottom: view === key ? '2px solid #38bdf8' : '2px solid transparent',
                        marginBottom: '-2px', transition: 'color 0.15s',
                    }}>
                        {label}
                    </button>
                ))}
                <div style={{ marginLeft: 'auto', fontSize: '11px', color: 'rgba(255,255,255,0.2)', fontWeight: 600, alignSelf: 'center' }}>
                    {autoRefresh ? '🟢 Live · ' : ''}Last updated {fmtRefreshed(lastRefreshed)}
                </div>
            </div>

            {/* ── Loading / Error ── */}
            {loading && (
                <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '13px', fontWeight: 600 }}>
                    Loading logs…
                </div>
            )}
            {!loading && error && (
                <div style={{ padding: '20px', color: '#ef4444', fontSize: '13px', fontWeight: 700 }}>
                    ⚠ Failed to load logs: {error}
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* VIEW: RECEIPT EMAIL SESSIONS                                        */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {!loading && !error && view === 'receipts' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                    {/* Time filter for sessions */}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '10px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>TIME WINDOW</label>
                            <select value={since} onChange={e => setSince(e.target.value)} style={{ fontSize: '12px', padding: '6px 10px', minWidth: '140px' }}>
                                {SINCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>

                        {/* Outcome summary chips */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignSelf: 'flex-end', paddingBottom: '1px' }}>
                            {['matched','pending','failed','error','incomplete'].map(outcome => {
                                const count = receiptSessions.filter(s => s.outcome === outcome).length;
                                if (!count) return null;
                                const c = OUTCOME_CONFIG[outcome];
                                return (
                                    <span key={outcome} style={{
                                        padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 800,
                                        background: c.bg, border: `1px solid ${c.border}`, color: c.color,
                                    }}>
                                        {count} {outcome}
                                    </span>
                                );
                            })}
                        </div>
                    </div>

                    {receiptSessions.length === 0 ? (
                        <div style={{ padding: '48px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.4 }}>📭</div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>
                                No receipt emails processed in this time window.
                            </div>
                        </div>
                    ) : (
                        receiptSessions.map(session => (
                            <ReceiptSessionCard key={session.id} session={session} />
                        ))
                    )}
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* VIEW: ALL EVENTS (RAW LOG TABLE)                                    */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {!loading && !error && view === 'all' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Filters */}
                    <div className="card glass" style={{ margin: 0, padding: '16px 20px' }}>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontSize: '10px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>TIME WINDOW</label>
                                <select value={since} onChange={e => setSince(e.target.value)} style={{ fontSize: '12px', padding: '6px 10px', minWidth: '140px' }}>
                                    {SINCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontSize: '10px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>SOURCE</label>
                                <select value={source} onChange={e => setSource(e.target.value)} style={{ fontSize: '12px', padding: '6px 10px', minWidth: '160px' }}>
                                    <option value=''>All Sources</option>
                                    {sources.map(s => <option key={s} value={s}>{SOURCE_LABELS[s] || s}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontSize: '10px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>LEVEL</label>
                                <select value={level} onChange={e => setLevel(e.target.value)} style={{ fontSize: '12px', padding: '6px 10px', minWidth: '140px' }}>
                                    {LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1, minWidth: '200px' }}>
                                <label style={{ fontSize: '10px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>SEARCH</label>
                                <input type="text" placeholder="Filter by message, source, or metadata…"
                                    value={search} onChange={e => setSearch(e.target.value)}
                                    style={{ fontSize: '12px', padding: '6px 10px' }} />
                            </div>
                            {(source || level || search || since !== '24h') && (
                                <button className="btn secondary"
                                    onClick={() => { setSource(''); setLevel(''); setSearch(''); setSince('24h'); }}
                                    style={{ fontSize: '11px', padding: '6px 12px', alignSelf: 'flex-end' }}>
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Summary counts */}
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {[
                            { key: 'error', label: 'Errors', color: '#ef4444' },
                            { key: 'warn',  label: 'Warnings', color: '#fbbf24' },
                            { key: 'info',  label: 'Info', color: '#818cf8' },
                        ].map(({ key, label, color }) => (
                            <div key={key} style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '4px 12px', borderRadius: '8px',
                                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                                fontSize: '12px', fontWeight: 700,
                            }}>
                                <span style={{ color, fontWeight: 900, fontSize: '13px' }}>{counts[key] || 0}</span>
                                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
                            </div>
                        ))}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '4px 12px', borderRadius: '8px',
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                            fontSize: '12px', fontWeight: 700,
                        }}>
                            <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 900, fontSize: '13px' }}>{filtered.length}</span>
                            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Total</span>
                        </div>
                    </div>

                    {/* Log rows */}
                    <div className="card glass" style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
                        <div style={{
                            display: 'flex', gap: '10px', padding: '8px 16px 8px 14px',
                            background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.07)',
                            fontSize: '10px', fontWeight: 900, letterSpacing: '0.07em', color: 'rgba(255,255,255,0.3)',
                        }}>
                            <span style={{ minWidth: '80px' }}>TIME</span>
                            <span style={{ minWidth: '116px' }}>LEVEL / SOURCE</span>
                            <span>MESSAGE</span>
                        </div>
                        {filtered.length === 0 ? (
                            <div style={{ padding: '48px', textAlign: 'center' }}>
                                <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.4 }}>📋</div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>
                                    {search || source || level ? 'No logs match your filters.' : 'No log entries in this time window.'}
                                </div>
                            </div>
                        ) : (
                            <div style={{ maxHeight: '640px', overflowY: 'auto' }}>
                                {filtered.map(log => <LogRow key={log.id} log={log} />)}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', fontWeight: 600, textAlign: 'center' }}>
                Logs retained for 7 days · Max 500 rows per query · Admin only
            </div>
        </div>
    );
}
