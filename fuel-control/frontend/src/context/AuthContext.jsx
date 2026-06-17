import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('fuel_token');
    const saved = localStorage.getItem('fuel_user');
    if (token && saved) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(JSON.parse(saved));
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const res = await axios.post('/fuel-control/backend/api/auth.php', { username, password });
    const { token, user: u } = res.data;
    localStorage.setItem('fuel_token', token);
    localStorage.setItem('fuel_user', JSON.stringify(u));
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem('fuel_token');
    localStorage.removeItem('fuel_user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
