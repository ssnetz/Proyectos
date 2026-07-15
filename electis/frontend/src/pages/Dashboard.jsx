import { useState, useEffect } from 'react';
import { useDashboard } from '../hooks/useApi';

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

  const { stats, escrutinio_por_cargo, mesas_sin_acta } = data;

  const cargos = [];
  for (const row of escrutinio_por_cargo) {
    let cargo = cargos.find((c) => c.id === row.id);
    if (!cargo) { cargo = { id: row.id, nombre: row.nombre, listas: [] }; cargos.push(cargo); }
    cargo.listas.push(row);
  }

  const porcentajeActas = stats.total_mesas > 0
    ? Math.round((stats.actas_cargadas / stats.total_mesas) * 100)
    : 0;

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">🗳️</div>
          <div>
            <div className="stat-value">{stats.total_mesas}</div>
            <div className="stat-label">Mesas</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">✅</div>
          <div>
            <div className="stat-value">{stats.actas_cargadas} / {stats.total_mesas}</div>
            <div className="stat-label">Actas cargadas ({porcentajeActas}%)</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow">👥</div>
          <div>
            <div className="stat-value">{stats.total_electores.toLocaleString('es-AR')}</div>
            <div className="stat-label">Electores en el padrón</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue">🎖️</div>
          <div>
            <div className="stat-value">{stats.total_fiscales}</div>
            <div className="stat-label">Fiscales</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">📋</div>
          <div>
            <div className="stat-value">{stats.total_listas}</div>
            <div className="stat-label">Listas</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow">🏫</div>
          <div>
            <div className="stat-value">{stats.total_establecimientos}</div>
            <div className="stat-label">Establecimientos</div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Escrutinio por cargo</span>
          </div>
          {cargos.length === 0 ? (
            <div className="empty"><div className="empty-icon">📋</div><p>Todavía no hay listas cargadas</p></div>
          ) : (
            cargos.map((cargo) => {
              const totalVotos = cargo.listas.reduce((sum, l) => sum + Number(l.votos), 0);
              return (
                <div key={cargo.id} style={{ marginBottom: 20 }}>
                  <div style={{ fontWeight: 600, fontSize: '.875rem', marginBottom: 8 }}>{cargo.nombre}</div>
                  {cargo.listas.map((l) => {
                    const pct = totalVotos > 0 ? Math.round((l.votos / totalVotos) * 100) : 0;
                    return (
                      <div key={l.lista_id} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.8rem', marginBottom: 3 }}>
                          <span>Lista {l.numero} — {l.partido_nombre}</span>
                          <span style={{ color: 'var(--gray-500)' }}>{l.votos} ({pct}%)</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--gray-200)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: l.partido_color || 'var(--primary)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Mesas sin acta cargada</span>
          </div>
          {mesas_sin_acta.length === 0 ? (
            <div className="empty"><div className="empty-icon">✅</div><p>Todas las mesas tienen acta cargada</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Mesa</th><th>Establecimiento</th></tr>
                </thead>
                <tbody>
                  {mesas_sin_acta.map((m) => (
                    <tr key={m.id}>
                      <td><span className="badge badge-yellow">{m.numero}</span></td>
                      <td>{m.establecimiento_nombre}</td>
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
