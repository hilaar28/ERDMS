import React, { useState, useEffect, useCallback } from 'react';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import { clearTokens, getToken } from './utils/auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/documents';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleLogout = useCallback(() => {
    const token = getToken();
    if (token) {
      fetch(`${API_URL.replace('/documents', '/auth')}/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => {});
    }
    clearTokens();
    setIsAuthenticated(false);
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  useEffect(() => {
    const token = getToken();
    if (token) {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isAuthenticated) {
        const token = getToken();
        if (token) {
          navigator.sendBeacon(
            `${API_URL.replace('/documents', '/auth')}/logout`,
            new Blob([JSON.stringify({})], { type: 'application/json' })
          );
          const headers = new Headers();
          headers.append('Authorization', `Bearer ${token}`);
          navigator.sendBeacon(
            `${API_URL.replace('/documents', '/auth')}/logout`,
            new Blob([], { type: 'application/json' })
          );
        }
        clearTokens();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleLogout();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, handleLogout]);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <LoginPage API_URL={API_URL} onLoginSuccess={handleLoginSuccess} />;
  }

  return <Dashboard onLogout={handleLogout} />;
};

export default App;
