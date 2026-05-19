import React, { useState } from 'react';
import { apiPost, apiPatch, apiDelete } from '../../api';
import { useModal } from '../ModalContext.jsx';

export default function SaasTab({ user, allSubscriptions, betaCodes, dailyStats, statusMsg, onReload }) {
    const modal = useModal();
    const [inviteName, setInviteName] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [invitePlan, setInvitePlan] = useState('beta_tester');
    const [genCodeLoading, setGenCodeLoading] = useState(false);
    const [editingInvite, setEditingInvite] = useState(null);
    const [editInviteData, setEditInviteData] = useState({ name: '', email: '', plan: '' });
    const [editingSession, setEditingSession] = useState(null);
    const [editSessionData, setEditSessionData] = useState({ name: '', plan: '' });

    const isAdmin = user?.email?.toLowerCase() === 'joshua.deuermeyer@gmail.com';

    const handleGenerateBetaCode = async () => {
        setGenCodeLoading(true);
        try {
            await apiPost('/admin/beta-codes', { daysValid: 90, assigned_to_name: inviteName, assigned_to_email: inviteEmail, plan_type: invitePlan });
            modal.alert(inviteEmail ? `Success! 90-day invite created and emailed to ${inviteEmail}.` : `Success! Invite code ${inviteName ? 'for ' + inviteName : ''} created.`);
            setInviteName(''); setInviteEmail(''); setInvitePlan('beta_tester');
            onReload(true);
        } catch (err) { modal.alert(err.message); }
        finally { setGenCodeLoading(false); }
    };

    const handleUpdateInvite = async (code) => {
        try {
            await apiPatch(`/admin/beta-codes/${code}`, { assigned_to_name: editInviteData.name, assigned_to_email: editInviteData.email, plan_type: editInviteData.plan });
            setEditingInvite(null); onReload(true);
        } catch (err) { modal.alert(err.message); }
    };

    const handleUpdateSession = async (userId) => {
        try {
            await apiPatch(`/admin/subscriptions/${userId}`, { display_name: editSessionData.name, plan_type: editSessionData.plan });
            setEditingSession(null); onReload(true);
        } catch (err) { modal.alert(err.message); }
    };

    const handleDeleteBetaCode = async (code) => {
        const ok = await modal.confirm(`Are you sure you want to delete code ${code}?`);
        if (!ok) return;
        try { await apiDelete(`/admin/beta-codes/${code}`); onReload(true); } catch (err) { modal.alert(err.message); }
    };

    const handleResendInvite = async (code) => {
        try { await apiPost(`/admin/beta-codes/${code}/resend`); modal.alert(`Invite resent for code ${code}!`); } catch (err) { modal.alert(err.message); }
    };

    const handleExtendSubscription = async (userId, email) => {
        const ok = await modal.confirm(`Extend ${email}'s access by 90 days?`);
        if (!ok) return;
        try { await apiPost(`/admin/subscriptions/${userId}/extend`); modal.alert(`Success! 90 days added to ${email}.`); onReload(true); } catch (err) { modal.alert(err.message); }
    };

    const handleRevokeSubscription = async (userId, email) => {
        const ok = await modal.confirm(`Revoke access for ${email}? This will suspend their ledger immediately.`);
        if (!ok) return;
        try { await apiPost(`/admin/subscriptions/${userId}/suspend`); onReload(true); } catch (err) { modal.alert(err.message); }
    };

    if (!isAdmin) {
        return (
            <div className="card glass" style={{ textAlign: 'center', padding: '100px 40px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '20px' }}>🔒</div>
                <h2 style={{ fontSize: '2rem' }}>Administrative Hub</h2>
                <p className="muted" style={{ maxWidth: '500px', margin: '0 auto', lineHeight: '1.6' }}>
                    The SaaS Ledger Management suite is restricted to the administrator account (<strong>Joshua Deuermeyer</strong>).
                    Users with <strong>Beta</strong> or <strong>Professional</strong> access can manage their own ledger settings in the <strong>Business Profile</strong> tab.
                </p>
            </div>
        );
    }

    const formatDuration = (min) => {
        const d = Math.floor(min / 1440);
        const h = Math.floor((min % 1440) / 60);
        const m = min % 60;
        return [d > 0 ? `${d}d` : '', h > 0 ? `${h}h` : '', `${m}m`].filter(Boolean).join(' ');
    };

    const PLAN_OPTIONS = ['beta_tester', 'monthly', 'annual', 'lifetime'];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '100%', boxSizing: 'border-box' }}>
            {statusMsg && statusMsg.type === 'bad' && (
                <div className="card glass" style={{ border: '1px solid #ff4d4d', padding: '15px 20px', background: 'rgba(255, 77, 77, 0.05)', fontSize: '12px', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: '#ff4d4d', fontWeight: 900 }}>⚠️ ADMIN DATA ACCESS PARTIAL FAILURE: {statusMsg.text}</div>
                    <button className="btn sm secondary" onClick={() => onReload()}>RETRY SYNC</button>
                </div>
            )}

            {/* Ledger Access Keys */}
            <div className="card glass" style={{ padding: '30px' }}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '1.2rem' }}>Ledger Access Keys</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', alignItems: 'flex-end' }}>
                    <div>
                        <small className="muted" style={{ fontWeight: 900, marginBottom: '6px', display: 'block', fontSize: '10px' }}>NAME</small>
                        <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Photographer Name" style={{ padding: '12px', fontSize: '14px', height: '44px' }} />
                    </div>
                    <div>
                        <small className="muted" style={{ fontWeight: 900, marginBottom: '6px', display: 'block', fontSize: '10px' }}>EMAIL</small>
                        <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="hello@studio.com" style={{ padding: '12px', fontSize: '14px', height: '44px' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <small className="muted" style={{ fontWeight: 900, marginBottom: '6px', display: 'block', fontSize: '10px' }}>PLAN TYPE</small>
                            <select value={invitePlan} onChange={e => setInvitePlan(e.target.value)} style={{ padding: '0 12px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', width: '100%', height: '44px', fontSize: '13px' }}>
                                {PLAN_OPTIONS.map(p => <option key={p} value={p}>{p.toUpperCase().replace('_', ' ')}</option>)}
                            </select>
                        </div>
                        <button className="btn primary" onClick={handleGenerateBetaCode} disabled={genCodeLoading} style={{ height: '44px', padding: '0 25px', fontSize: '13px', fontWeight: 900, borderRadius: '12px' }}>
                            {genCodeLoading ? '...' : 'GENERATE KEY'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Access Inventory */}
            <div className="card glass" style={{ margin: 0, padding: '20px' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>Access Inventory</h3>
                <div className="tableWrap" style={{ border: 'none', maxHeight: '300px', overflowY: 'auto' }}>
                    <table style={{ width: '100%' }}>
                        <thead>
                            <tr style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textAlign: 'left' }}>
                                <th style={{ width: '150px' }}>CODE</th>
                                <th>RECIPIENT IDENTITY</th>
                                <th>PLAN</th>
                                <th style={{ textAlign: 'right' }}>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody style={{ fontSize: '13px' }}>
                            {betaCodes.map(c => (
                                <tr key={c.code} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                    <td style={{ fontWeight: 900, color: 'var(--accent)', padding: '12px 0' }}>{c.code}</td>
                                    <td>
                                        <div style={{ fontWeight: 800 }}>{c.assigned_to_name || '—'}</div>
                                        <div className="muted" style={{ fontSize: '11px' }}>{c.assigned_to_email || 'General Invite'}</div>
                                    </td>
                                    <td><span className="tag secondary" style={{ fontSize: '10px' }}>{c.plan_type?.toUpperCase() || 'BETA'}</span></td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                            {!c.is_used ? (
                                                <>
                                                    <button onClick={() => { setEditingInvite(c.code); setEditInviteData({ name: c.assigned_to_name || '', email: c.assigned_to_email || '', plan: c.plan_type || 'beta_tester' }); }} className="btn sm secondary" style={{ fontSize: '11px', padding: '6px 12px' }}>EDIT</button>
                                                    <button onClick={() => handleResendInvite(c.code)} className="btn sm secondary" style={{ fontSize: '11px', padding: '6px 12px' }}>RESEND</button>
                                                </>
                                            ) : <span className="tag bad" style={{ fontSize: '11px' }}>REDEEMED</span>}
                                            <button onClick={() => handleDeleteBetaCode(c.code)} style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px', borderRadius: '8px' }}>✕</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Active Ledger Members */}
            <div className="card glass" style={{ padding: '30px' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>Active Ledger Members</h3>
                <div className="tableWrap" style={{ border: 'none', maxHeight: '500px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', minWidth: '1000px' }}>
                        <thead>
                            <tr style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textAlign: 'left' }}>
                                <th>IDENTITY</th>
                                <th>LICENSE TYPE</th>
                                <th>ACCESS EXPIRATION</th>
                                <th style={{ textAlign: 'right' }}>MANAGEMENT CONTROL</th>
                            </tr>
                        </thead>
                        <tbody style={{ fontSize: '13px' }}>
                            {allSubscriptions.map(s => {
                                const daysUntilExpiry = Math.ceil((new Date(s.expires_at) - new Date()) / (1000 * 60 * 60 * 24));
                                const isExpired = daysUntilExpiry <= 0;
                                const expiryColor = (isExpired || s.status === 'suspended') ? 'bad' : (daysUntilExpiry <= 3 ? 'bad glow-red' : (daysUntilExpiry <= 7 ? 'warn glow-yellow' : 'ok'));
                                return (
                                    <tr key={s.user_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                        <td style={{ padding: '15px 0' }}>
                                            <div style={{ fontWeight: 800, color: 'white', fontSize: '14px' }}>{s.display_name || s.email.split('@')[0]}</div>
                                            <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>{s.email}</div>
                                        </td>
                                        <td><span className="tag secondary" style={{ fontSize: '11px', fontWeight: 800 }}>{s.plan_type.toUpperCase()}</span></td>
                                        <td><span className={`tag ${expiryColor}`} style={{ fontSize: '11px', fontWeight: 900, padding: '6px 12px' }}>{isExpired ? 'EXPIRED' : `${daysUntilExpiry}D REMAINING`}</span></td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button onClick={() => { setEditingSession(s.user_id); setEditSessionData({ name: s.display_name || '', plan: s.plan_type || 'beta_tester' }); }} className="btn sm secondary" style={{ fontSize: '11px', padding: '8px 16px' }}>EDIT</button>
                                                <button onClick={() => handleExtendSubscription(s.user_id, s.email)} className="btn sm primary" style={{ fontSize: '11px', padding: '8px 16px' }}>+90D EXTEND</button>
                                                <button onClick={() => handleRevokeSubscription(s.user_id, s.email)} className="btn sm danger" style={{ fontSize: '11px', padding: '8px 16px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>BLOCK ACCESS</button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Engagement Pulse */}
            <div className="card glass" style={{ margin: 0, padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Engagement Pulse</h3>
                    <span className="tag secondary" style={{ fontSize: '10px', padding: '4px 10px' }}>LAST 7 DAYS</span>
                </div>
                <div className="tableWrap" style={{ border: 'none', maxHeight: '300px', overflowY: 'auto' }}>
                    <table style={{ width: '100%' }}>
                        <tbody>
                            {dailyStats.length > 0 ? dailyStats.map(s => (
                                <tr key={s.email} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                    <td style={{ padding: '8px 0' }}>
                                        <div style={{ fontWeight: 800, fontSize: '14px' }}>{s.name || s.email?.split('@')[0]}</div>
                                        <div className="muted" style={{ fontSize: '10px' }}>{s.email}</div>
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 900, color: '#4ade80', fontSize: '13px' }}>{formatDuration(s.minutes_today)}</td>
                                </tr>
                            )) : (
                                <tr><td className="muted center" style={{ padding: '20px', fontSize: '12px' }}>No ledger sessions recorded in the last 7 days.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>



            {/* Edit Invite Modal */}
            {editingInvite && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', zIndex: 30000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div className="card glass glow-blue" style={{ width: '100%', maxWidth: '400px', padding: '30px' }}>
                        <h3 style={{ marginBottom: '20px' }}>Edit Access Key</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div><small className="muted" style={{ fontWeight: 900, marginBottom: '5px', display: 'block' }}>NAME</small><input value={editInviteData.name} onChange={e => setEditInviteData({ ...editInviteData, name: e.target.value })} style={{ padding: '12px' }} /></div>
                            <div><small className="muted" style={{ fontWeight: 900, marginBottom: '5px', display: 'block' }}>EMAIL</small><input value={editInviteData.email} onChange={e => setEditInviteData({ ...editInviteData, email: e.target.value })} style={{ padding: '12px' }} /></div>
                            <div>
                                <small className="muted" style={{ fontWeight: 900, marginBottom: '5px', display: 'block' }}>PLAN</small>
                                <select value={editInviteData.plan} onChange={e => setEditInviteData({ ...editInviteData, plan: e.target.value })} style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', width: '100%' }}>
                                    {PLAN_OPTIONS.map(p => <option key={p} value={p}>{p.toUpperCase().replace('_', ' ')}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button className="btn primary" onClick={() => handleUpdateInvite(editingInvite)} style={{ flex: 1 }}>SAVE CHANGES</button>
                                <button className="btn secondary" onClick={() => setEditingInvite(null)} style={{ flex: 1 }}>CANCEL</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Session Modal */}
            {editingSession && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', zIndex: 30000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div className="card glass glow-blue" style={{ width: '100%', maxWidth: '400px', padding: '30px' }}>
                        <h3 style={{ marginBottom: '20px' }}>Edit Ledger Member</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div><small className="muted" style={{ fontWeight: 900, marginBottom: '5px', display: 'block' }}>DISPLAY NAME</small><input value={editSessionData.name} onChange={e => setEditSessionData({ ...editSessionData, name: e.target.value })} style={{ padding: '12px' }} /></div>
                            <div>
                                <small className="muted" style={{ fontWeight: 900, marginBottom: '5px', display: 'block' }}>PLAN TYPE</small>
                                <select value={editSessionData.plan} onChange={e => setEditSessionData({ ...editSessionData, plan: e.target.value })} style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', width: '100%' }}>
                                    {PLAN_OPTIONS.map(p => <option key={p} value={p}>{p.toUpperCase().replace('_', ' ')}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button className="btn primary" onClick={() => handleUpdateSession(editingSession)} style={{ flex: 1 }}>UPDATE MEMBER</button>
                                <button className="btn secondary" onClick={() => setEditingSession(null)} style={{ flex: 1 }}>CANCEL</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
