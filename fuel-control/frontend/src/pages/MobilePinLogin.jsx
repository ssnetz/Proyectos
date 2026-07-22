import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = '/fuel-control/backend/api';

export default function MobilePinLogin() {
  const navigate = useNavigate();
  const [pin, setPin]         = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pin.trim()) return;
    setLoading(true);
    setError('');
    try {
      const r = await axios.post(`${API}/auth.php?action=mobile_login`, { pin: pin.trim() });
      localStorage.setItem('fuel_mobile_token', r.data.token);
      localStorage.setItem('fuel_mobile_user', JSON.stringify(r.data.user));
      navigate('/movil/carga');
    } catch (err) {
      setError(err.response?.data?.error || 'PIN inválido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-logo">
          <img src="/fuel-control/logo.png" alt="Octano — Sistema de Control de Combustible" />
        </div>
        <h1 className="login-subtitle">📷 Carga con Foto</h1>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-group">
          <label className="form-label">PIN de acceso</label>
          <input
            className="form-input"
            type="tel"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            placeholder="000000"
            style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: 4 }}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          />
        </div>
        <button className="btn btn-primary btn-full" type="submit" disabled={loading || pin.length === 0}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
