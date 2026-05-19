import { useState, useEffect } from 'react';
import { useDashboard } from '../hooks/useApi';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const typeIcon = { farmacia: '🏥', guardia: '🚨', dispensario: '🏘' };

export default function Dashboard() {
  const { get } = useDashboard();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    get()
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error || e.message || 'No se pudo cargar el dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner" />;
  if (error)   return <div className="alert alert-danger">{error}</div>;
  if (!data?.stats) return <div className="alert alert-danger">Error al cargar el dashboard. Revisá que la base de datos esté activa y los archivos PHP actualizados.</div>;

  const { stats, stock_by_location, low_stock_products, expiring_products, recent_movements, movements_by_day } = data;

  const fmt = (v) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v);

  return (
    <div>
      {/* ── Estadísticas globales ── */}
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
            <div className="stat-value">{stats.low_stock_count}</div>
            <div className="stat-label">Stock bajo (total)</div>
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
            <div className="stat-value" style={{ fontSize: '1.2rem' }}>{fmt(stats.stock_value)}</div>
            <div className="stat-label">Valor del stock</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue">🏥</div>
          <div>
            <div className="stat-value">{stats.total_locations}</div>
            <div className="stat-label">Ubicaciones activas</div>
          </div>
        </div>
        {stats.expired_count > 0 && (
          <div className="stat-card" style={{ border: '2px solid var(--danger)', background: '#fef2f2' }}>
            <div className="stat-icon red">💀</div>
            <div>
              <div className="stat-value" style={{ color: 'var(--danger)' }}>{stats.expired_count}</div>
              <div className="stat-label">Lotes vencidos</div>
            </div>
          </div>
        )}
        {stats.expiring_soon > 0 && (
          <div className="stat-card" style={{ border: '2px solid var(--danger)', background: '#fef2f2' }}>
            <div className="stat-icon red">🗓️</div>
            <div>
              <div className="stat-value" style={{ color: 'var(--danger)' }}>{stats.expiring_soon}</div>
              <div className="stat-label">Vencen en 30 días</div>
            </div>
          </div>
        )}
        {stats.expiring_warning > 0 && (
          <div className="stat-card" style={{ border: '2px solid var(--warning)', background: '#fffbeb' }}>
            <div className="stat-icon yellow">⏳</div>
            <div>
              <div className="stat-value" style={{ color: 'var(--warning)' }}>{stats.expiring_warning}</div>
              <div className="stat-label">Vencen en 31–90 días</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Stock por ubicación ── */}
      {stock_by_location?.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">Stock por sector</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sector</th>
                  <th>Tipo</th>
                  <th style={{ textAlign: 'right' }}>Medicamentos</th>
                  <th style={{ textAlign: 'right' }}>Unidades totales</th>
                  <th style={{ textAlign: 'right' }}>Alertas stock bajo</th>
                </tr>
              </thead>
              <tbody>
                {stock_by_location.map((loc) => (
                  <tr key={loc.id}>
                    <td>
                      <strong>{typeIcon[loc.type] ?? '📍'} {loc.name}</strong>
                    </td>
                    <td>
                      <span className={`badge ${{ farmacia: 'badge-blue', guardia: 'badge-red', dispensario: 'badge-green' }[loc.type] ?? 'badge-gray'}`}>
                        {({ farmacia: 'Farmacia', guardia: 'Guardia', dispensario: 'Dispensario' })[loc.type] ?? loc.type}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>{loc.product_count}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{loc.total_units}</td>
                    <td style={{ textAlign: 'right' }}>
                      {loc.low_stock_count > 0
                        ? <span className="badge badge-yellow">{loc.low_stock_count}</span>
                        : <span style={{ color: 'var(--gray-600)' }}>—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* ── Gráfico ── */}
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
                <Bar dataKey="entradas"       fill="#16a34a" name="Entradas"       radius={[3,3,0,0]} />
                <Bar dataKey="salidas"        fill="#dc2626" name="Salidas"        radius={[3,3,0,0]} />
                <Bar dataKey="transferencias" fill="#2563eb" name="Transferencias" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Últimos movimientos ── */}
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
                  <tr><th>Medicamento</th><th>Tipo</th><th>Cant.</th><th>Sector</th><th>Fecha</th></tr>
                </thead>
                <tbody>
                  {recent_movements.map((m, i) => (
                    <tr key={i}>
                      <td>{m.product_name}</td>
                      <td><span className={`mov-${m.type}`}>{m.type}</span></td>
                      <td>{m.quantity}</td>
                      <td style={{ fontSize: '.8rem', color: 'var(--gray-400)' }}>
                        {m.type === 'transferencia'
                          ? `${m.location_name} → ${m.to_location_name}`
                          : (m.location_name || '—')
                        }
                      </td>
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

      {/* ── Alertas de vencimiento ── */}
      {expiring_products?.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">🗓️ Medicamentos próximos a vencer (90 días)</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Medicamento</th>
                  <th>Lote</th>
                  <th>Ubicación</th>
                  <th style={{ textAlign: 'right' }}>Cant.</th>
                  <th>Vencimiento</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {expiring_products.map((lot, i) => {
                  const days = parseInt(lot.days_until_expiry);
                  const color  = days < 0 ? 'var(--danger)' : days <= 30 ? 'var(--danger)' : 'var(--warning)';
                  const badge  = days < 0
                    ? <span className="badge badge-red">VENCIDO</span>
                    : days === 0
                      ? <span className="badge badge-red">Vence hoy</span>
                      : days <= 30
                        ? <span className="badge badge-red">{days} días</span>
                        : <span className="badge badge-yellow">{days} días</span>;
                  return (
                    <tr key={i}>
                      <td><strong>{lot.name}</strong> <code style={{ fontSize: '.75rem', color: 'var(--gray-400)' }}>{lot.code}</code></td>
                      <td style={{ fontSize: '.85rem' }}>{lot.lot_number || <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                      <td style={{ fontSize: '.85rem', color: 'var(--gray-500)' }}>{lot.location_name}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{lot.quantity}</td>
                      <td style={{ fontWeight: 600, color }}>{new Date(lot.expiration_date + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                      <td>{badge}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Alertas stock bajo ── */}
      {low_stock_products.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">⚠️ Alertas de stock bajo (consolidado)</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th><th>Medicamento</th><th>Categoría</th>
                  <th style={{ textAlign: 'right' }}>Stock total</th>
                  <th style={{ textAlign: 'right' }}>Mínimo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {low_stock_products.map((p) => (
                  <tr key={p.id}>
                    <td><code>{p.code}</code></td>
                    <td>{p.name}</td>
                    <td>{p.category_name || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <strong style={{ color: p.stock_total === 0 ? 'var(--danger)' : 'var(--warning)' }}>
                        {p.stock_total}
                      </strong>
                    </td>
                    <td style={{ textAlign: 'right' }}>{p.min_stock}</td>
                    <td>
                      {p.stock_total === 0
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
