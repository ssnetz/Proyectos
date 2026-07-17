import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';

function fmtNum(n, d = 0) {
  if (n == null) return '—';
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtDelta(n, d = 0, unit = '') {
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return `${sign}${fmtNum(Math.abs(n), d)}${unit}`;
}
function fmtPesoDelta(n) {
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return `${sign}$${fmtNum(Math.abs(n), 0)}`;
}

function MonthlyAlertCard({ alert }) {
  const { direccion, mes_actual, mes_anterior, narrativa, top_vehiculos, litros_delta, litros_pct, costo_delta, costo_pct, km_delta, km_pct, precio_delta, precio_pct } = alert;
  const theme = {
    up:   { icon: '⚠️', bg: 'rgba(220,38,38,.06)', border: 'rgba(220,38,38,.25)' },
    down: { icon: '📉', bg: 'rgba(22,163,74,.06)', border: 'rgba(22,163,74,.25)' },
    flat: { icon: 'ℹ️', bg: '#fff', border: 'var(--gray-200)' },
    neutral: { icon: 'ℹ️', bg: '#fff', border: 'var(--gray-200)' },
  }[direccion] || {};

  return (
    <div className="card" style={{ marginBottom: 20, background: theme.bg, border: `1px solid ${theme.border}` }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 22 }}>{theme.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: 4 }}>
            Comparativa automática: {mes_actual} vs {mes_anterior}
          </div>
          <p style={{ fontSize: '.85rem', color: 'var(--gray-700)', margin: 0 }}>{narrativa}</p>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10, fontSize: '.8rem' }}>
            <span style={{ color: litros_delta > 0 ? '#dc2626' : litros_delta < 0 ? '#16a34a' : 'var(--gray-400)' }}>
              Litros: {fmtDelta(litros_delta, 1, ' L')} {litros_pct != null && `(${fmtDelta(litros_pct, 1, '%')})`}
            </span>
            <span style={{ color: costo_delta > 0 ? '#dc2626' : costo_delta < 0 ? '#16a34a' : 'var(--gray-400)' }}>
              Costo: {fmtPesoDelta(costo_delta)} {costo_pct != null && `(${fmtDelta(costo_pct, 1, '%')})`}
            </span>
            {km_delta != null && (
              <span style={{ color: km_delta > 0 ? '#dc2626' : km_delta < 0 ? '#16a34a' : 'var(--gray-400)' }}>
                Km: {fmtDelta(km_delta, 0, ' km')} {km_pct != null && `(${fmtDelta(km_pct, 1, '%')})`}
              </span>
            )}
            {precio_delta != null && (
              <span style={{ color: precio_delta > 0 ? '#dc2626' : precio_delta < 0 ? '#16a34a' : 'var(--gray-400)' }}>
                Precio/L: {fmtPesoDelta(precio_delta)} {precio_pct != null && `(${fmtDelta(precio_pct, 1, '%')})`}
              </span>
            )}
          </div>

          {top_vehiculos.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--gray-500)', marginBottom: 4 }}>
                Vehículos que más explican la variación
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {top_vehiculos.map(v => (
                  <li key={v.vehicle_id} style={{ fontSize: '.8rem' }}>
                    <strong>{v.name}</strong> ({v.plate}):{' '}
                    <span style={{ color: v.costo_delta > 0 ? '#dc2626' : v.costo_delta < 0 ? '#16a34a' : 'var(--gray-400)' }}>
                      {fmtDelta(v.litros_delta, 1, ' L')}, {fmtPesoDelta(v.costo_delta)}
                      {Math.abs(v.km_delta) >= 1 && `, ${fmtDelta(v.km_delta, 0, ' km')}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Link to="/reports" style={{ display: 'inline-block', marginTop: 10, fontSize: '.8rem', color: 'var(--primary, #3b82f6)' }}>
            Ver comparativa completa →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/fuel-control/backend/api/dashboard.php').then(r => {
      setData(r.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="spinner" />;

  const { summary, last_30_days, by_vehicle, by_fuel_type, monthly_alert } = data;

  return (
    <div className="dashboard">
      {monthly_alert && <MonthlyAlertCard alert={monthly_alert} />}

      <div className="stats-grid">
        <StatCard icon="⛽" label="Litros totales"   value={`${Number(summary.total_liters).toLocaleString('es')} L`} color="blue" />
        <StatCard icon="💰" label="Costo total"      value={`$${Number(summary.total_cost).toLocaleString('es', { minimumFractionDigits: 2 })}`} color="green" />
        <StatCard icon="🔄" label="Total de cargas"  value={summary.total_loads} color="orange" />
        <StatCard icon="🚛" label="Vehículos activos" value={summary.active_vehicles} color="purple" />
      </div>

      <div className="charts-grid">
        <div className="card">
          <div className="card-header"><h3 className="card-title">Litros cargados — últimos 30 días</h3></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={last_30_days}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-700)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--gray-400)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--gray-400)' }} />
                <Tooltip contentStyle={{ background: 'var(--gray-800)', border: 'none', color: 'var(--gray-100)' }} />
                <Line type="monotone" dataKey="liters" stroke="#3b82f6" dot={false} name="Litros" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">Top vehículos por consumo</h3></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={by_vehicle.slice(0, 6)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-700)" />
                <XAxis dataKey="plate" tick={{ fontSize: 11, fill: 'var(--gray-400)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--gray-400)' }} />
                <Tooltip contentStyle={{ background: 'var(--gray-800)', border: 'none', color: 'var(--gray-100)' }} />
                <Bar dataKey="liters" fill="#f59e0b" name="Litros" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3 className="card-title">Consumo por tipo de combustible</h3></div>
        <div className="card-body">
          <div className="fuel-type-grid">
            {by_fuel_type.map(ft => (
              <div key={ft.fuel_type} className="fuel-type-card">
                <span className="fuel-type-name">{ft.fuel_type}</span>
                <span className="fuel-type-value">{Number(ft.liters).toLocaleString('es')} L</span>
                <span className="fuel-type-sub">{ft.loads} cargas</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className={`stat-card stat-${color}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-info">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}
