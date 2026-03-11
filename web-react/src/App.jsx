import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Tax from './pages/Tax';
import Backup from './pages/Backup';
import Assets from './pages/Assets';
import CRM from './pages/CRM';
import Import from './pages/Import';

function App() {
  const [apiStatus, setApiStatus] = useState('Checking...');
  const [isHealthy, setIsHealthy] = useState(false);

  useEffect(() => {
    const checkApi = async () => {
      try {
        const r = await fetch('/api/health', { credentials: 'include' });
        if (r.ok) {
          setApiStatus('API: OK');
          setIsHealthy(true);
        } else {
          let errorMsg = `${r.status} ${r.statusText}`;
          try {
            const body = await r.json();
            if (body && body.error) {
              errorMsg = `API: ${body.error}`;
            }
          } catch (e) {
            // If r.json() fails, we stick with the statusText
          }

          console.error(`API Health Check Failed: ${errorMsg}`);
          setApiStatus(errorMsg);
          setIsHealthy(false);
        }
      } catch (err) {
        console.error('API Health Check Exception:', err);
        setApiStatus(`API: Connection Error`);
        setIsHealthy(false);
      }
    };

    checkApi();
    const interval = setInterval(checkApi, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Router>
      <div className="wrap">
        <header className="glass desktop-only" style={{ border: 'none' }}>
          <div className="title">Expense Tracker</div>
          <div className="nav">
            <NavLink to="/" className={({ isActive }) => `pill ${isActive ? 'active' : ''}`} end>Dashboard</NavLink>
            <NavLink to="/transactions" className={({ isActive }) => `pill ${isActive ? 'active' : ''}`}>Transactions</NavLink>
            <NavLink to="/tax" className={({ isActive }) => `pill ${isActive ? 'active' : ''}`}>Tax</NavLink>
            <NavLink to="/equipment" className={({ isActive }) => `pill ${isActive ? 'active' : ''}`}>Equipment</NavLink>
            <NavLink to="/crm" className={({ isActive }) => `pill ${isActive ? 'active' : ''}`}>CRM</NavLink>
            <NavLink to="/import" className={({ isActive }) => `pill ${isActive ? 'active' : ''}`}>Bank Import</NavLink>
            <NavLink to="/backup" className={({ isActive }) => `pill ${isActive ? 'active' : ''}`}>Studio Control Center</NavLink>
          </div>
        </header>

        {/* Mobile Minimal Header */}
        <header className="glass mobile-only" style={{ border: 'none', justifyContent: 'center' }}>
          <div className="title">ThroughTheLens PWA</div>
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
          <NavLink to="/crm" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <span className="bottom-nav-icon">👥</span>
            <span>CRM</span>
          </NavLink>
        </nav>
      </div>
    </Router>
  );
}

export default App;
