import { useState, useEffect } from 'react';
import { useDashboard } from '../hooks/useApi';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

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
  if (!data || !data.stats) return <div className="alert alert-danger">Error: respuesta inesperada del servidor. Revisá la consola PHP de XAMPP.</div>;

  const { stats, low_stock_products, recent_movements, movements_by_day } = data;

  const formatCurrency = (v) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v);

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">📦</div>
          <div>
            <div className="stat-value">{stats.total_products}</div>
            <div className="stat-label">Productos activos</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red">⚠️</div>
          <div>
            <div className="stat-value">{stats.low_stock_count}</div>
            <div className="stat-label">Stock bajo</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow">🚫</div>
          <div>
            <div className="stat-value">{stats.out_of_stock}</div>
            <div className="stat-label">Sin stock</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">💰</div>
          <div>
            <div className="stat-value" style={{ fontSize: '1.2rem' }}>{formatCurrency(stats.stock_value)}</div>
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
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Movimientos últimos 7 días</span>
          </div>
          {movements_by_day.length === 0 ? (
            <div className="empty"><div className="empty-icon">📊</div><p>Sin datos aún</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={movements_by_day} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="entradas" fill="#16a34a" name="Entradas" radius={[3,3,0,0]} />
                <Bar dataKey="salidas"  fill="#dc2626" name="Salidas"  radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Últimos movimientos</span>
          </div>
          {recent_movements.length === 0 ? (
            <div className="empty"><div className="empty-icon">📋</div><p>Sin movimientos</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Producto</th><th>Tipo</th><th>Cant.</th><th>Fecha</th></tr>
                </thead>
                <tbody>
                  {recent_movements.map((m, i) => (
                    <tr key={i}>
                      <td>{m.product_name}</td>
                      <td><span className={`mov-${m.type}`}>{m.type}</span></td>
                      <td>{m.quantity}</td>
                      <td style={{ color: 'var(--gray-400)', fontSize: '.8rem' }}>
                        {new Date(m.created_at).toLocaleDateString('es-AR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {low_stock_products.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">⚠️ Alertas de stock bajo</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Código</th><th>Producto</th><th>Categoría</th><th>Stock actual</th><th>Stock mínimo</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {low_stock_products.map((p) => (
                  <tr key={p.id}>
                    <td><code>{p.code}</code></td>
                    <td>{p.name}</td>
                    <td>{p.category_name || '—'}</td>
                    <td><strong style={{ color: p.stock === 0 ? 'var(--danger)' : 'var(--warning)' }}>{p.stock}</strong></td>
                    <td>{p.min_stock}</td>
                    <td>
                      {p.stock === 0
                        ? <span className="badge badge-red">Sin stock</span>
                        : <span className="badge badge-yellow">Stock bajo</span>
                      }
                    </td>
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
