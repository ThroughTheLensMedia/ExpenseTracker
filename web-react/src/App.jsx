import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthContext';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Tax from './pages/Tax';
import Backup from './pages/Backup';
import Assets from './pages/Assets';
import CRM from './pages/CRM';
import Import from './pages/Import';
import Login from './pages/Login';
import Mileage from './pages/Mileage';


// Higher Order Component to protect routes
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ marginBottom: '20px' }}></div>
          <div style={{ fontWeight: 800, letterSpacing: '0.1em', fontSize: '12px', opacity: 0.5 }}>INITIALIZING STUDIO...</div>
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
  const [apiStatus, setApiStatus] = useState('Checking...');
  const { user, loading, logout, subscription, settings } = useAuth();
  const [showRedeem, setShowRedeem] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef(null);

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
    const interval = setInterval(checkApi, 15000);
    return () => clearInterval(interval);
  }, [user]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ marginBottom: '20px' }}></div>
          <div style={{ fontWeight: 800, letterSpacing: '0.1em', fontSize: '12px', opacity: 0.5 }}>SYNCHRONIZING STUDIO...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  return (
    <div className="wrap">
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
            ? 'STUDIO ACCESS EXPIRED — UPDATES DISABLED' 
            : `STUDIO ACCESS EXPIRES IN ${daysLeft} DAYS`}
          <button 
            onClick={() => window.location.hash = '#redeem'} 
            style={{ marginLeft: '15px', padding: '2px 8px', background: 'white', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}
          >
            EXTEND ACCESS
          </button>
        </div>
      )}      <header ref={menuRef} className="card glass" style={{ border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 30px', position: 'sticky', top: '15px', zIndex: 1000, margin: '15px auto', maxWidth: '1400px', cursor: 'default' }}>
        {/* Left Side: Brand */}
        <div style={{ flex: '1', display: 'flex', alignItems: 'center' }}>
          <div className="title" style={{ fontSize: '1.2rem', fontWeight: 950, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>STUDIO TRACKER</div>
        </div>

        {/* Right Side: Toggle */}
        <div className="mobile-toggle" style={{ cursor: 'pointer', padding: '10px' }} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          <div style={{ width: '22px', height: '2px', background: 'white', margin: '4px 0' }}></div>
          <div style={{ width: '22px', height: '2px', background: 'white', margin: '4px 0' }}></div>
          <div style={{ width: '16px', height: '2px', background: 'white', margin: '4px 0', marginLeft: 'auto' }}></div>
        </div>

        {/* Elite Command Center (Dropdown) */}
        {mobileMenuOpen && (
          <div className="dropdown-menu" style={{ 
            position: 'absolute', 
            top: '90px', 
            right: '15px',
            animation: 'fadeInDown 0.2s ease-out'
          }}>
            <NavLink to="/" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`} end>
              Dashboard
            </NavLink>
            <NavLink to="/transactions" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              Transaction Ledger
            </NavLink>
            <NavLink to="/import" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              Bank Import
            </NavLink>
            <NavLink to="/crm" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              CRM Pipeline
            </NavLink>
            <NavLink to="/crm/invoices" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              Studio Invoices
            </NavLink>
            <NavLink to="/tax" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              Tax Data / Sch C
            </NavLink>
            <NavLink to="/equipment" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              Camera Gear
            </NavLink>
            <NavLink to="/mileage" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              Mileage Log
            </NavLink>
            <NavLink to="/StudioControlCenter" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}>
              Studio Control Center
            </NavLink>
            
            <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px', paddingBottom: '4px' }}>
                <div style={{ padding: '0 12px 16px 12px' }}>
                  <div className="muted" style={{ fontWeight: 950, fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.05em' }}>Studio Session</div>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: 'white' }}>{identityName}</div>
                  {identityTitle && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>{identityTitle}</div>}
                  <div style={{ fontSize: '10px', color: daysLeft <= 7 ? '#f59e0b' : '#10b981', fontWeight: 900, marginTop: '4px' }}>
                    PRO ACCESS • {daysLeft}D LEFT
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

      <main style={{ marginTop: '16px', minHeight: 'calc(100vh - 160px)' }}>
        <Routes>
          <Route path="/" element={<Dashboard apiStatus={apiStatus} />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/tax" element={<Tax />} />
          <Route path="/mileage" element={<Mileage />} />
          <Route path="/equipment" element={<Assets />} />
          <Route path="/StudioControlCenter" element={<Backup />} />
          <Route path="/backup" element={<Navigate to="/StudioControlCenter" replace />} />
           <Route path="/crm/*" element={<CRM />} />
           <Route path="/import" element={<Import />} />
           <Route path="*" element={<Navigate to="/" />} />
        </Routes>
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
        <NavLink to="/crm" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <span className="bottom-nav-icon">👥</span>
          <span>Leads</span>
        </NavLink>
      </nav>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
