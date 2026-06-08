import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet } from '../../api';

// ─── Constants ───────────────────────────────────────────────────────────────

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

// Source labels — maps internal source keys to readable names
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

// ─── Level Badge ─────────────────────────────────────────────────────────────

const LEVEL_STYLES = {
    error: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.4)', color: '#ef4444', dot: '#ef4444', label: 'ERROR' },
    warn:  { bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.35)', color: '#fbbf24', dot: '#fbbf24', label: 'WARN' },
    info:  { bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)',  color: '#818cf8', dot: '#818cf8', label: 'INFO' },
};

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

// ─── Source Chip ─────────────────────────────────────────────────────────────

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

// ─── Metadata Viewer ─────────────────────────────────────────────────────────

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

// ─── Log Row ─────────────────────────────────────────────────────────────────

function LogRow({ log }) {
    const [expanded, setExpanded] = useState(false);
    const hasDetail = log.metadata && Object.keys(log.metadata).length > 0;
    const isError = log.level === 'error';
    const isWarn  = log.level === 'warn';

    const ts = new Date(log.created_at);
    const timeStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = ts.toLocaleDateString([], { month: 'short', day: 'numeric' });

    // Highlight error rows with a left border
    const rowBorder = isError ? '2px solid rgba(239,68,68,0.5)'
                    : isWarn  ? '2px solid rgba(251,191,36,0.35)'
                    : '2px solid transparent';

    return (
        <div
            style={{
                borderLeft: rowBorder,
                paddingLeft: '12px',
                paddingTop: '10px',
                paddingBottom: hasDetail && expanded ? '12px' : '10px',
                paddingRight: '16px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                cursor: hasDetail ? 'pointer' : 'default',
                background: isError ? 'rgba(239,68,68,0.03)' : isWarn ? 'rgba(251,191,36,0.02)' : 'transparent',
                transition: 'background 0.1s',
            }}
            onClick={() => hasDetail && setExpanded(e => !e)}
        >
            {/* Main row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
                {/* Timestamp */}
                <div style={{ flexShrink: 0, textAlign: 'right', minWidth: '80px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace' }}>{timeStr}</div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>{dateStr}</div>
                </div>

                {/* Level + Source */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                    <LevelBadge level={log.level} />
                    <SourceChip source={log.source} />
                </div>

                {/* Message */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                        fontSize: '12.5px', fontWeight: isError ? 700 : 600,
                        color: isError ? '#fca5a5' : isWarn ? '#fde68a' : 'rgba(255,255,255,0.82)',
                        wordBreak: 'break-word',
                    }}>
                        {log.message}
                    </span>

                    {/* Inline key metadata preview — not expanded */}
                    {!expanded && hasDetail && (() => {
                        // Show the most useful field inline: error, vendor, amountCents, expenseId
                        const m = log.metadata;
                        const preview = m.error || m.vendor
                            ? (m.error ? `— ${m.error}` : m.vendor ? `— ${m.vendor}${m.amountCents != null ? ` · $${(m.amountCents/100).toFixed(2)}` : ''}` : '')
                            : m.amountCents != null ? `— $${(m.amountCents/100).toFixed(2)}`
                            : m.dateWindow ? `— ${m.dateWindow}`
                            : '';
                        return preview ? (
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginLeft: '6px', fontFamily: 'monospace' }}>
                                {preview}
                            </span>
                        ) : null;
                    })()}
                </div>

                {/* Expand toggle */}
                {hasDetail && (
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', flexShrink: 0, alignSelf: 'flex-start', paddingTop: '2px' }}>
                        {expanded ? '▲' : '▼'}
                    </span>
                )}
            </div>

            {/* Expanded metadata */}
            {expanded && <MetaView metadata={log.metadata} />}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SystemLogsTab() {
    const [logs, setLogs]           = useState([]);
    const [sources, setSources]     = useState([]);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState(null);
    const [lastRefreshed, setLastRefreshed] = useState(null);

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
            let path = `/admin/logs?since=${since}&limit=500`;
            if (source) path += `&source=${encodeURIComponent(source)}`;
            if (level)  path += `&level=${encodeURIComponent(level)}`;
            const data = await apiGet(path);
            setLogs(data.logs || []);
            setSources(data.sources || []);
            setLastRefreshed(new Date());
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [source, level, since]);

    // Fetch on mount and filter change
    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    // Auto-refresh every 30s when enabled
    useEffect(() => {
        if (autoRefresh) {
            intervalRef.current = setInterval(fetchLogs, 30000);
        } else {
            clearInterval(intervalRef.current);
        }
        return () => clearInterval(intervalRef.current);
    }, [autoRefresh, fetchLogs]);

    // Client-side search filter
    const filtered = search
        ? logs.filter(l =>
            l.message.toLowerCase().includes(search.toLowerCase()) ||
            l.source.toLowerCase().includes(search.toLowerCase()) ||
            JSON.stringify(l.metadata || {}).toLowerCase().includes(search.toLowerCase())
          )
        : logs;

    // Summary counts
    const counts = filtered.reduce((acc, l) => {
        acc[l.level] = (acc[l.level] || 0) + 1;
        return acc;
    }, {});

    const formatRefreshed = (d) => d
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '—';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>System Logs</h2>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                        Real-time view of all backend events — email processing, errors, Plaid sync, and more.
                        Click any row to expand its detail data.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Auto-refresh toggle */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: autoRefresh ? '#4ade80' : 'rgba(255,255,255,0.4)' }}>
                        <div
                            onClick={() => setAutoRefresh(a => !a)}
                            style={{
                                width: '32px', height: '18px', borderRadius: '9px', position: 'relative', cursor: 'pointer',
                                background: autoRefresh ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.1)',
                                border: autoRefresh ? '1px solid rgba(74,222,128,0.5)' : '1px solid rgba(255,255,255,0.15)',
                                transition: 'all 0.2s',
                            }}
                        >
                            <div style={{
                                width: '12px', height: '12px', borderRadius: '50%',
                                background: autoRefresh ? '#4ade80' : 'rgba(255,255,255,0.4)',
                                position: 'absolute', top: '2px',
                                left: autoRefresh ? '16px' : '2px',
                                transition: 'all 0.2s',
                            }} />
                        </div>
                        Live (30s)
                    </label>
                    <button
                        className="btn secondary"
                        onClick={fetchLogs}
                        disabled={loading}
                        style={{ fontSize: '11px', padding: '6px 14px', fontWeight: 800 }}
                    >
                        {loading ? 'Loading…' : '🔄 Refresh'}
                    </button>
                </div>
            </div>

            {/* ── Filters ── */}
            <div className="card glass" style={{ margin: 0, padding: '16px 20px' }}>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    {/* Time window */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <label style={{ fontSize: '10px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>TIME WINDOW</label>
                        <select value={since} onChange={e => setSince(e.target.value)} style={{ fontSize: '12px', padding: '6px 10px', minWidth: '140px' }}>
                            {SINCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>

                    {/* Source filter */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <label style={{ fontSize: '10px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>SOURCE</label>
                        <select value={source} onChange={e => setSource(e.target.value)} style={{ fontSize: '12px', padding: '6px 10px', minWidth: '160px' }}>
                            <option value=''>All Sources</option>
                            {sources.map(s => (
                                <option key={s} value={s}>{SOURCE_LABELS[s] || s}</option>
                            ))}
                        </select>
                    </div>

                    {/* Level filter */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <label style={{ fontSize: '10px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>LEVEL</label>
                        <select value={level} onChange={e => setLevel(e.target.value)} style={{ fontSize: '12px', padding: '6px 10px', minWidth: '140px' }}>
                            {LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>

                    {/* Search */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1, minWidth: '200px' }}>
                        <label style={{ fontSize: '10px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>SEARCH</label>
                        <input
                            type="text"
                            placeholder="Filter by message, source, or metadata…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ fontSize: '12px', padding: '6px 10px' }}
                        />
                    </div>

                    {/* Clear filters */}
                    {(source || level || search || since !== '24h') && (
                        <button
                            className="btn secondary"
                            onClick={() => { setSource(''); setLevel(''); setSearch(''); setSince('24h'); }}
                            style={{ fontSize: '11px', padding: '6px 12px', alignSelf: 'flex-end' }}
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* ── Summary Bar ── */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Count badges */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {[
                        { key: 'error', label: 'Errors', color: '#ef4444' },
                        { key: 'warn',  label: 'Warnings', color: '#fbbf24' },
                        { key: 'info',  label: 'Info', color: '#818cf8' },
                    ].map(({ key, label, color }) => (
                        <div key={key} style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '4px 12px', borderRadius: '8px',
                            background: `rgba(255,255,255,0.04)`,
                            border: '1px solid rgba(255,255,255,0.08)',
                            fontSize: '12px', fontWeight: 700,
                        }}>
                            <span style={{ color, fontWeight: 900, fontSize: '13px' }}>{counts[key] || 0}</span>
                            <span style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
                        </div>
                    ))}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '4px 12px', borderRadius: '8px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        fontSize: '12px', fontWeight: 700,
                    }}>
                        <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 900, fontSize: '13px' }}>{filtered.length}</span>
                        <span style={{ color: 'rgba(255,255,255,0.4)' }}>Total</span>
                    </div>
                </div>

                {/* Last refreshed */}
                <div style={{ marginLeft: 'auto', fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>
                    {autoRefresh ? '🟢 Live' : ''} Last updated {formatRefreshed(lastRefreshed)}
                </div>
            </div>

            {/* ── Log List ── */}
            <div className="card glass" style={{ margin: 0, padding: 0, overflow: 'hidden' }}>

                {/* Column headers */}
                <div style={{
                    display: 'flex', gap: '10px', padding: '8px 16px 8px 14px',
                    background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.07)',
                    fontSize: '10px', fontWeight: 900, letterSpacing: '0.07em', color: 'rgba(255,255,255,0.3)',
                }}>
                    <span style={{ minWidth: '80px' }}>TIME</span>
                    <span style={{ minWidth: '116px' }}>LEVEL / SOURCE</span>
                    <span>MESSAGE</span>
                </div>

                {/* Loading */}
                {loading && (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '13px', fontWeight: 600 }}>
                        Loading logs…
                    </div>
                )}

                {/* Error */}
                {!loading && error && (
                    <div style={{ padding: '24px 20px', color: '#ef4444', fontSize: '13px', fontWeight: 700 }}>
                        ⚠ Failed to load logs: {error}
                    </div>
                )}

                {/* Empty */}
                {!loading && !error && filtered.length === 0 && (
                    <div style={{ padding: '48px', textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.4 }}>📋</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>
                            {search || source || level ? 'No logs match your filters.' : 'No log entries in this time window.'}
                        </div>
                    </div>
                )}

                {/* Rows */}
                {!loading && !error && filtered.length > 0 && (
                    <div style={{ maxHeight: '640px', overflowY: 'auto' }}>
                        {filtered.map(log => (
                            <LogRow key={log.id} log={log} />
                        ))}
                    </div>
                )}
            </div>

            {/* Footer note */}
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', fontWeight: 600, textAlign: 'center' }}>
                Logs retained for 7 days · Max 500 rows per query · Admin only
            </div>
        </div>
    );
}
