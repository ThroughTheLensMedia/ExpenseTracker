import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Tax from './pages/Tax';
import Backup from './pages/Backup';
import Invoice from './pages/Invoice';

import Rules from './pages/Rules';

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
          console.error(`API Health Check Failed: ${r.status} ${r.statusText}`);
          setApiStatus('API: Down');
          setIsHealthy(false);
        }
      } catch (err) {
        console.error('API Health Check Exception:', err);
        setApiStatus('API: Down');
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
        <header>
          <div className="title">Expense Tracker</div>
          <div className="nav">
            <NavLink to="/" className={({ isActive }) => `pill ${isActive ? 'active' : ''}`} end>Dashboard</NavLink>
            <NavLink to="/transactions" className={({ isActive }) => `pill ${isActive ? 'active' : ''}`}>Transactions</NavLink>
            <NavLink to="/tax" className={({ isActive }) => `pill ${isActive ? 'active' : ''}`}>Tax</NavLink>
            <NavLink to="/rules" className={({ isActive }) => `pill ${isActive ? 'active' : ''}`}>Rules</NavLink>
            <NavLink to="/backup" className={({ isActive }) => `pill ${isActive ? 'active' : ''}`}>Backup</NavLink>
            <NavLink to="/invoice" className={({ isActive }) => `pill ${isActive ? 'active' : ''}`}>Invoice</NavLink>
          </div>
        </header>

        <main style={{ marginTop: '16px', minHeight: 'calc(100vh - 160px)' }}>
          <Routes>
            <Route path="/" element={<Dashboard apiStatus={apiStatus} />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/tax" element={<Tax />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/backup" element={<Backup />} />
            <Route path="/invoice" element={<Invoice />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>

        <footer>
          <div>v2.0.0-react</div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            API Status
            <span className={`health-dot ${isHealthy ? 'health-ok' : 'health-bad'}`}></span>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
