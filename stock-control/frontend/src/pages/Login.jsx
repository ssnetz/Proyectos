import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function CosquinShield({ size = 56 }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 80 92" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4 H76 V58 Q40 90 40 90 Q40 90 4 58 Z" fill="#1a3a6b" stroke="#c8a93e" strokeWidth="3"/>
      <path d="M6 6 H74 V34 H6 Z" fill="#2563eb"/>
      <circle cx="40" cy="18" r="7" fill="#fbbf24"/>
      <line x1="40" y1="8"  x2="40" y2="5"  stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"/>
      <line x1="40" y1="28" x2="40" y2="31" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"/>
      <line x1="30" y1="18" x2="27" y2="18" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"/>
      <line x1="50" y1="18" x2="53" y2="18" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"/>
      <line x1="33" y1="11" x2="31" y2="9"  stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"/>
      <line x1="47" y1="25" x2="49" y2="27" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"/>
      <line x1="47" y1="11" x2="49" y2="9"  stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"/>
      <line x1="33" y1="25" x2="31" y2="27" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"/>
      <line x1="6" y1="34" x2="74" y2="34" stroke="#c8a93e" strokeWidth="1.5"/>
      <path d="M6 56 L20 36 L32 50 L44 34 L56 50 L68 36 L74 46 L74 56 Z" fill="#16a34a"/>
      <path d="M6 56 L20 42 L32 52 L44 40 L56 52 L68 42 L74 48 L74 56 Z" fill="#15803d"/>
      <line x1="6" y1="56" x2="74" y2="56" stroke="#c8a93e" strokeWidth="1.5"/>
      <path d="M6 56 Q40 56 74 56 L74 68 Q40 68 6 68 Z" fill="#1d4ed8"/>
      <path d="M6 60 Q16 57 26 60 Q36 63 46 60 Q56 57 66 60 Q72 62 74 60" stroke="#60a5fa" strokeWidth="1.5" fill="none"/>
      <path d="M6 64 Q16 61 26 64 Q36 67 46 64 Q56 61 66 64 Q72 66 74 64" stroke="#93c5fd" strokeWidth="1.2" fill="none"/>
      <path d="M6 68 Q40 90 74 68" fill="#c8262c"/>
      <path d="M4 4 H76 V58 Q40 90 40 90 Q40 90 4 58 Z" fill="none" stroke="#c8a93e" strokeWidth="3"/>
    </svg>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [form, setForm]     = useState({ username: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.username || !form.password) {
      setError('Ingresa usuario y contraseña');
      return;
    }
    setLoading(true);
    try {
      await login(form.username, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-muni-header">
            <CosquinShield size={56} />
            <div className="login-muni-text">
              <span className="login-muni-name">Municipalidad de Cosquín</span>
              <span className="login-muni-dept">Secretaría de Salud</span>
            </div>
          </div>
          <div className="login-divider" />
          <h1 className="login-logo-title">Farmacia Municipal</h1>
          <p className="login-logo-subtitle">Sistema de control de stock</p>
        </div>

        <form onSubmit={handleSubmit} autoComplete="on">
          {error && (
            <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>
          )}
          <div className="form-group">
            <label className="form-label" htmlFor="login-username">Usuario</label>
            <input
              id="login-username"
              className="form-control"
              type="text"
              autoComplete="username"
              placeholder="Ingresa tu usuario"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Contraseña</label>
            <input
              id="login-password"
              className="form-control"
              type="password"
              autoComplete="current-password"
              placeholder="Ingresa tu contraseña"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '10px 14px' }}
            disabled={loading}
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
