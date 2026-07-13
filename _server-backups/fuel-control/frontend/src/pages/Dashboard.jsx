import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';

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

  const { summary, last_30_days, by_vehicle, by_fuel_type } = data;

  return (
    <div className="dashboard">
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
