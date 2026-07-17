import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_BASE = '/farmacia/api';

// Auth basada en sesión PHP (cookie httponly), no en JWT: no hay token que
// guardar en localStorage. Cada request lleva la cookie de sesión gracias a
// withCredentials, y el servidor decide quién está logueado vía $_SESSION.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Al montar, le preguntamos al backend si ya hay una sesión activa.
  useEffect(() => {
    axios
      .get(`${API_BASE}/auth.php?action=me`, { withCredentials: true })
      .then((r) => setUser(r.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // Si cualquier request de la app recibe un 401 (sesión vencida/inválida),
  // useApi.js dispara este evento para que la app entera se desloguee.
  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
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
      await axios.post(`${API_BASE}/auth.php?action=logout`, {}, { withCredentials: true });
    } catch (_) {
      // ignore errors — always log out on client side
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
