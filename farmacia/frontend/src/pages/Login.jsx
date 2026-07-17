import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
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
            <Logo size={56} />
            <div className="login-muni-text">
              <span className="login-muni-name">Municipalidad de Cosquín</span>
              <span className="login-muni-dept">Hospital Cima</span>
            </div>
          </div>
          <div className="login-divider" />
          <h1 className="login-logo-title">Farmacia Hospital Cima</h1>
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
