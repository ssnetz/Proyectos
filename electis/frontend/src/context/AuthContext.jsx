import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_BASE = '/electis/api';

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const [token, setToken]   = useState(() => localStorage.getItem('el_token'));
  const [loading, setLoading] = useState(true);

  // Validate token on startup
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    axios
      .get(`${API_BASE}/auth.php?action=me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r) => setUser(r.data))
      .catch(() => {
        // Token invalid or expired — clean up
        localStorage.removeItem('el_token');
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []); // only on mount

  const login = useCallback(async (username, password) => {
    const r = await axios.post(`${API_BASE}/auth.php?action=login`, {
      username,
      password,
    });
    const { token: newToken, user: newUser } = r.data;
    localStorage.setItem('el_token', newToken);
    setToken(newToken);
    setUser(newUser);
    return newUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await axios.post(
        `${API_BASE}/auth.php?action=logout`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (_) {
      // ignore errors — always log out on client side
    }
    localStorage.removeItem('el_token');
    setToken(null);
    setUser(null);
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
