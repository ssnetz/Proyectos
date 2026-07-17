import { useState, useEffect } from 'react';
import { ResponsiveContainer, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Bar } from 'recharts';
import { useDashboard } from '../hooks/useApi';

const fmtCurrency = (v) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v);

const vencimientoBadge = (daysLeft) => {
  const n = Number(daysLeft);
  if (n < 0) return <span className="badge badge-red">VENCIDO</span>;
  if (n <= 7) return <span className="badge badge-red">CRÍTICO</span>;
  return <span className="badge badge-yellow">PRÓXIMO</span>;
};

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
  if (!data || !data.stats) return <div className="alert alert-danger">Error: respuesta inesperada del servidor.</div>;

  const { stats, low_stock_products: lowStock, recent_movements: recentMovements, movements_by_day: movementsByDay, expiring_soon: expiringSoon } = data;

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">💊</div>
          <div>
            <div className="stat-value">{stats.total_products}</div>
            <div className="stat-label">Medicamentos activos</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red">⚠️</div>
          <div>
            <div className="stat-value" style={{ color: stats.low_stock_count > 0 ? 'var(--warning)' : 'inherit' }}>{stats.low_stock_count}</div>
            <div className="stat-label">Stock bajo</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow">🚫</div>
          <div>
            <div className="stat-value" style={{ color: stats.out_of_stock > 0 ? 'var(--danger)' : 'inherit' }}>{stats.out_of_stock}</div>
            <div className="stat-label">Sin stock</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">💰</div>
          <div>
            <div className="stat-value" style={{ fontSize: '1.2rem' }}>{fmtCurrency(stats.stock_value)}</div>
            <div className="stat-label">Valor del stock</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue">🏭</div>
          <div>
            <div className="stat-value">{stats.total_suppliers}</div>
            <div className="stat-label">Proveedores</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow">⏰</div>
          <div>
            <div className="stat-value" style={{ color: stats.expiring_count > 0 ? 'var(--warning)' : 'inherit' }}>{stats.expiring_count ?? 0}</div>
            <div className="stat-label">Vencen en 30 días</div>
          </div>
        </div>
        {(stats.expired_count ?? 0) > 0 && (
          <div className="stat-card">
            <div className="stat-icon red">💀</div>
            <div>
              <div className="stat-value" style={{ color: 'var(--danger)' }}>{stats.expired_count}</div>
              <div className="stat-label">Lotes vencidos</div>
            </div>
          </div>
        )}
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Movimientos últimos 7 días</span>
          </div>
          {!movementsByDay || movementsByDay.length === 0 ? (
            <div className="empty"><div className="empty-icon">📊</div><p>Sin datos aún</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={movementsByDay} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <CartesianGrid />
                <Tooltip />
                <Bar dataKey="entradas" fill="#16a34a" name="Entradas" radius={[3, 3, 0, 0]} />
                <Bar dataKey="salidas" fill="#dc2626" name="Salidas" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Últimos movimientos</span>
          </div>
          {!recentMovements || recentMovements.length === 0 ? (
            <div className="empty"><div className="empty-icon">📋</div><p>Sin movimientos</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Medicamento</th><th>Tipo</th><th>Cant.</th><th>Fecha</th></tr>
                </thead>
                <tbody>
                  {recentMovements.map((m, i) => (
                    <tr key={i}>
                      <td>{m.product_name}</td>
                      <td>
                        <span className={m.type === 'entrada' ? 'mov-entrada' : m.type === 'salida' ? 'mov-salida' : 'mov-ajuste'}>{m.type}</span>
                      </td>
                      <td>{m.quantity}</td>
                      <td style={{ color: 'var(--gray-400)', fontSize: '.8rem' }}>{new Date(m.created_at).toLocaleDateString('es-AR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {expiringSoon && expiringSoon.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">⏰ Vencimientos próximos (≤ 30 días)</span>
            <span className="badge badge-yellow">{expiringSoon.length} lotes</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Medicamento</th><th>N° Lote</th><th>Vencimiento</th><th>Cantidad</th><th>Días</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {expiringSoon.map((m) => (
                  <tr key={m.id}>
                    <td><strong>{m.product_name}</strong></td>
                    <td><code style={{ fontSize: '.8rem' }}>{m.lot_number}</code></td>
                    <td>{new Date(m.expiry_date + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                    <td>{m.quantity}</td>
                    <td style={{ fontWeight: 600, color: Number(m.days_left) < 0 || Number(m.days_left) <= 7 ? 'var(--danger)' : 'var(--warning)' }}>
                      {Number(m.days_left) < 0 ? 'Vencido' : `${m.days_left} días`}
                    </td>
                    <td>{vencimientoBadge(m.days_left)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {lowStock && lowStock.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">⚠️ Alertas de stock bajo</span>
            <span className="badge badge-red">{lowStock.length}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th><th>Medicamento</th><th>Categoría</th><th>Stock actual</th><th>Stock mínimo</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((m) => (
                  <tr key={m.id}>
                    <td><code>{m.code}</code></td>
                    <td>{m.name}</td>
                    <td>{m.category_name || '—'}</td>
                    <td><strong style={{ color: m.stock === 0 ? 'var(--danger)' : 'var(--warning)' }}>{m.stock}</strong></td>
                    <td>{m.min_stock}</td>
                    <td>{m.stock === 0 ? <span className="badge badge-red">Sin stock</span> : <span className="badge badge-yellow">Stock bajo</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
