import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import VotacionGrilla from '../components/VotacionGrilla';
import './FiscalLogin.css';

const API_BASE = '/electis/api';

function fiscalApi() {
  const token = localStorage.getItem('el_fiscal_token');
  return axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${token}` } });
}

export default function FiscalVotacion() {
  const navigate = useNavigate();
  const [mesa, setMesa] = useState(() => {
    try { return JSON.parse(localStorage.getItem('el_fiscal_mesa') || 'null'); } catch { return null; }
  });
  const [electores, setElectores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const salir = useCallback(() => {
    localStorage.removeItem('el_fiscal_token');
    localStorage.removeItem('el_fiscal_mesa');
    navigate('/fiscal');
  }, [navigate]);

  useEffect(() => {
    if (!localStorage.getItem('el_fiscal_token')) { navigate('/fiscal'); return; }
    const api = fiscalApi();
    setLoading(true);
    Promise.all([
      api.get('/auth.php?action=fiscal_me'),
      api.get('/electores.php'),
    ])
      .then(([meRes, electoresRes]) => {
        setMesa(meRes.data.mesa);
        localStorage.setItem('el_fiscal_mesa', JSON.stringify(meRes.data.mesa));
        setElectores(electoresRes.data.data);
      })
      .catch((err) => {
        if (err.response?.status === 401 || err.response?.status === 403) { salir(); return; }
        setError('Error cargando la mesa');
      })
      .finally(() => setLoading(false));
  }, [navigate, salir]);

  const toggleVoto = async (elector) => {
    const habilitado = elector.habilitado === undefined ? true : !!Number(elector.habilitado);
    if (!habilitado) return;

    const nuevoVotado = Number(elector.votado) ? 0 : 1;
    setElectores((prev) => prev.map((e) => (e.id === elector.id ? { ...e, votado: nuevoVotado } : e)));
    try {
      await fiscalApi().put(`/electores.php?id=${elector.id}`, { votado: nuevoVotado });
    } catch (err) {
      setElectores((prev) => prev.map((e) => (e.id === elector.id ? { ...e, votado: elector.votado } : e)));
      setError(err.response?.data?.error || 'Error al actualizar el voto');
    }
  };

  return (
    <div className="fiscal-votacion-page">
      <header className="fiscal-votacion-header">
        <div>
          <strong>Mesa {mesa?.numero}</strong>
          <div className="fiscal-votacion-establecimiento">{mesa?.establecimiento_nombre}</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={salir}>Salir</button>
      </header>

      <div className="fiscal-votacion-body">
        {error && <div className="alert alert-danger">{error}</div>}
        {loading ? <div className="spinner" style={{ marginTop: 40 }} /> : (
          <VotacionGrilla electores={electores} onToggle={toggleVoto} />
        )}
      </div>
    </div>
  );
}
