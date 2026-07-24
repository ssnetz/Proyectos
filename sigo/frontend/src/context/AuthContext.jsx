import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem('sigo_token');
    localStorage.removeItem('sigo_user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  // El token expira a las 8hs (JWT_EXPIRY). Si al volver a entrar con una
  // sesión vieja el servidor responde 401 (token vencido), sin esto la
  // pantalla se queda esperando para siempre en vez de volver al login.
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      r => r,
      err => {
        if (err.response?.status === 401) {
          logout();
          navigate('/login');
        }
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  useEffect(() => {
    const token = localStorage.getItem('sigo_token');
    const saved = localStorage.getItem('sigo_user');
    if (token && saved) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(JSON.parse(saved));
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const res = await axios.post('/sigo/api/auth.php', { username, password });
    const { token, user: u } = res.data;
    localStorage.setItem('sigo_token', token);
    localStorage.setItem('sigo_user', JSON.stringify(u));
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(u);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
