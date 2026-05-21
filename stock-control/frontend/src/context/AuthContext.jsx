import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_BASE = '/stock-control/api';

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, check if we have an active PHP session
  useEffect(() => {
    axios
      .get(`${API_BASE}/auth.php?action=me`, { withCredentials: true })
      .then((r) => setUser(r.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // Listen for 401 events dispatched by the api interceptor
  useEffect(() => {
    const handle = () => setUser(null);
    window.addEventListener('auth:logout', handle);
    return () => window.removeEventListener('auth:logout', handle);
  }, []);

  const login = useCallback(async (username, password) => {
    const r = await axios.post(
      `${API_BASE}/auth.php?action=login`,
      { username, password },
      { withCredentials: true }
    );
    setUser(r.data.user);
    return r.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await axios.post(
        `${API_BASE}/auth.php?action=logout`,
        {},
        { withCredentials: true }
      );
    } catch (_) {
      // ignore errors — always log out client-side
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
