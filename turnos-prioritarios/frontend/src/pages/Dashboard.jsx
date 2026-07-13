import { useState, useEffect } from 'react';
import { useDashboard } from '../hooks/useApi';

const prioridadBadge = { alta: 'badge-red', media: 'badge-yellow', baja: 'badge-gray' };
const estadoBadge = { pendiente: 'badge-yellow', confirmado: 'badge-blue', atendido: 'badge-green', cancelado: 'badge-red' };

export default function Dashboard() {
  const { get } = useDashboard();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    get()
      .then((r) => setData(r.data))
      .catch(() => setError('No se pudo cargar el dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner" />;
  if (error) return <div className="alert alert-danger">{error}</div>;

  const { stats, agenda_hoy, proximos_turnos } = data;

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">📅</div>
          <div>
            <div className="stat-value">{stats.turnos_hoy}</div>
            <div className="stat-label">Turnos hoy</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow">⏳</div>
          <div>
            <div className="stat-value">{stats.turnos_pendientes}</div>
            <div className="stat-label">Turnos pendientes</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">🩺</div>
          <div>
            <div className="stat-value">{stats.total_profesionales}</div>
            <div className="stat-label">Profesionales activos</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue">🏥</div>
          <div>
            <div className="stat-value">{stats.total_instituciones}</div>
            <div className="stat-label">Instituciones</div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Agenda de hoy</span>
          </div>
          {agenda_hoy.length === 0 ? (
            <div className="empty"><div className="empty-icon">📅</div><p>Sin turnos para hoy</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Hora</th><th>Persona</th><th>Profesional</th><th>Prioridad</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {agenda_hoy.map((t) => (
                    <tr key={t.id}>
                      <td>{t.hora?.slice(0, 5)}</td>
                      <td>{t.persona_apellidos ? `${t.persona_apellidos}, ${t.persona_nombres}` : '—'}</td>
                      <td>{t.profesional_apellidos}, {t.profesional_nombres}</td>
                      <td><span className={`badge ${prioridadBadge[t.prioridad]}`}>{t.prioridad}</span></td>
                      <td><span className={`badge ${estadoBadge[t.estado]}`}>{t.estado}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Próximos 7 días</span>
          </div>
          {proximos_turnos.length === 0 ? (
            <div className="empty"><div className="empty-icon">📊</div><p>Sin turnos programados</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Día</th><th>Turnos</th></tr>
                </thead>
                <tbody>
                  {proximos_turnos.map((d, i) => (
                    <tr key={i}>
                      <td>{new Date(d.dia).toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: '2-digit' })}</td>
                      <td><span className="badge badge-blue">{d.cantidad}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
