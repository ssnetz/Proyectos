import { useEffect, useState } from 'react';
import axios from 'axios';

const fmt  = (n, d = 2) => Number(n ?? 0).toLocaleString('es', { minimumFractionDigits: d });
const fmtM = (n)        => `$${fmt(n)}`;

const BAR_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16'];

function CostBar({ label, value, total, color }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600 }}>{fmtM(value)} ({pct.toFixed(1)}%)</span>
      </div>
      <div style={{ background: 'var(--gray-200)', borderRadius: 4, height: 10 }}>
        <div style={{ width: `${pct}%`, background: color, borderRadius: 4, height: 10, transition: 'width .4s' }} />
      </div>
    </div>
  );
}

function VehicleCard({ row, idx }) {
  const color = BAR_COLORS[idx % BAR_COLORS.length];
  const total = row.costo_total;
  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <strong style={{ fontSize: 15 }}>{row.vehicle_name}</strong>
          <span style={{ fontSize: 12, color: 'var(--gray-500)', marginLeft: 8 }}>{row.plate}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color }}>{fmtM(total)}</div>
          <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>costo total</div>
        </div>
      </div>

      {/* KPI chips */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        {[
          { label: 'Rutas',       v: row.total_routes },
          { label: 'Km',          v: fmt(row.total_km, 1) },
          { label: 'Horas',       v: fmt(row.total_horas, 1) },
          { label: 'Toneladas',   v: fmt(row.total_toneladas, 1) },
          { label: '$/ton',       v: row.costo_por_tonelada != null ? fmtM(row.costo_por_tonelada) : '—' },
          { label: '$/km',        v: row.costo_por_km != null ? fmtM(row.costo_por_km) : '—' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--gray-100)', borderRadius: 8, padding: '6px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{k.v}</div>
            <div style={{ fontSize: 10, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Cost bars */}
      <CostBar label="Combustible"   value={row.costo_combustible}   total={total} color="#3b82f6" />
      <CostBar label="Personal"      value={row.costo_personal}      total={total} color="#10b981" />
      <CostBar label="Mantenimiento" value={row.costo_mantenimiento} total={total} color="#f59e0b" />
      <CostBar label="Fijos (seg.+amort.)" value={row.costo_fijos}  total={total} color="#8b5cf6" />
    </div>
  );
}

export default function CostDashboard() {
  const [data, setData]       = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ vehicle_id: '', from: '', to: '' });
  const [applied, setApplied] = useState({ vehicle_id: '', from: '', to: '' });

  const load = (f = applied) => {
    setLoading(true);
    const params = {};
    if (f.vehicle_id) params.vehicle_id = f.vehicle_id;
    if (f.from) params.from = f.from;
    if (f.to)   params.to   = f.to;
    axios.get('/fuel-control/backend/api/cost_dashboard.php', { params })
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    axios.get('/fuel-control/backend/api/vehicles.php').then(r => setVehicles(r.data));
    load({ vehicle_id: '', from: '', to: '' });
  }, []);

  const handleSearch = () => { setApplied(filters); load(filters); };
  const handleClear  = () => {
    const e = { vehicle_id: '', from: '', to: '' };
    setFilters(e); setApplied(e); load(e);
  };

  // Global totals
  const totals = data.reduce((acc, r) => ({
    routes:   acc.routes   + r.total_routes,
    km:       acc.km       + r.total_km,
    toneladas:acc.toneladas+ r.total_toneladas,
    horas:    acc.horas    + r.total_horas,
    comb:     acc.comb     + r.costo_combustible,
    personal: acc.personal + r.costo_personal,
    mant:     acc.mant     + r.costo_mantenimiento,
    fijos:    acc.fijos    + r.costo_fijos,
    total:    acc.total    + r.costo_total,
  }), { routes:0, km:0, toneladas:0, horas:0, comb:0, personal:0, mant:0, fijos:0, total:0 });

  return (
    <div>
      {/* Filters */}
      <div className="page-actions" style={{ marginBottom: 20 }}>
        <div className="filters">
          <select className="form-input form-input-sm" value={filters.vehicle_id}
            onChange={e => setFilters(f => ({ ...f, vehicle_id: e.target.value }))}>
            <option value="">Todos los vehículos</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} — {v.plate}</option>)}
          </select>
          <input type="date" className="form-input form-input-sm" value={filters.from}
            onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
          <input type="date" className="form-input form-input-sm" value={filters.to}
            onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
          <button className="btn btn-primary btn-sm" onClick={handleSearch}>Buscar</button>
          <button className="btn btn-ghost btn-sm" onClick={handleClear}>Limpiar</button>
        </div>
      </div>

      {/* Global KPI strip */}
      {!loading && data.length > 0 && (
        <div className="resumen-cargas" style={{ marginBottom: 20 }}>
          <div className="resumen-stats">
            {[
              { v: totals.routes,              label: 'Rutas' },
              { v: fmt(totals.km, 1) + ' km',  label: 'Km totales' },
              { v: fmt(totals.toneladas, 1) + ' t', label: 'Toneladas' },
              { v: fmt(totals.horas, 1) + ' h', label: 'Horas' },
              { v: fmtM(totals.comb),           label: 'Combustible' },
              { v: fmtM(totals.personal),        label: 'Personal' },
              { v: fmtM(totals.mant),            label: 'Mantenimiento' },
              { v: fmtM(totals.fijos),           label: 'Fijos' },
              { v: fmtM(totals.total),           label: 'TOTAL' },
            ].map(k => (
              <div key={k.label} className="resumen-stat">
                <span className="resumen-stat-value">{k.v}</span>
                <span className="resumen-stat-label">{k.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && <div className="spinner" />}

      {!loading && data.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--gray-500)', padding: 40 }}>
          Sin datos para el período seleccionado. Registrá rutas y configurá costos primero.
        </div>
      )}

      {/* Per-vehicle cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))', gap: 16 }}>
        {data.map((row, idx) => <VehicleCard key={row.vehicle_id} row={row} idx={idx} />)}
      </div>

      {/* Summary table */}
      {!loading && data.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Vehículo</th>
                  <th>Rutas</th>
                  <th>Km</th>
                  <th>Toneladas</th>
                  <th>Combustible</th>
                  <th>Personal</th>
                  <th>Mantenimiento</th>
                  <th>Fijos</th>
                  <th>Total</th>
                  <th>$/ton</th>
                  <th>$/km</th>
                </tr>
              </thead>
              <tbody>
                {data.map(r => (
                  <tr key={r.vehicle_id}>
                    <td><strong>{r.vehicle_name}</strong><br/><small>{r.plate}</small></td>
                    <td>{r.total_routes}</td>
                    <td>{fmt(r.total_km, 1)}</td>
                    <td>{fmt(r.total_toneladas, 1)}</td>
                    <td>{fmtM(r.costo_combustible)}</td>
                    <td>{fmtM(r.costo_personal)}</td>
                    <td>{fmtM(r.costo_mantenimiento)}</td>
                    <td>{fmtM(r.costo_fijos)}</td>
                    <td><strong>{fmtM(r.costo_total)}</strong></td>
                    <td>{r.costo_por_tonelada != null ? fmtM(r.costo_por_tonelada) : '—'}</td>
                    <td>{r.costo_por_km != null ? fmtM(r.costo_por_km) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700, background: 'var(--gray-50)' }}>
                  <td>TOTALES</td>
                  <td>{totals.routes}</td>
                  <td>{fmt(totals.km, 1)}</td>
                  <td>{fmt(totals.toneladas, 1)}</td>
                  <td>{fmtM(totals.comb)}</td>
                  <td>{fmtM(totals.personal)}</td>
                  <td>{fmtM(totals.mant)}</td>
                  <td>{fmtM(totals.fijos)}</td>
                  <td>{fmtM(totals.total)}</td>
                  <td>{totals.toneladas > 0 ? fmtM(totals.total / totals.toneladas) : '—'}</td>
                  <td>{totals.km > 0 ? fmtM(totals.total / totals.km) : '—'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
