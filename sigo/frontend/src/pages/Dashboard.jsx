import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/sigo/api/dashboard.php')
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: 6 }}>👋 Bienvenido, {user?.username}</h2>
        <p style={{ color: 'var(--gray-500)', fontSize: '.9rem' }}>
          El módulo de Obras todavía se está configurando. Por ahora el sistema tiene el login,
          la gestión de usuarios y esta pantalla de inicio funcionando.
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👤</div>
          <div>
            <div className="stat-value">{data?.usuarios_activos ?? '—'}</div>
            <div className="stat-label">Usuarios activos</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🏗️</div>
          <div>
            <div className="stat-value">—</div>
            <div className="stat-label">Obras (próximamente)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
