import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useActivityPulse } from "./hooks/useActivityPulse";
import { useLeadsRealtime } from "./hooks/useLeadsRealtime";
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth, supabase } from './components/AuthContext';
import { ModalProvider } from './components/ModalContext';

// Code-split every page — only load the chunk when the user navigates to it
const DashboardV2    = lazy(() => import('./pages/DashboardV2'));
const Transactions   = lazy(() => import('./pages/Transactions'));
const Tax            = lazy(() => import('./pages/Tax'));
const Backup         = lazy(() => import('./pages/Backup'));
const Assets         = lazy(() => import('./pages/Assets'));
const CRM            = lazy(() => import('./pages/CRM'));
const Import         = lazy(() => import('./pages/Import'));
const Login          = lazy(() => import('./pages/Login'));
const Mileage        = lazy(() => import('./pages/Mileage'));
const Privacy        = lazy(() => import('./pages/Privacy'));
const Terms          = lazy(() => import('./pages/Terms'));
const SecurityPolicy = lazy(() => import('./pages/SecurityPolicy'));
const Home           = lazy(() => import('./pages/Home'));
const PayInvoice     = lazy(() => import('./pages/PayInvoice'));
const AddOns         = lazy(() => import('./pages/AddOns'));
const Accounts       = lazy(() => import('./pages/Accounts'));
const AssistantSidebar = lazy(() => import('./components/AssistantSidebar'));
import ChangeLogModal from './components/control-center/ChangeLogModal.jsx';
import OnboardingChecklist from './components/OnboardingChecklist.jsx';

// Shared route-level loading fallback — matches app's existing spinner style
function PageSpinner() {
  return (
    <div style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ marginBottom: '12px' }}></div>
        <div style={{ fontWeight: 800, letterSpacing: '0.1em', fontSize: '11px', opacity: 0.4 }}>LOADING MODULE...</div>
      </div>
    </div>
  );
}


// Higher Order Component to protect routes
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ marginBottom: '20px' }}></div>
          <div style={{ fontWeight: 800, letterSpacing: '0.1em', fontSize: '12px', opacity: 0.5 }}>AUTHORIZING LEDGER SESSION...</div>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

// ── First-Run Onboarding Modal ───────────────────────────────────────────────
// Shown once to new users who have a subscription but haven't configured
// their business profile or Gemini key. Dismissed via localStorage flag.
// OnboardingModal replaced by OnboardingChecklist component (see components/OnboardingChecklist.jsx)

// ── Beta Code Gate Component ─────────────────────────────────────────────────
// Shown to authenticated users who have no subscription record.
// Handles both: Google OAuth users who skipped the code step, and any
// edge case where a subscription record is missing post-signup.
function BetaCodeGate({ email, onSuccess, onLogout }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleRedeem = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/subscription/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ code: code.trim().toUpperCase() })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message || 'Invalid code');
      onSuccess(); // refreshes subscription in AuthContext → gate disappears
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(circle at top right, #1e293b, #0f172a)', padding: '20px'
    }}>
      <div className="card glass" style={{ maxWidth: '440px', width: '100%', padding: '50px 40px', textAlign: 'center' }}>
        <img src="/icon.png" alt="Lumière Ledger" style={{ height: '80px', borderRadius: '20px', marginBottom: '24px', filter: 'drop-shadow(0 0 20px rgba(249,115,22,0.2))' }} />
        <h2 style={{ margin: '0 0 8px', fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Invite Code Required</h2>
        <p className="muted" style={{ fontSize: '13px', marginBottom: '28px', lineHeight: 1.6 }}>
          Signed in as <strong style={{ color: 'white' }}>{email}</strong>.<br />
          Enter your invite code to activate ledger access.
        </p>
        <form onSubmit={handleRedeem} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="ENTER YOUR 8-DIGIT CODE"
            style={{ fontWeight: 900, letterSpacing: '0.15em', textAlign: 'center', borderColor: 'var(--accent)', fontSize: '16px', padding: '14px' }}
            autoFocus
          />
          {error && (
            <div className="tag bad" style={{ padding: '10px', borderRadius: '8px', fontSize: '13px' }}>{error}</div>
          )}
          <button type="submit" className="btn primary glow-orange" style={{ padding: '16px', fontSize: '15px', borderRadius: '12px' }} disabled={loading}>
            {loading ? 'ACTIVATING...' : 'ACTIVATE ACCESS'}
          </button>
        </form>
        <button
          onClick={onLogout}
          style={{ marginTop: '20px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}
        >
          Sign out and use a different account
        </button>
      </div>
    </div>
  );
}

function AppContent() {
  useActivityPulse();
  const { newLeadCount, clearBadge } = useLeadsRealtime();
  const [apiStatus, setApiStatus] = useState('Checking...');
  const { user, loading, logout, subscription, subscriptionReady, settings, refreshSubscription } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showRedeem, setShowRedeem] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [newVersion, setNewVersion] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const menuRef = useRef(null);

  // --- Version Check Hook ---
  // DEPLOY SOP: update CURRENT_VERSION here AND web-react/public/version.json on every release.
  useEffect(() => {
    const CURRENT_VERSION = "7.8.43";

    // What's New: show button if user hasn't dismissed it for this version
    const seen = localStorage.getItem('ll_whats_new_seen');
    if (seen !== CURRENT_VERSION) setShowWhatsNew(true);

    const checkVersion = async () => {
      try {
        const res = await fetch('/version.json?v=' + Date.now());
        const data = await res.json();
        if (data.version && data.version !== CURRENT_VERSION) {
          setNewVersion(true);
        }
      } catch (e) { /* silent fail */ }
    };
    const timer = setInterval(checkVersion, 5 * 60 * 1000); // Check every 5 minutes
    checkVersion();
    return () => clearInterval(timer);
  }, [user]);

  // ── First-Run Onboarding Trigger ───────────────────────────────────────────
  // Fires once auth data is resolved. Uses subscriptionReady (not subscription)
  // because new users have no subscription record yet — subscription stays null
  // and the old guard caused the modal to never fire for brand-new accounts.
  useEffect(() => {
    // settings starts as null (AuthContext init) and stays null if /api/settings returns
    // PGRST116 (no row found for new user). Guard only against undefined (not yet attempted).
    if (!user || !subscriptionReady || settings === undefined) return;
    const dismissed = localStorage.getItem('ll_onboarding_dismissed_v2');
    if (dismissed) return;
    // Show for all users who haven't dismissed v2 — including existing users with business names
    setShowOnboarding(true);
  }, [user?.id, subscriptionReady, settings]);

  const handleOnboardingDismiss = () => {
    localStorage.setItem('ll_onboarding_dismissed_v2', '1');
    setShowOnboarding(false);
  };

  const handleOnboardingGoSetup = () => {
    localStorage.setItem('ll_onboarding_done_' + user?.id, '1');
    setShowOnboarding(false);
    navigate('/StudioControlCenter?tab=profile');
  };

  const handleWhatsNewClick = () => {
    const CURRENT_VERSION = "7.8.43";
    localStorage.setItem('ll_whats_new_seen', CURRENT_VERSION);
    setShowWhatsNew(false);
    setShowChangelogModal(true);
  };

  // Calculate days left
  const daysLeft = subscription?.expires_at 
    ? Math.ceil((new Date(subscription.expires_at) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  // Use business name or email as identity
  const identityName = settings?.business_name || settings?.contact_name || user?.email;
  const identityTitle = settings?.job_title;

  // Close menu on click-outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuRef]);

  useEffect(() => {
    if (!user) return; // Don't check health if not logged in

    const checkApi = async () => {
      try {
        const r = await fetch('/api/health', { credentials: 'include' });
        if (r.ok) {
          setApiStatus('API: OK');
        } else {
          setApiStatus('API: Error');
        }
      } catch (err) {
        setApiStatus(`API: Connection Error`);
      }
    };

    checkApi();
    const interval = setInterval(checkApi, 60000); // 60s — sub-minute API status is not actionable
    return () => clearInterval(interval);
  }, [user]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ marginBottom: '20px' }}></div>
          <div style={{ fontWeight: 800, letterSpacing: '0.1em', fontSize: '12px', opacity: 0.5 }}>SYNCHRONIZING LEDGER...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/security-policy" element={<SecurityPolicy />} />
          {/* Public: no login required — client payment portal */}
          <Route path="/pay/:token" element={<PayInvoice />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    );
  }

  // ── Beta Code Gate ────────────────────────────────────────────────────────
  // Fires after auth is confirmed but subscription check is complete with no record.
  // Catches Google OAuth users who signed in without entering an invite code.
  if (subscriptionReady && !subscription && user?.email !== 'joshua.deuermeyer@gmail.com') {
    return <BetaCodeGate email={user.email} onSuccess={refreshSubscription} onLogout={logout} />;
  }

  return (
    <div className="wrap">
      <Suspense fallback={null}><AssistantSidebar /></Suspense>
      {/* Expiration Banner */}
      {daysLeft !== null && daysLeft <= 7 && (
        <div style={{ 
          background: daysLeft <= 0 ? '#ef4444' : '#f59e0b', 
          color: 'white', 
          textAlign: 'center', 
          padding: '8px', 
          fontSize: '12px', 
          fontWeight: 'bold',
          letterSpacing: '0.05em'
        }}>
          {daysLeft <= 0 
            ? 'LEDGER ACCESS EXPIRED — UPDATES DISABLED' 
            : `LEDGER ACCESS EXPIRES IN ${daysLeft} DAYS`}
          <button 
            onClick={() => navigate('/StudioControlCenter?tab=saas')} 
            style={{ marginLeft: '15px', padding: '2px 8px', background: 'white', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}
          >
            EXTEND ACCESS
          </button>
        </div>
      )}      <header ref={menuRef} className="card glass" style={{ border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 30px', position: 'sticky', top: '15px', zIndex: 1000, margin: '15px auto', maxWidth: '1400px', cursor: 'default' }}>
        {/* Left Side: Brand */}
        <div style={{ flex: '1', display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <img src="/icon.png" alt="Lumière Ledger Logo" style={{ width: '40px', height: '40px', borderRadius: '10px' }} />
            <div>
              <div className="title" style={{ fontSize: '1.8rem', fontWeight: 950, letterSpacing: '-0.02em', whiteSpace: 'nowrap', lineHeight: 1 }}>LUMIÈRE LEDGER</div>
              <div className="muted" style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.05em', marginTop: '2px', opacity: 0.6 }}>INTEL FOR TODAY'S PHOTOGRAPHER</div>
            </div>
          </div>
        </div>

        {/* Center: Update Banner */}
        {newVersion && (
          <button
            onClick={() => window.location.reload(true)}
            className="glow-green"
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              cursor: 'pointer',
              border: '1px solid rgba(16,185,129,0.4)',
              borderRadius: '10px',
              background: 'rgba(16,185,129,0.12)',
              color: '#10b981',
              padding: '10px 24px',
              fontSize: '12px',
              fontWeight: 900,
              letterSpacing: '0.08em',
              whiteSpace: 'nowrap',
              boxShadow: '0 0 18px rgba(16,185,129,0.2)',
            }}
          >
            UPDATE AVAILABLE — CLICK TO REFRESH
          </button>
        )}

        {/* Right Side: What's New + Toggle */}
        <div style={{ flex: '1', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
          {showWhatsNew && (
            <button
              className="desktop-only"
              onClick={handleWhatsNewClick}
              style={{
                cursor: 'pointer',
                border: '1px solid rgba(249,115,22,0.4)',
                borderRadius: '10px',
                background: 'rgba(249,115,22,0.1)',
                color: '#f97316',
                padding: '10px 20px',
                fontSize: '12px',
                fontWeight: 900,
                letterSpacing: '0.06em',
                whiteSpace: 'nowrap',
              }}
            >
              WHAT'S NEW
            </button>
          )}
          <div className="mobile-toggle" style={{ cursor: 'pointer', padding: '10px', position: 'relative' }} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {showWhatsNew && (
              <span style={{
                position: 'absolute', top: '6px', right: '6px',
                width: '8px', height: '8px', borderRadius: '50%',
                background: '#f97316', display: 'block'
              }} />
            )}
            <div style={{ width: '22px', height: '2px', background: 'white', margin: '4px 0' }}></div>
            <div style={{ width: '22px', height: '2px', background: 'white', margin: '4px 0' }}></div>
            <div style={{ width: '16px', height: '2px', background: 'white', margin: '4px 0', marginLeft: 'auto' }}></div>
          </div>
        </div>

        {/* Studio Command Center (Dropdown) */}
        {mobileMenuOpen && (
          <div className="dropdown-menu" style={{
            position: 'absolute',
            top: '90px',
            right: '15px',
            animation: 'fadeInDown 0.2s ease-out',
            maxHeight: 'calc(100vh - 110px)',
            overflowY: 'auto',
          }}>
            {/* What's New — mobile only, shown at top of dropdown */}
            {showWhatsNew && (
              <button
                onClick={() => { setMobileMenuOpen(false); handleWhatsNewClick(); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  cursor: 'pointer', border: 'none', borderBottom: '1px solid rgba(249,115,22,0.2)',
                  background: 'rgba(249,115,22,0.08)', color: '#f97316',
                  padding: '12px 16px', fontSize: '11px', fontWeight: 900,
                  letterSpacing: '0.08em', marginBottom: '4px',
                }}
              >
                ✦ WHAT'S NEW IN v7.6.3
              </button>
            )}

            {/* Financials */}
            <div style={{ padding: '6px 16px 4px', fontSize: '9px', fontWeight: 900, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Financials</div>
            <NavLink to="/" end onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              Dashboard
            </NavLink>
            <NavLink to="/accounts" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              Accounts
            </NavLink>
            <NavLink to="/transactions" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              Transaction Ledger
            </NavLink>
            <NavLink to="/tax" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              Tax Data / Sch C
            </NavLink>

            {/* Operations */}
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '10px 12px 6px' }} />
            <div style={{ padding: '2px 16px 4px', fontSize: '9px', fontWeight: 900, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Operations</div>
            <NavLink to="/import" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              Bank Import
            </NavLink>
            <NavLink to="/mileage" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              Mileage Log
            </NavLink>
            <NavLink to="/equipment" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              Camera Gear
            </NavLink>

            {/* Client Work */}
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '10px 12px 6px' }} />
            <div style={{ padding: '2px 16px 4px', fontSize: '9px', fontWeight: 900, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Client Work</div>
            <NavLink to="/crm" end onClick={() => { setMobileMenuOpen(false); clearBadge(); }} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              CRM Pipeline {newLeadCount > 0 && <span style={{ background: '#ef4444', color: 'white', borderRadius: '50%', fontSize: '9px', fontWeight: 900, padding: '1px 5px', marginLeft: '6px' }}>{newLeadCount > 9 ? '9+' : newLeadCount}</span>}
            </NavLink>
            <NavLink to="/crm/financials" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              Business Invoicing
            </NavLink>

            {/* Settings */}
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '10px 12px 6px' }} />
            <div style={{ padding: '2px 16px 4px', fontSize: '9px', fontWeight: 900, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Settings</div>
            <NavLink
                to="/StudioControlCenter"
                end
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) => `dropdown-item ${isActive && !location.search ? 'active' : ''}`}
            >
              Ledger Control Center
            </NavLink>
            <NavLink
                to="/StudioControlCenter?tab=profile"
                onClick={() => setMobileMenuOpen(false)}
                className={() => `dropdown-item ${location.pathname === '/StudioControlCenter' && location.search.includes('tab=profile') ? 'active' : ''}`}
            >
              Business Profile
            </NavLink>
            <NavLink
                to="/StudioControlCenter?tab=help"
                onClick={() => setMobileMenuOpen(false)}
                className={() => `dropdown-item ${location.pathname === '/StudioControlCenter' && location.search.includes('tab=help') ? 'active' : ''}`}
            >
              Documentation & FAQ
            </NavLink>
            <NavLink to="/addons" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              Add-Ons
            </NavLink>
            <NavLink
                to="/StudioControlCenter?tab=profile"
                onClick={() => setMobileMenuOpen(false)}
                className={() => `dropdown-item ${location.pathname === '/StudioControlCenter' && location.search.includes('tab=profile') ? 'active' : ''}`}
            >
              Account Plans
            </NavLink>
            
            <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px', paddingBottom: '4px' }}>
                <div style={{ padding: '0 12px 16px 12px' }}>
                  <div className="muted" style={{ fontWeight: 950, fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.05em' }}>Ledger Session</div>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: 'white' }}>{identityName}</div>
                  {identityTitle && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>{identityTitle}</div>}
                  <div style={{ fontSize: '10px', color: (daysLeft === null || daysLeft <= 7) ? '#f59e0b' : '#10b981', fontWeight: 900, marginTop: '4px' }}>
                    {subscription ? `${subscription.plan_type?.toUpperCase()} • ${daysLeft}D LEFT` : 'INVITE REQUIRED'}
                  </div>
                </div>
                <button onClick={logout} className="btn sm secondary" style={{ 
                  fontSize: '11px', 
                  borderRadius: '12px', 
                  width: '100%', 
                  padding: '14px', 
                  fontWeight: 900, 
                  background: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.2)', 
                  color: '#ef4444' 
                }}>
                  LOGOUT SESSION
                </button>
            </div>
          </div>
        )}
      </header>

      <main style={{ marginTop: '16px', minHeight: 'calc(100vh - 160px)', animation: 'fadeIn 0.3s ease-out' }}>
        <Suspense fallback={<PageSpinner />}>
          <Routes>
            <Route path="/" element={<DashboardV2 apiStatus={apiStatus} />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/tax" element={<Tax />} />
            <Route path="/mileage" element={<Mileage />} />
            <Route path="/equipment" element={<Assets />} />
            <Route path="/StudioControlCenter" element={<Backup />} />
            <Route path="/backup" element={<Navigate to="/StudioControlCenter" replace />} />
            <Route path="/crm/*" element={<CRM />} />
            <Route path="/import" element={<Import />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/addons" element={<AddOns />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/security-policy" element={<SecurityPolicy />} />
            {/* Public: client payment portal, also accessible when logged in */}
            <Route path="/pay/:token" element={<PayInvoice />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </main>

      {showChangelogModal && <ChangeLogModal onClose={() => setShowChangelogModal(false)} />}
      {showOnboarding && (
        <OnboardingChecklist onDismiss={handleOnboardingDismiss} />
      )}

      {/* Focused Mobile Navigation */}
      <nav className="bottom-nav mobile-only">
        <NavLink to="/" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`} end>
          <span className="bottom-nav-icon">📊</span>
          <span>Studio</span>
        </NavLink>
        <NavLink to="/transactions" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <span className="bottom-nav-icon">💸</span>
          <span>Ledger</span>
        </NavLink>
        <NavLink to="/mileage" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <span className="bottom-nav-icon">🚗</span>
          <span>Trips</span>
        </NavLink>
        <NavLink to="/crm" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`} onClick={clearBadge}>
          <span className="bottom-nav-icon" style={{ position: 'relative', display: 'inline-block' }}>
            👥
            {newLeadCount > 0 && (
              <span style={{ position: 'absolute', top: '-6px', right: '-8px', background: '#ef4444', color: 'white', borderRadius: '50%', fontSize: '9px', fontWeight: 900, minWidth: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                {newLeadCount > 9 ? '9+' : newLeadCount}
              </span>
            )}
          </span>
          <span>Leads</span>
        </NavLink>
      </nav>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ModalProvider>
        <Router>
          <AppContent />
        </Router>
      </ModalProvider>
    </AuthProvider>
  );
}

export default App;
