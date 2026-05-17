import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useActivityPulse } from "./hooks/useActivityPulse";
import { useLeadsRealtime } from "./hooks/useLeadsRealtime";
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthContext';
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
const Home           = lazy(() => import('./pages/Home'));
const PayInvoice     = lazy(() => import('./pages/PayInvoice'));
const AddOns         = lazy(() => import('./pages/AddOns'));
const AssistantSidebar = lazy(() => import('./components/AssistantSidebar'));
import ChangeLogModal from './components/control-center/ChangeLogModal.jsx';

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

function AppContent() {
  useActivityPulse();
  const { newLeadCount, clearBadge } = useLeadsRealtime();
  const [apiStatus, setApiStatus] = useState('Checking...');
  const { user, loading, logout, subscription, settings } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showRedeem, setShowRedeem] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [newVersion, setNewVersion] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const menuRef = useRef(null);

  // --- Version Check Hook ---
  // DEPLOY SOP: update CURRENT_VERSION here AND web-react/public/version.json on every release.
  useEffect(() => {
    const CURRENT_VERSION = "7.5.4";

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

  const handleWhatsNewClick = () => {
    const CURRENT_VERSION = "7.5.4";
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
          {/* Public: no login required — client payment portal */}
          <Route path="/pay/:token" element={<PayInvoice />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    );
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
          <div className="mobile-toggle" style={{ cursor: 'pointer', padding: '10px' }} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
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
            animation: 'fadeInDown 0.2s ease-out'
          }}>
            {/* Financials */}
            <div style={{ padding: '6px 16px 4px', fontSize: '9px', fontWeight: 900, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Financials</div>
            <NavLink to="/" end onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              Dashboard
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
            <NavLink to="/mileage" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              Mileage Log
            </NavLink>
            <NavLink to="/import" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              Bank Import
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
                to="/StudioControlCenter?tab=profile"
                onClick={() => setMobileMenuOpen(false)}
                className={() => `dropdown-item ${location.pathname === '/StudioControlCenter' && location.search.includes('tab=profile') ? 'active' : ''}`}
            >
              Business Profile
            </NavLink>
            <NavLink
                to="/StudioControlCenter"
                end
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) => `dropdown-item ${isActive && !location.search ? 'active' : ''}`}
            >
              Ledger Control Center
            </NavLink>
            <NavLink to="/addons" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              Add-Ons
            </NavLink>
            <NavLink
                to="/StudioControlCenter?tab=help"
                onClick={() => setMobileMenuOpen(false)}
                className={() => `dropdown-item ${location.pathname === '/StudioControlCenter' && location.search.includes('tab=help') ? 'active' : ''}`}
            >
              Documentation & FAQ
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
            <Route path="/addons" element={<AddOns />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            {/* Public: client payment portal, also accessible when logged in */}
            <Route path="/pay/:token" element={<PayInvoice />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </main>

      {showChangelogModal && <ChangeLogModal onClose={() => setShowChangelogModal(false)} />}

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
