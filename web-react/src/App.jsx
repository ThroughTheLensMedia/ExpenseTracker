import React, { useState, useEffect } from 'react';
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

  // Calculate days left
  const daysLeft = subscription?.expires_at 
    ? Math.ceil((new Date(subscription.expires_at) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  // Use business name or email as identity
  const identityName = settings?.business_name || settings?.contact_name || user?.email;

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
      )}

      <header className="glass desktop-only" style={{ border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 30px', height: '80px' }}>
        {/* Left Side: Brand */}
        <div style={{ flex: '1', display: 'flex', alignItems: 'center', minWidth: '200px' }}>
          <div className="title" style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>Studio Tracker</div>
        </div>

        {/* Center: Primary Navigation */}
        <div style={{ flex: '2', display: 'flex', justifyContent: 'center', minWidth: '0' }}>
          <div className="nav" style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '5px', borderRadius: '12px', whiteSpace: 'nowrap' }}>
            <NavLink to="/" className={({ isActive }) => `pill ${isActive ? 'active' : ''}`} style={{ padding: '8px 12px', fontSize: '12px' }} end>Dashboard</NavLink>
            <NavLink to="/transactions" className={({ isActive }) => `pill ${isActive ? 'active' : ''}`} style={{ padding: '8px 12px', fontSize: '12px' }}>Transactions</NavLink>
            <NavLink to="/tax" className={({ isActive }) => `pill ${isActive ? 'active' : ''}`} style={{ padding: '8px 12px', fontSize: '12px' }}>Tax</NavLink>
            <NavLink to="/equipment" className={({ isActive }) => `pill ${isActive ? 'active' : ''}`} style={{ padding: '8px 12px', fontSize: '12px' }}>Equipment</NavLink>
            <NavLink to="/crm" className={({ isActive }) => `pill ${isActive ? 'active' : ''}`} style={{ padding: '8px 12px', fontSize: '12px' }}>CRM</NavLink>
            <NavLink to="/backup" className={({ isActive }) => `pill ${isActive ? 'active' : ''}`} style={{ padding: '8px 12px', fontSize: '12px' }}>SCC Console</NavLink>
          </div>
        </div>

        {/* Right Side: Identity & Actions */}
        <div style={{ flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '15px', minWidth: '240px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: '1.2' }}>
              <span className="muted" style={{ fontWeight: 950, fontSize: '11px', color: 'white', whiteSpace: 'nowrap' }}>{identityName}</span>
              <span style={{ fontSize: '9px', color: daysLeft <= 7 ? '#f59e0b' : '#10b981', fontWeight: 800, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                {subscription?.plan_type?.toUpperCase() || 'PRO'} ACCESS 
                {daysLeft !== null && ` • ${daysLeft}D LEFT`}
              </span>
            </div>
            <button onClick={logout} className="btn sm secondary" style={{ fontSize: '10px', padding: '6px 12px', borderRadius: '8px', fontWeight: 900 }}>LOGOUT</button>
        </div>
      </header>

      {/* Mobile Minimal Header */}
      <header className="glass mobile-only" style={{ border: 'none', justifyContent: 'space-between', padding: '0 20px' }}>
        <div className="title">ThroughTheLens</div>
        <button onClick={logout} style={{ background: 'none', border: 'none', fontSize: '18px' }}>📤</button>
      </header>

      <main style={{ marginTop: '16px', minHeight: 'calc(100vh - 160px)' }}>
        <Routes>
          <Route path="/" element={<Dashboard apiStatus={apiStatus} />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/tax" element={<Tax />} />
          <Route path="/equipment" element={<Assets />} />
          <Route path="/backup" element={<Backup />} />
           <Route path="/crm/*" element={<CRM />} />
           <Route path="/import" element={<Import />} />
           <Route path="*" element={<Navigate to="/" />} />


        </Routes>
      </main>

      {/* PWA Bottom Navigation Bar */}
      <nav className="bottom-nav mobile-only">
        <NavLink to="/" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`} end>
          <span className="bottom-nav-icon">📊</span>
          <span>Home</span>
        </NavLink>
        <NavLink to="/transactions" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <span className="bottom-nav-icon">💸</span>
          <span>Ledger</span>
        </NavLink>
        <NavLink to="/import" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <span className="bottom-nav-icon">🏦</span>
          <span>Import</span>
        </NavLink>
        <NavLink to="/crm" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`} end>
          <span className="bottom-nav-icon">👥</span>
          <span>CRM</span>
        </NavLink>
        <NavLink to="/crm/invoices" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <span className="bottom-nav-icon">🧾</span>
          <span>Invoices</span>
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
