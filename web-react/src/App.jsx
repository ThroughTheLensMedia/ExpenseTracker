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
  const menuRef = useRef(null);

  // --- Version Check Hook ---
  useEffect(() => {
    const CURRENT_VERSION = "7.0.0";
    const checkVersion = async () => {
      try {
        const res = await fetch('/version.json?v=' + Date.now());
        const data = await res.json();
        if (data.version && data.version !== CURRENT_VERSION) {
          setNewVersion(true);
          // Only auto-reload if we haven't already marked it as new to avoid infinite loops
          if (!newVersion && (location.pathname === '/login' || !user)) {
             console.log("New version detected, updating...");
             // window.location.reload(true); // Temporarily disable auto-reload to be safe
          }
        }
      } catch (e) { /* silent fail */ }
    };
    const timer = setInterval(checkVersion, 60000); // Check every minute
    checkVersion();
    return () => clearInterval(timer);
  }, [user]); // location.pathname removed — restarting the timer on every nav is unnecessary

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
          {newVersion && (
            <button 
              onClick={() => window.location.reload(true)} 
              className="tag ok glow-green" 
              style={{ marginLeft: '12px', cursor: 'pointer', border: 'none', padding: '4px 10px', fontSize: '9px', fontWeight: 900 }}
            >
              🚀 REFRESH FOR UPDATES
            </button>
          )}
        </div>

        {/* Right Side: Toggle */}
        <div className="mobile-toggle" style={{ cursor: 'pointer', padding: '10px' }} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          <div style={{ width: '22px', height: '2px', background: 'white', margin: '4px 0' }}></div>
          <div style={{ width: '22px', height: '2px', background: 'white', margin: '4px 0' }}></div>
          <div style={{ width: '16px', height: '2px', background: 'white', margin: '4px 0', marginLeft: 'auto' }}></div>
        </div>

        {/* Studio Command Center (Dropdown) */}
        {mobileMenuOpen && (
          <div className="dropdown-menu" style={{ 
            position: 'absolute', 
            top: '90px', 
            right: '15px',
            animation: 'fadeInDown 0.2s ease-out'
          }}>
            <NavLink to="/" end onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              Dashboard
            </NavLink>
            <NavLink to="/transactions" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              Transaction Ledger
            </NavLink>
            <NavLink to="/mileage" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              🚗 Mileage Log
            </NavLink>
            <NavLink to="/import" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              📥 Bank Import
            </NavLink>
            <NavLink to="/crm" end onClick={() => { setMobileMenuOpen(false); clearBadge(); }} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              🤝 CRM Pipeline {newLeadCount > 0 && <span style={{ background: '#ef4444', color: 'white', borderRadius: '50%', fontSize: '9px', fontWeight: 900, padding: '1px 5px', marginLeft: '6px' }}>{newLeadCount > 9 ? '9+' : newLeadCount}</span>}
            </NavLink>
            <NavLink to="/crm/financials" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              🧾 Business Invoicing
            </NavLink>
            <NavLink to="/tax" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              ⚖️ Tax Data / Sch C
            </NavLink>
            <NavLink to="/equipment" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              📸 Camera Gear
            </NavLink>

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '16px 12px' }} />
            
            <NavLink 
                to="/StudioControlCenter?tab=profile" 
                onClick={() => setMobileMenuOpen(false)} 
                className={() => `dropdown-item ${location.pathname === '/StudioControlCenter' && location.search.includes('tab=profile') ? 'active' : ''}`}
            >
              👤 Business Profile
            </NavLink>

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '16px 12px' }} />

            <NavLink 
                to="/StudioControlCenter" 
                end 
                onClick={() => setMobileMenuOpen(false)} 
                className={({ isActive }) => `dropdown-item ${isActive && !location.search ? 'active' : ''}`}
            >
               ⚙️ Ledger Control Center
            </NavLink>
            <NavLink to="/addons" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              🧩 Add-Ons
            </NavLink>
            <NavLink
                to="/StudioControlCenter?tab=help"
                onClick={() => setMobileMenuOpen(false)}
                className={() => `dropdown-item ${location.pathname === '/StudioControlCenter' && location.search.includes('tab=help') ? 'active' : ''}`}
            >
               ❓ Ledger Documentation & FAQ
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
