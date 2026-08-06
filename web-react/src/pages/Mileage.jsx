import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLoadScript, GoogleMap, DirectionsRenderer, Autocomplete } from '@react-google-maps/api';
import { apiGet, apiPost, apiPut, apiDelete, formatMoney, fetchAllMileage } from '../api';
import { useModal } from '../components/ModalContext.jsx';
import { useAuth } from '../components/AuthContext';

const LIBRARIES = ['places'];
const MAP_CONTAINER_STYLE = { width: '100%', height: '260px', borderRadius: '12px' };
const MAP_OPTIONS = {
    disableDefaultUI: true,
    zoomControl: true,
    styles: [
        { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#a0a0b0' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c4a' }] },
        { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212140' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1b2a' }] },
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    ],
};

export default function Mileage() {
    const { settings } = useAuth();
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [mileage, setMileage] = useState([]);
    const [sortDesc, setSortDesc] = useState(true);
    const [mileageRates, setMileageRates] = useState([]);
    const [syncStatus, setSyncStatus] = useState('');
    const [manualRate, setManualRate] = useState({ year: new Date().getFullYear(), rate: '' });
    const [ratesOpen, setRatesOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const modal = useModal();

    // Map / trip state
    const [origin, setOrigin] = useState('');
    const [destination, setDestination] = useState('');
    const [calculatedMiles, setCalculatedMiles] = useState(null);
    const [directions, setDirections] = useState(null);
    const [waypoint, setWaypoint] = useState('');
    const [isRoundTrip, setIsRoundTrip] = useState(false);
    const [mapCenter, setMapCenter] = useState({ lat: 37.7749, lng: -122.4194 });
    const [calculating, setCalculating] = useState(false);
    const [mapError, setMapError] = useState('');

    // Log New Trip form — shared between Maps Autopilot and Manual Entry modes
    // so switching modes never loses what's already been typed
    const [manualMode, setManualMode] = useState(false);
    const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
    const [formName, setFormName] = useState('');
    const [formNotes, setFormNotes] = useState('');
    const [manualMiles, setManualMiles] = useState('');
    const [linkedInvoice, setLinkedInvoice] = useState('');
    const [invoicesList, setInvoicesList] = useState([]);

    // Edit state — set when editing an existing trip; the form above is reused for it
    const [editingId, setEditingId] = useState(null);

    const originRef = useRef(null);
    const destinationRef = useRef(null);
    const waypointRef = useRef(null);
    const logTripCardRef = useRef(null);
    const originAutocomplete = useRef(null);
    const destinationAutocomplete = useRef(null);
    const waypointAutocomplete = useRef(null);

    const { isLoaded, loadError } = useLoadScript({
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
        libraries: LIBRARIES,
    });

    const loadData = async (force = false) => {
        setLoading(true);
        try {
            const [miles, rates] = await Promise.all([
                fetchAllMileage(selectedYear, force),
                apiGet('/mileage/rates')
            ]);
            setMileage(miles);
            setMileageRates(rates);
        } catch (e) {
            console.error('Failed to load mileage data:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [selectedYear]);

    // Load invoices once for the manual-entry invoice link dropdown
    useEffect(() => {
        apiGet('/invoices?limit=200').then(res => {
            setInvoicesList(res?.data || []);
        }).catch(() => {});
    }, []);

    const resetForm = () => {
        setEditingId(null);
        setFormName(''); setManualMiles(''); setFormNotes(''); setLinkedInvoice('');
        setFormDate(new Date().toISOString().slice(0, 10));
    };

    const handleSaveManualTrip = async () => {
        if (!formDate) return modal.alert('Please enter a trip date.');
        if (!formName) return modal.alert('Please enter a trip name or client.');
        if (!manualMiles || isNaN(Number(manualMiles)) || Number(manualMiles) <= 0)
            return modal.alert('Please enter a valid mileage amount.');
        try {
            const inv = linkedInvoice ? invoicesList.find(i => String(i.id) === linkedInvoice) : null;
            const invRef = inv ? `Invoice #${inv.invoice_number}${inv.clients?.name ? ' — ' + inv.clients.name : ''}` : '';
            const noteParts = [formNotes, invRef].filter(Boolean).join(' · ');
            const purpose = noteParts
                ? `${formName} | Manual Entry | ${noteParts}`
                : `${formName} | Manual Entry`;
            const payload = {
                log_date: formDate,
                miles: Math.round(Number(manualMiles) * 10) / 10,
                purpose,
            };
            if (editingId) {
                await apiPut(`/mileage/${editingId}`, payload);
            } else {
                await apiPost('/mileage', payload);
            }
            resetForm();
            loadData(true);
        } catch (err) {
            modal.alert(`Failed to ${editingId ? 'update' : 'log'} trip: ` + err.message);
        }
    };

    const calculateRoute = useCallback(() => {
        const addrA = originRef.current?.value || origin;
        const addrB = waypointRef.current?.value || waypoint;
        const addrC = destinationRef.current?.value || destination;
        
        // We need at least A and B
        if (!addrA || !addrB) return;

        setCalculating(true);
        setMapError('');
        const directionsService = new window.google.maps.DirectionsService();
        
        // If they fill A + B but leave C blank, route A -> B
        let finalDestination = addrB;
        let optionalWaypoint = null;
        
        // If they fill A + B + C, route A -> C with B as waypoint
        if (addrC && addrC.trim() !== '') {
            finalDestination = addrC;
            optionalWaypoint = addrB;
        }
        
        const request = {
            origin: addrA.trim(),
            destination: finalDestination.trim(),
            travelMode: window.google.maps.TravelMode.DRIVING,
        };
        
        if (optionalWaypoint && optionalWaypoint.trim() !== '') {
            request.waypoints = [{ location: optionalWaypoint.trim(), stopover: true }];
        }

        directionsService.route(
            request,
            (result, status) => {
                setCalculating(false);
                if (status === 'OK') {
                    setDirections(result);
                    // The useEffect below handles the miles calculation
                    const leg = result.routes[0].legs[0];
                    setMapCenter({
                        lat: (leg.start_location.lat() + leg.end_location.lat()) / 2,
                        lng: (leg.start_location.lng() + leg.end_location.lng()) / 2,
                    });
                } else {
                    console.error('Google Maps route calculation failed:', status, result);
                    setMapError('Could not calculate route. Please check the addresses. (Error: ' + status + ')');
                    setDirections(null);
                    setCalculatedMiles(null);
                }
            }
        );
    }, [origin, destination, waypoint]);

    useEffect(() => {
        if (directions) {
            const distanceMeters = directions.routes[0].legs.reduce((acc, leg) => acc + leg.distance.value, 0);
            let miles = distanceMeters / 1609.344;
            if (isRoundTrip) miles *= 2;
            setCalculatedMiles(Math.round(miles * 10) / 10);
        } else {
            setCalculatedMiles(null);
        }
    }, [directions, isRoundTrip]);

    const handleDestinationChange = () => {
        if (origin && destinationRef.current?.value) {
            calculateRoute();
        }
    };

    const handleAddTrip = async () => {
        if (!calculatedMiles) return modal.alert('Please enter addresses to calculate the distance first.');
        if (!formName) return modal.alert('Please enter a trip name or purpose.');
        try {
            const addrA = originRef.current?.value || origin;
            const addrB = waypointRef.current?.value || waypoint;
            const addrC = destinationRef.current?.value || destination;

            let routeStr;
            if (addrC && addrC.trim() !== '') {
                routeStr = `${addrA} → ${addrB} → ${addrC}`;
            } else {
                routeStr = `${addrA} → ${addrB}`;
            }

            if (isRoundTrip) routeStr += ` (Round Trip)`;

            const inv = linkedInvoice ? invoicesList.find(i => String(i.id) === linkedInvoice) : null;
            const invRef = inv ? `Invoice #${inv.invoice_number}${inv.clients?.name ? ' — ' + inv.clients.name : ''}` : '';
            const noteParts = [formNotes, invRef].filter(Boolean).join(' · ');
            const purpose = noteParts
                ? `${formName} | ${routeStr} | ${noteParts}`
                : `${formName} | ${routeStr}`;

            await apiPost('/mileage', {
                log_date: formDate,
                miles: calculatedMiles,
                purpose,
            });
            // Reset form
            setOrigin('');
            setDestination('');
            setWaypoint('');
            setFormName('');
            setFormNotes('');
            setLinkedInvoice('');
            setIsRoundTrip(false);
            setCalculatedMiles(null);
            setDirections(null);
            if (originRef.current) originRef.current.value = '';
            if (waypointRef.current) waypointRef.current.value = '';
            if (destinationRef.current) destinationRef.current.value = '';
            loadData(true); // force cache-bust so new entry appears immediately
        } catch (err) {
            modal.alert('Failed to log trip: ' + err.message);
        }
    };

    const handleDeleteMileage = async (id) => {
        const ok = await modal.confirm('Delete this trip log?');
        if (!ok) return;
        try {
            await apiDelete(`/mileage/${id}`);
            loadData();
        } catch (err) {
            modal.alert('Failed to delete trip: ' + err.message);
        }
    };

    // Shared by Edit and Copy: unpack a trip's purpose string, folding a Maps
    // Autopilot route into notes (rather than dropping it) since both flows
    // always land in Manual Entry mode.
    const unpackTripPurpose = (m) => {
        const parts = m.purpose?.split(' | ') || [];
        const name = parts[0] || '';
        const modeOrRoute = parts[1] || '';
        const notes = parts[2] || '';
        const combinedNotes = modeOrRoute && modeOrRoute !== 'Manual Entry'
            ? `${modeOrRoute}${notes ? ' — ' + notes : ''}`
            : notes;
        return { name, notes: combinedNotes };
    };

    const handleDuplicateTrip = (m) => {
        setEditingId(null);
        setManualMode(true);

        const { name, notes } = unpackTripPurpose(m);
        setFormName(name);
        setFormNotes(notes);
        setManualMiles(String(m.miles));
        setFormDate('');
        setLinkedInvoice('');

        logTripCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleStartEditInForm = (m) => {
        setManualMode(true);

        const { name, notes } = unpackTripPurpose(m);

        // The trailing note segment may be the app's own "Invoice #N — Name"
        // marker (see handleSaveManualTrip/handleAddTrip) — try to match it
        // back to a real invoice so an existing link isn't silently dropped.
        const noteSegments = notes.split(' · ');
        const lastSegment = noteSegments[noteSegments.length - 1];
        let matchedInvoiceId = '';
        let cleanNotes = notes;
        if (lastSegment && /^Invoice #/.test(lastSegment)) {
            const invoiceNumberMatch = lastSegment.match(/^Invoice #(\S+)/);
            const invoiceNumber = invoiceNumberMatch?.[1];
            const matched = invoiceNumber
                ? invoicesList.find(i => String(i.invoice_number) === invoiceNumber)
                : null;
            if (matched) {
                matchedInvoiceId = String(matched.id);
                cleanNotes = noteSegments.slice(0, -1).join(' · ');
            }
        }

        setFormName(name);
        setFormNotes(cleanNotes);
        setManualMiles(String(m.miles));
        setFormDate(m.log_date);
        setLinkedInvoice(matchedInvoiceId);
        setEditingId(m.id);

        logTripCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleCancelEdit = () => resetForm();

    const handleSyncIRS = async () => {
        setSyncStatus('Checking IRS.gov...');
        try {
            const result = await apiPost('/mileage/rates/sync', {});
            setSyncStatus(`✅ ${result.year} = $${Number(result.rate_per_mile).toFixed(2)}/mi`);
            const rates = await apiGet('/mileage/rates');
            setMileageRates(rates);
        } catch (err) {
            setSyncStatus(`⚠️ ${err.message}`);
        }
    };

    const handleManualRate = async () => {
        if (!manualRate.rate) return;
        try {
            await apiPost('/mileage/rates', { year: manualRate.year, rate_per_mile: manualRate.rate });
            setSyncStatus(`✅ Saved: ${manualRate.year} = $${Number(manualRate.rate).toFixed(2)}/mi`);
            const rates = await apiGet('/mileage/rates');
            setMileageRates(rates);
            setManualRate({ year: new Date().getFullYear(), rate: '' });
        } catch (err) {
            setSyncStatus(`⚠️ ${err.message}`);
        }
    };

    const totalMiles = mileage.reduce((sum, m) => sum + Number(m.miles || 0), 0);
    const currentRateObj = mileageRates.find(r => r.year === Number(selectedYear));
    const currentRate = currentRateObj?.rate_per_mile ?? 0.70;
    const mileageDeduction = totalMiles * currentRate;

    return (
        <section style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '100px' }}>

            {/* Header */}
            <div className="card glass glow-blue" style={{ marginBottom: '20px', padding: '24px 30px', border: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 900, background: 'linear-gradient(90deg, #fff, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            Mileage Tracker
                        </h1>
                        <div className="muted" style={{ marginTop: '6px', fontSize: '14px' }}>
                            IRS Standard Business Deduction • {selectedYear} • ${currentRate.toFixed(2)}/mi
                        </div>
                    </div>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="btn secondary"
                        style={{ padding: '10px 16px', borderRadius: '12px', fontWeight: 900, fontSize: '14px' }}
                    >
                        {Array.from({ length: new Date().getFullYear() - 2019 }, (_, i) => new Date().getFullYear() - i).map(y => (
                            <option key={y} value={y}>FY {y}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid two" style={{ gap: '20px', marginBottom: '20px' }}>
                <div className="card accent" style={{ textAlign: 'center', padding: '24px' }}>
                    <div className="muted" style={{ fontWeight: 800, fontSize: '12px', letterSpacing: '0.1em', marginBottom: '8px' }}>TOTAL BUSINESS DISTANCE</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'white' }}>{totalMiles.toLocaleString()} <span style={{ fontSize: '1rem', opacity: 0.5 }}>MI</span></div>
                </div>
                <div className="card accent" style={{ textAlign: 'center', padding: '24px' }}>
                    <div className="muted" style={{ fontWeight: 800, fontSize: '12px', letterSpacing: '0.1em', marginBottom: '8px' }}>POTENTIAL TAX DEDUCTION</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#4ade80' }}>{formatMoney(mileageDeduction * 100)}</div>
                    <div style={{ fontSize: '10px', fontWeight: 700, opacity: 0.6, marginTop: '4px' }}>at ${currentRate.toFixed(2)}/mile</div>
                </div>
            </div>

            {/* Maps Trip Logger */}
            <div ref={logTripCardRef} className="card" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                        <h2 style={{ margin: 0 }}>{editingId ? 'Edit Trip' : 'Log New Trip'}</h2>
                        <div className="muted small" style={{ marginTop: '4px' }}>
                            {editingId
                                ? `Editing trip #${editingId} — update the details and save.`
                                : (manualMode ? 'Enter miles directly — no address needed' : 'Enter your start and end address — miles auto-calculated')}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* Mode toggle */}
                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '3px', gap: '2px' }}>
                            <button
                                onClick={() => setManualMode(false)}
                                disabled={!!editingId}
                                title={editingId ? 'Finish or cancel editing first' : undefined}
                                style={{
                                    padding: '6px 14px', borderRadius: '8px', border: 'none',
                                    cursor: editingId ? 'not-allowed' : 'pointer',
                                    fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em',
                                    background: !manualMode ? 'rgba(16,185,129,0.2)' : 'transparent',
                                    color: !manualMode ? '#10b981' : 'rgba(255,255,255,0.4)',
                                    opacity: editingId ? 0.4 : 1,
                                    transition: 'all 0.15s',
                                }}
                            >
                                Maps Autopilot
                            </button>
                            <button
                                onClick={() => setManualMode(true)}
                                style={{
                                    padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                    fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em',
                                    background: manualMode ? 'rgba(99,102,241,0.25)' : 'transparent',
                                    color: manualMode ? '#818cf8' : 'rgba(255,255,255,0.4)',
                                    transition: 'all 0.15s',
                                }}
                            >
                                Manual Entry
                            </button>
                        </div>
                        {/* Maps badge */}
                        {!manualMode && (
                            <div
                                className="tag ok"
                                style={{ fontSize: '10px', cursor: 'help' }}
                                title="After calculating your route, tap 'Open in Google Maps' to send it to your phone's navigation app"
                            >
                                🗺 Open Route in Maps
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Manual Entry Form ─────────────────────────────── */}
                {manualMode && (
                    <div>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                            <div style={{ flex: '0 0 155px' }}>
                                <label className="muted small" style={{ display: 'block', marginBottom: '6px' }}>Trip Date</label>
                                <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} style={{ width: '100%' }} />
                            </div>
                            <div style={{ flex: 2, minWidth: '200px' }}>
                                <label className="muted small" style={{ display: 'block', marginBottom: '6px' }}>Trip Name / Client</label>
                                <input type="text" placeholder="e.g. Miller Wedding Shoot" value={formName} onChange={e => setFormName(e.target.value)} style={{ width: '100%' }} />
                            </div>
                            <div style={{ flex: '0 0 130px' }}>
                                <label className="muted small" style={{ display: 'block', marginBottom: '6px' }}>Miles</label>
                                <input type="number" step="0.1" min="0" placeholder="e.g. 24.5" value={manualMiles} onChange={e => setManualMiles(e.target.value)} style={{ width: '100%' }} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                            <div style={{ flex: 2, minWidth: '200px' }}>
                                <label className="muted small" style={{ display: 'block', marginBottom: '6px' }}>Notes (optional)</label>
                                <input type="text" placeholder="e.g. Drove to client location for boudoir session" value={formNotes} onChange={e => setFormNotes(e.target.value)} style={{ width: '100%' }} />
                            </div>
                            <div style={{ flex: 1, minWidth: '200px' }}>
                                <label className="muted small" style={{ display: 'block', marginBottom: '6px' }}>Link to Invoice (optional)</label>
                                <select value={linkedInvoice} onChange={e => setLinkedInvoice(e.target.value)} style={{ width: '100%' }}>
                                    <option value="">— No invoice —</option>
                                    {invoicesList.map(inv => (
                                        <option key={inv.id} value={String(inv.id)}>
                                            #{inv.invoice_number}{inv.clients?.name ? ' — ' + inv.clients.name : ''}{inv.total_cents ? ' ($' + (inv.total_cents / 100).toFixed(2) + ')' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        {manualMiles && formName && (
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                                borderRadius: '10px', padding: '12px 18px', marginBottom: '14px', flexWrap: 'wrap', gap: '8px'
                            }}>
                                <div>
                                    <div style={{ fontSize: '10px', fontWeight: 700, opacity: 0.5, letterSpacing: '0.08em' }}>DISTANCE</div>
                                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#818cf8' }}>{Number(manualMiles).toLocaleString()} <span style={{ fontSize: '0.9rem', opacity: 0.6 }}>mi</span></div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 700, opacity: 0.5, letterSpacing: '0.08em' }}>IRS DEDUCTION</div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#4ade80' }}>{formatMoney(Number(manualMiles) * currentRate * 100)}</div>
                                    <div style={{ fontSize: '10px', opacity: 0.4, marginTop: '2px' }}>at ${currentRate.toFixed(2)}/mi</div>
                                </div>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                className="btn primary glow-blue"
                                onClick={handleSaveManualTrip}
                                disabled={!formDate || !formName || !manualMiles}
                                style={{ flex: 1, padding: '14px', fontSize: '15px', fontWeight: 800, opacity: (!formDate || !formName || !manualMiles) ? 0.4 : 1 }}
                            >
                                {editingId ? '💾 Save Changes' : '✅ Log This Trip'}
                            </button>
                            {editingId && (
                                <button
                                    className="btn secondary"
                                    onClick={handleCancelEdit}
                                    style={{ padding: '14px 20px', fontSize: '15px', fontWeight: 800 }}
                                >
                                    Cancel Edit
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Maps Autopilot Form ────────────────────────────── */}
                {!manualMode && loadError && (
                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 16px', color: '#ef4444', marginBottom: '16px', fontSize: '13px' }}>
                        ⚠️ Google Maps failed to load. Check your <code>VITE_GOOGLE_MAPS_API_KEY</code>.
                    </div>
                )}

                {!manualMode && !isLoaded && !loadError && (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>Loading Maps…</div>
                )}

                {!manualMode && isLoaded && (
                    <>
                        {/* Date + Trip Name row */}
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                            <div style={{ flex: '0 0 155px' }}>
                                <label className="muted small" style={{ display: 'block', marginBottom: '6px' }}>Trip Date</label>
                                <input
                                    type="date"
                                    value={formDate}
                                    onChange={e => setFormDate(e.target.value)}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div style={{ flex: 2, minWidth: '200px' }}>
                                <label className="muted small" style={{ display: 'block', marginBottom: '6px' }}>Trip Name / Client</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Miller Wedding Shoot"
                                    value={formName}
                                    onChange={e => setFormName(e.target.value)}
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </div>

                        {/* A → B → C Address row */}
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '14px', alignItems: 'flex-end' }}>
                            <div style={{ flex: 1, minWidth: '180px' }}>
                                <label className="muted small" style={{ display: 'block', marginBottom: '6px' }}>📍 Start (Point A)</label>
                                <Autocomplete
                                    onLoad={a => (originAutocomplete.current = a)}
                                    onPlaceChanged={() => {
                                        const place = originAutocomplete.current?.getPlace();
                                        const addr = place?.formatted_address || originRef.current?.value;
                                        setOrigin(addr);
                                    }}
                                >
                                    <input
                                        ref={originRef}
                                        type="text"
                                        placeholder="Starting address…"
                                        style={{ width: '100%' }}
                                        onBlur={() => setOrigin(originRef.current?.value)}
                                    />
                                </Autocomplete>
                            </div>

                            <div style={{ fontSize: '20px', paddingBottom: '10px', opacity: 0.4, flexShrink: 0 }}>→</div>

                            <div style={{ flex: 1, minWidth: '180px' }}>
                                <label className="muted small" style={{ display: 'block', marginBottom: '6px' }}>🏁 Point B</label>
                                <Autocomplete
                                    onLoad={a => (waypointAutocomplete.current = a)}
                                    onPlaceChanged={() => {
                                        const place = waypointAutocomplete.current?.getPlace();
                                        const addr = place?.formatted_address || waypointRef.current?.value;
                                        setWaypoint(addr);
                                        // Auto calculate if A and B are present
                                        if (origin || originRef.current?.value) {
                                            setTimeout(calculateRoute, 100);
                                        }
                                    }}
                                >
                                    <input
                                        ref={waypointRef}
                                        type="text"
                                        placeholder="Destination…"
                                        style={{ width: '100%' }}
                                        onBlur={() => setWaypoint(waypointRef.current?.value)}
                                    />
                                </Autocomplete>
                            </div>

                            <div style={{ fontSize: '20px', paddingBottom: '10px', opacity: 0.4, flexShrink: 0 }}>→</div>

                            <div style={{ flex: 1, minWidth: '180px' }}>
                                <label className="muted small" style={{ display: 'block', marginBottom: '6px' }}>📍 Point C <span style={{ opacity: 0.5 }}>(optional extra stop)</span></label>
                                <Autocomplete
                                    onLoad={a => (destinationAutocomplete.current = a)}
                                    onPlaceChanged={() => {
                                        const place = destinationAutocomplete.current?.getPlace();
                                        const addr = place?.formatted_address || destinationRef.current?.value;
                                        setDestination(addr);
                                        if (origin || originRef.current?.value) {
                                            setTimeout(calculateRoute, 100);
                                        }
                                    }}
                                >
                                    <input
                                        ref={destinationRef}
                                        type="text"
                                        placeholder="Destination address…"
                                        style={{ width: '100%' }}
                                        onBlur={() => {
                                            setDestination(destinationRef.current?.value);
                                            handleDestinationChange();
                                        }}
                                    />
                                </Autocomplete>
                            </div>

                            <div style={{ flexShrink: 0, paddingBottom: '2px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, paddingRight: '8px' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={isRoundTrip}
                                        onChange={(e) => setIsRoundTrip(e.target.checked)}
                                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                    />
                                    Round Trip
                                </label>

                                <button
                                    className="btn secondary"
                                    onClick={calculateRoute}
                                    disabled={calculating}
                                    style={{ padding: '12px 18px', whiteSpace: 'nowrap' }}
                                >
                                    {calculating ? '⏳ Calculating…' : '🗺️ Calculate'}
                                </button>
                            </div>
                        </div>

                        {/* Notes + Invoice link */}
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                            <div style={{ flex: 2, minWidth: '200px' }}>
                                <label className="muted small" style={{ display: 'block', marginBottom: '6px' }}>Notes (optional)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Picked up rental lens on the way"
                                    value={formNotes}
                                    onChange={e => setFormNotes(e.target.value)}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div style={{ flex: 1, minWidth: '200px' }}>
                                <label className="muted small" style={{ display: 'block', marginBottom: '6px' }}>Link to Invoice (optional)</label>
                                <select value={linkedInvoice} onChange={e => setLinkedInvoice(e.target.value)} style={{ width: '100%' }}>
                                    <option value="">— No invoice —</option>
                                    {invoicesList.map(inv => (
                                        <option key={inv.id} value={String(inv.id)}>
                                            #{inv.invoice_number}{inv.clients?.name ? ' — ' + inv.clients.name : ''}{inv.total_cents ? ' ($' + (inv.total_cents / 100).toFixed(2) + ')' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {mapError && (
                            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '10px 14px', color: '#ef4444', fontSize: '13px', marginBottom: '14px' }}>
                                ⚠️ {mapError}
                            </div>
                        )}

                        {/* Distance result + Map */}
                        {calculatedMiles !== null && (
                            <div style={{ marginBottom: '16px', animation: 'fadeIn 0.3s ease-out' }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
                                    borderRadius: '12px', padding: '14px 20px', marginBottom: '12px', flexWrap: 'wrap', gap: '12px'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '11px', fontWeight: 700, opacity: 0.5, letterSpacing: '0.08em' }}>{isRoundTrip ? 'ROUND TRIP DISTANCE' : 'TOTAL DISTANCE'}</div>
                                        <div style={{ fontSize: '2rem', fontWeight: 900, color: '#818cf8' }}>
                                            {calculatedMiles} <span style={{ fontSize: '1rem', opacity: 0.6 }}>mi</span>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 700, opacity: 0.5, letterSpacing: '0.08em' }}>IRS DEDUCTION</div>
                                        <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#4ade80' }}>
                                            {formatMoney(calculatedMiles * currentRate * 100)}
                                        </div>
                                        <a
                                            href={`https://www.google.com/maps/dir/${encodeURIComponent(origin)}/${waypoint ? encodeURIComponent(waypoint) + '/' : ''}${encodeURIComponent(destination)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ display: 'inline-block', marginTop: '8px', fontSize: '11px', fontWeight: 700, color: '#818cf8', textDecoration: 'none', padding: '4px 10px', border: '1px solid rgba(129,140,248,0.4)', borderRadius: '6px' }}
                                        >
                                            🗺️ Open in Google Maps ↗
                                        </a>
                                    </div>
                                </div>
                                <GoogleMap
                                    mapContainerStyle={MAP_CONTAINER_STYLE}
                                    zoom={11}
                                    center={mapCenter}
                                    options={MAP_OPTIONS}
                                >
                                    {directions && <DirectionsRenderer directions={directions} options={{ suppressMarkers: false, polylineOptions: { strokeColor: '#818cf8', strokeWeight: 4 } }} />}
                                </GoogleMap>
                            </div>
                        )}

                        <button
                            className="btn primary glow-blue"
                            onClick={handleAddTrip}
                            disabled={!calculatedMiles || !formName}
                            style={{ width: '100%', padding: '14px', fontSize: '15px', fontWeight: 800, marginTop: '4px', opacity: (!calculatedMiles || !formName) ? 0.4 : 1 }}
                        >
                            ✅ Log This Trip
                        </button>
                    </>
                )}
            </div>

            {/* Trip History */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '20px' }}>
                <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0 }}>Trip History</h2>
                    <div className="muted small">{mileage.length} trips logged in {selectedYear}</div>
                </div>
                <div className="tableWrap" style={{ maxHeight: '500px' }}>
                    <table>
                        <thead>
                            <tr>
                                <th 
                                    style={{ cursor: 'pointer', userSelect: 'none' }} 
                                    onClick={() => setSortDesc(!sortDesc)}
                                >
                                    Date {sortDesc ? '▼' : '▲'}
                                </th>
                                <th>Trip / Route</th>
                                <th style={{ textAlign: 'center' }}>Miles</th>
                                <th style={{ textAlign: 'right' }}>Deduction</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...mileage].sort((a, b) => {
                                if (sortDesc) {
                                    if (a.log_date !== b.log_date) return new Date(b.log_date) - new Date(a.log_date);
                                    return b.id - a.id;
                                } else {
                                    if (a.log_date !== b.log_date) return new Date(a.log_date) - new Date(b.log_date);
                                    return a.id - b.id;
                                }
                            }).map(m => {
                                const parts = m.purpose?.split(' | ') || [];
                                const name = parts[0] || m.purpose;
                                const route = parts[1] || '';
                                const notes = parts[2] || '';
                                const isBeingEdited = editingId === m.id;
                                return (
                                    <tr key={m.id} style={isBeingEdited ? { background: 'rgba(99,102,241,0.1)' } : undefined}>
                                        <td style={{ fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'top', paddingTop: '12px' }}>{m.log_date}</td>
                                        <td style={{ verticalAlign: 'top', paddingTop: '12px' }}>
                                            <div style={{ fontWeight: 700 }}>{name}</div>
                                            {route && <div className="muted small" style={{ fontSize: '11px', marginTop: '2px' }}>{route}</div>}
                                            {notes && <div className="muted small" style={{ fontSize: '10px', fontStyle: 'italic', marginTop: '1px', opacity: 0.6 }}>{notes}</div>}
                                            <div className="muted small" style={{ fontSize: '9px', marginTop: '2px' }}>IRS Log ID #{m.id}{isBeingEdited ? ' — editing above' : ''}</div>
                                        </td>
                                        <td style={{ textAlign: 'center', verticalAlign: 'top', paddingTop: '12px' }}>
                                            <span className="tag" style={{ background: 'rgba(255,255,255,0.05)', fontWeight: 900 }}>{Number(m.miles).toLocaleString()}</span>
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#4ade80', verticalAlign: 'top', paddingTop: '12px' }}>
                                            {formatMoney(Number(m.miles) * currentRate * 100)}
                                        </td>
                                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top', paddingTop: '12px' }}>
                                            <button className="btn sm secondary" onClick={() => handleDuplicateTrip(m)} style={{ marginRight: '6px' }}>Copy</button>
                                            <button className="btn sm secondary" onClick={() => handleStartEditInForm(m)} style={{ marginRight: '6px' }}>Edit</button>
                                            <button className="btn sm secondary" onClick={() => handleDeleteMileage(m.id)} style={{ color: '#ef4444' }}>×</button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {mileage.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="muted center" style={{ padding: '60px' }}>
                                        <div style={{ fontSize: '30px', marginBottom: '10px' }}>🚗</div>
                                        No business trips logged for {selectedYear} yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* IRS Rates */}
            <div className="card">
                <div
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    onClick={() => setRatesOpen(!ratesOpen)}
                >
                    <div>
                        <h2 style={{ margin: 0 }}>IRS Compliance & Rates {ratesOpen ? '▲' : '▼'}</h2>
                        <div className="muted small">Configuring the global rate engine for Sch C Line 9.</div>
                    </div>
                    <button className="btn sm secondary" onClick={e => { e.stopPropagation(); handleSyncIRS(); }}>
                        {syncStatus || 'Sync IRS Rates'}
                    </button>
                </div>

                {ratesOpen && (
                    <div style={{ marginTop: '24px', animation: 'fadeIn 0.3s ease-out' }}>
                        <div className="grid two" style={{ gap: '20px' }}>
                            <div className="tableWrap">
                                <table className="sm">
                                    <thead><tr><th>Year</th><th>Rate</th><th>Source</th></tr></thead>
                                    <tbody>
                                        {mileageRates.map(r => (
                                            <tr key={r.year} style={r.year === selectedYear ? { background: 'rgba(99,102,241,0.1)' } : {}}>
                                                <td>{r.year}</td>
                                                <td><span className="tag ok">${Number(r.rate_per_mile).toFixed(2)}</span></td>
                                                <td className="muted small">{r.source}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div>
                                <h3 style={{ marginTop: 0 }}>Manual Override</h3>
                                <div className="controls" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <input type="number" placeholder="Year" value={manualRate.year} onChange={e => setManualRate({ ...manualRate, year: e.target.value })} />
                                    <input type="number" placeholder="Rate (e.g. 0.70)" value={manualRate.rate} onChange={e => setManualRate({ ...manualRate, rate: e.target.value })} />
                                    <button className="btn secondary" onClick={handleManualRate}>Save Override</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
