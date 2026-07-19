import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './FiscalLogin.css';

const API_BASE = '/electis/api';

export default function FiscalLogin() {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (pin.trim() === '') return;
    setLoading(true);
    setError('');
    try {
      const r = await axios.post(`${API_BASE}/auth.php?action=fiscal_login`, { pin: pin.trim() });
      localStorage.setItem('el_fiscal_token', r.data.token);
      localStorage.setItem('el_fiscal_mesa', JSON.stringify(r.data.mesa));
      navigate('/fiscal/votacion');
    } catch (err) {
      setError(err.response?.data?.error || 'PIN inválido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fiscal-login-page">
      <form className="fiscal-login-card" onSubmit={handleSubmit}>
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Electis" className="fiscal-login-logo" />
        <h1>Ingreso del fiscal</h1>
        <p>Ingresá el PIN de 6 dígitos de tu mesa</p>
        {error && <div className="alert alert-danger">{error}</div>}
        <input
          className="fiscal-pin-input"
          type="tel"
          inputMode="numeric"
          maxLength={6}
          autoFocus
          placeholder="000000"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        />
        <button className="btn btn-primary fiscal-login-btn" type="submit" disabled={loading || pin.length === 0}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
