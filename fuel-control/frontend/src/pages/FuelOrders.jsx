import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const emptyForm = {
  vehicle_id: '', fuel_type: '', liters_requested: '', liters_before: '',
  driver_name: '', notes: '',
};

const STATUS_LABELS = { pendiente: 'Pendiente', completada: 'Completada', cancelada: 'Cancelada' };
const STATUS_BADGES = { pendiente: 'badge-blue', completada: 'badge-green', cancelada: 'badge-red' };

function printOrder(order) {
  const win = window.open('', '_blank');
  const fecha = new Date(order.ordered_at).toLocaleString('es');
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Orden de Carga #${order.id}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; }
  .page { width: 210mm; padding: 10mm; }
  .copy { border: 1px solid #ccc; border-radius: 6px; padding: 12px; margin-bottom: 6px; page-break-inside: avoid; }
  .cut-line {
    border-top: 2px dashed #999;
    text-align: center;
    color: #999;
    font-size: 10px;
    margin: 6px 0;
    padding-top: 4px;
    letter-spacing: 2px;
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
  .logo { font-size: 18px; font-weight: bold; }
  .logo small { font-size: 10px; font-weight: normal; display: block; color: #666; }
  .order-num { font-size: 16px; font-weight: bold; text-align: right; }
  .order-num small { font-size: 10px; font-weight: normal; display: block; color: #666; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; margin: 8px 0; }
  .field label { font-size: 9px; text-transform: uppercase; color: #666; display: block; margin-bottom: 2px; }
  .field span { font-size: 13px; font-weight: bold; }
  .full { grid-column: 1 / -1; }
  .notes-box { border: 1px solid #ddd; border-radius: 4px; padding: 6px; min-height: 30px; font-size: 11px; color: #444; margin-top: 4px; }
  .footer { display: flex; justify-content: space-between; margin-top: 14px; gap: 20px; }
  .sign { flex: 1; border-top: 1px solid #333; padding-top: 4px; font-size: 9px; text-align: center; color: #555; }
  .copy-tag { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #999; text-align: right; margin-bottom: 4px; }
  @media print { body { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">
  ${['ORIGINAL', 'DUPLICADO'].map(tag => `
  <div class="copy">
    <div class="copy-tag">${tag}</div>
    <div class="header">
      <div class="logo">⛽ Control de Combustible<small>SSNetz · Software Networks Solutions</small></div>
      <div class="order-num">ORDEN #${String(order.id).padStart(5,'0')}<small>${fecha}</small></div>
    </div>
    <div class="grid">
      <div class="field">
        <label>Vehículo</label>
        <span>${order.vehicle_name} — ${order.plate}</span>
      </div>
      <div class="field">
        <label>Tipo de combustible</label>
        <span>${order.fuel_type}</span>
      </div>
      <div class="field">
        <label>Litros solicitados</label>
        <span>${Number(order.liters_requested).toLocaleString('es', { minimumFractionDigits: 2 })} L</span>
      </div>
      <div class="field">
        <label>Chofer / Operador</label>
        <span>${order.driver_name}</span>
      </div>
      <div class="field full">
        <label>Solicitado por</label>
        <span>${order.created_by}</span>
      </div>
      ${order.notes ? `<div class="field full"><label>Observaciones</label><div class="notes-box">${order.notes}</div></div>` : ''}
    </div>
    <div class="footer">
      <div class="sign">Firma Responsable</div>
      <div class="sign">Firma Chofer</div>
      <div class="sign">Firma Entrega Combustible</div>
    </div>
  </div>
  ${tag === 'ORIGINAL' ? '<div class="cut-line">✂ &nbsp; LÍNEA DE CORTE &nbsp; ✂</div>' : ''}
  `).join('')}
</div>
<script>window.onload = () => { window.print(); window.close(); }</script>
</body>
</html>`;
  win.document.write(html);
  win.document.close();
}

export default function FuelOrders() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [orders, setOrders]     = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [fuelTypes, setFuelTypes] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [filters, setFilters]   = useState({ vehicle_id: '', from: '', to: '', status: '' });
  const [appliedFilters, setAppliedFilters] = useState({ vehicle_id: '', from: '', to: '', status: '' });
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [tab, setTab]           = useState('ordenes'); // 'ordenes' | 'tanques'
  const [tankStatus, setTankStatus]   = useState([]);
  const [tankLoading, setTankLoading] = useState(false);
  const [tankSelected, setTankSelected] = useState({});
  const [tankMode, setTankMode]   = useState('lleno'); // 'lleno' | 'litros'
  const [tankLitros, setTankLitros] = useState('');
  const [tankFuelType, setTankFuelType] = useState('');
  const [creatingBulk, setCreatingBulk] = useState(false);

  const load = (f = appliedFilters) => {
    const params = {};
    if (f.vehicle_id) params.vehicle_id = f.vehicle_id;
    if (f.from)   params.from   = f.from;
    if (f.to)     params.to     = f.to;
    if (f.status) params.status = f.status;
    axios.get('/fuel-control/backend/api/fuel_orders.php', { params }).then(r => {
      setOrders(r.data);
      setLoading(false);
    });
  };

  const handleSearch = () => { setAppliedFilters(filters); load(filters); };
  const handleClear  = () => {
    const empty = { vehicle_id: '', from: '', to: '', status: '' };
    setFilters(empty); setAppliedFilters(empty); load(empty);
  };

  useEffect(() => {
    axios.get('/fuel-control/backend/api/vehicles.php').then(r => setVehicles(r.data));
    axios.get('/fuel-control/backend/api/fuel_types.php').then(r => setFuelTypes(r.data));
    load({ vehicle_id: '', from: '', to: '', status: '' });
  }, []);

  const fetchLastLiters = async (vehicle_id) => {
    if (!vehicle_id) return;
    try {
      const v = vehicles.find(v => String(v.id) === String(vehicle_id));
      const today = new Date().toISOString().slice(0, 10);

      // km recorridos desde la última carga
      const gpsR = await axios.get('/fuel-control/backend/api/km_since_last_fuel.php', {
        params: { vehicle_id, until_date: today }
      });
      const km = parseFloat(gpsR.data.total_km) || 0;
      const kmL = parseFloat(v?.km_per_liter) || 0;
      const cap = parseFloat(v?.tank_capacity) || 0;

      if (kmL > 0 && cap > 0) {
        const consumido = km / kmL;
        const restante  = Math.max(0, cap - consumido);
        setForm(f => ({ ...f, liters_before: restante.toFixed(2) }));
      }
    } catch {}
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (o) => {
    setEditing(o.id);
    setForm({
      vehicle_id:       o.vehicle_id,
      fuel_type:        o.fuel_type,
      liters_requested: o.liters_requested,
      driver_name:      o.driver_name,
      notes:            o.notes ?? '',
      status:           o.status,
    });
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, vehicle_id: parseInt(form.vehicle_id), liters_requested: parseFloat(form.liters_requested) };
      if (editing) {
        await axios.put(`/fuel-control/backend/api/fuel_orders.php?id=${editing}`, payload);
      } else {
        await axios.post('/fuel-control/backend/api/fuel_orders.php', payload);
      }
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const loadTankStatus = async () => {
    setTankLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const eligible = vehicles.filter(v => v.active && v.tank_capacity && v.km_per_liter);
    const results = await Promise.all(eligible.map(async v => {
      try {
        const r = await axios.get('/fuel-control/backend/api/km_since_last_fuel.php', {
          params: { vehicle_id: v.id, until_date: today }
        });
        const km         = parseFloat(r.data.total_km)   || 0;
        const lastLiters = parseFloat(r.data.last_liters) || parseFloat(v.tank_capacity);
        const consumido  = km / parseFloat(v.km_per_liter);
        const restante   = Math.max(0, lastLiters - consumido);
        const pct        = Math.min(100, Math.round((restante / parseFloat(v.tank_capacity)) * 100));
        const ultima_carga = r.data.ultima_carga ?? null;
        return { ...v, km_desde_carga: km, litros_restantes: restante.toFixed(1), pct, ultima_carga, last_liters: lastLiters };
      } catch {
        return { ...v, km_desde_carga: 0, litros_restantes: '—', pct: null };
      }
    }));
    results.sort((a, b) => (a.pct ?? 999) - (b.pct ?? 999));
    setTankStatus(results);
    setTankLoading(false);
  };

  const handleBulkOrder = async () => {
    const selected = tankStatus.filter(v => tankSelected[v.id]);
    if (!selected.length) return;
    if (!tankFuelType) { alert('Seleccioná el tipo de combustible'); return; }
    setCreatingBulk(true);
    for (const v of selected) {
      const liters = tankMode === 'lleno'
        ? parseFloat(v.tank_capacity) - parseFloat(v.litros_restantes)
        : parseFloat(tankLitros);
      if (!liters || liters <= 0) continue;
      await axios.post('/fuel-control/backend/api/fuel_orders.php', {
        vehicle_id: v.id, fuel_type: tankFuelType,
        liters_requested: liters.toFixed(2), driver_name: '-', notes: 'Generada desde panel de tanques',
      });
    }
    setCreatingBulk(false);
    setTankSelected({});
    setTab('ordenes');
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta orden?')) return;
    await axios.delete(`/fuel-control/backend/api/fuel_orders.php?id=${id}`);
    load();
  };

  const handleStatus = async (o, status) => {
    await axios.put(`/fuel-control/backend/api/fuel_orders.php?id=${o.id}`, {
      vehicle_id: o.vehicle_id, fuel_type: o.fuel_type,
      liters_requested: o.liters_requested, driver_name: o.driver_name,
      notes: o.notes, status,
    });
    load();
  };

  if (loading) return <div className="spinner" />;

  const pctColor = (pct) => {
    if (pct === null) return '#94a3b8';
    if (pct < 25) return '#ef4444';
    if (pct < 50) return '#f59e0b';
    return '#22c55e';
  };

  return (
    <div>
      {/* Pestañas */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--gray-200)' }}>
        <button
          className={`btn btn-sm ${tab === 'ordenes' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '6px 6px 0 0' }}
          onClick={() => setTab('ordenes')}>
          Órdenes de carga
        </button>
        <button
          className={`btn btn-sm ${tab === 'tanques' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '6px 6px 0 0' }}
          onClick={() => { setTab('tanques'); loadTankStatus(); }}>
          Estado de tanques
        </button>
      </div>

      {/* Panel estado de tanques */}
      {tab === 'tanques' && (
        <div>
          {tankLoading && <div className="spinner" />}
          {!tankLoading && tankStatus.length === 0 && (
            <div className="card" style={{ padding: 24, color: 'var(--gray-500)' }}>
              Sin vehículos con tanque y rendimiento configurados. Editá los vehículos para agregar esos datos.
            </div>
          )}
          {!tankLoading && tankStatus.length > 0 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, marginBottom: 20 }}>
                {tankStatus.map(v => {
                  const color = pctColor(v.pct);
                  const checked = !!tankSelected[v.id];
                  return (
                    <div key={v.id} className="card" onClick={() => setTankSelected(s => ({ ...s, [v.id]: !s[v.id] }))}
                      style={{ padding: 16, cursor: 'pointer', border: checked ? `2px solid ${color}` : '2px solid transparent', transition: 'border .15s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <input type="checkbox" checked={checked} onChange={() => {}} style={{ width: 16, height: 16 }} />
                        <span style={{ fontSize: 20 }}>🚛</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{v.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{v.plate}</div>
                        </div>
                        <div style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 18, color }}>
                          {v.pct !== null ? `${v.pct}%` : '—'}
                        </div>
                      </div>
                      {/* Barra de progreso */}
                      <div style={{ background: '#e2e8f0', borderRadius: 99, height: 10, overflow: 'hidden' }}>
                        <div style={{ width: `${v.pct ?? 0}%`, background: color, height: '100%', borderRadius: 99, transition: 'width .3s' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>
                        <span>{v.litros_restantes} L restantes</span>
                        <span>Tanque: {v.tank_capacity} L</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
                        {v.km_desde_carga > 0 ? `${v.km_desde_carga.toFixed(1)} km recorridos` : 'Sin km GPS registrados'}
                        {v.ultima_carga && <span> · Última carga: {v.ultima_carga} ({v.last_liters.toFixed(0)} L)</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Controles de orden masiva */}
              <div className="card" style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                  {Object.values(tankSelected).filter(Boolean).length} vehículo(s) seleccionado(s)
                </span>
                <select className="form-input form-input-sm" style={{ width: 180 }} value={tankFuelType}
                  onChange={e => setTankFuelType(e.target.value)}>
                  <option value="">Tipo de combustible</option>
                  {fuelTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input type="radio" checked={tankMode === 'lleno'} onChange={() => setTankMode('lleno')} /> Tanque lleno
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input type="radio" checked={tankMode === 'litros'} onChange={() => setTankMode('litros')} /> Litros fijos:
                </label>
                {tankMode === 'litros' && (
                  <input className="form-input form-input-sm" type="number" step="0.1" min="0"
                    style={{ width: 90 }} value={tankLitros} placeholder="Litros"
                    onChange={e => setTankLitros(e.target.value)} />
                )}
                <button className="btn btn-primary btn-sm" onClick={handleBulkOrder} disabled={creatingBulk || !Object.values(tankSelected).filter(Boolean).length}>
                  {creatingBulk ? 'Generando...' : 'Generar órdenes'}
                </button>
                <button className="btn btn-ghost btn-sm"
                  onClick={() => setTankSelected(Object.fromEntries(tankStatus.filter(v => v.pct !== null && v.pct < 25).map(v => [v.id, true])))}>
                  Marcar críticos (&lt;25%)
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'ordenes' && <div>
      <div className="page-actions">
        <div className="filters">
          <select className="form-input form-input-sm" value={filters.vehicle_id}
            onChange={e => setFilters(f => ({ ...f, vehicle_id: e.target.value }))}>
            <option value="">Todos los vehículos</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} — {v.plate}</option>)}
          </select>
          <select className="form-input form-input-sm" value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="completada">Completada</option>
            <option value="cancelada">Cancelada</option>
          </select>
          <input type="date" className="form-input form-input-sm" value={filters.from}
            onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
          <input type="date" className="form-input form-input-sm" value={filters.to}
            onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
          <button className="btn btn-primary btn-sm" onClick={handleSearch}>Buscar</button>
          <button className="btn btn-ghost btn-sm" onClick={handleClear}>Limpiar</button>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nueva orden</button>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Editar orden' : 'Nueva orden de carga'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Vehículo *</label>
                  <select className="form-input" required value={form.vehicle_id}
                    onChange={e => {
                      const vid = e.target.value;
                      setForm(f => ({ ...f, vehicle_id: vid, liters_before: '' }));
                      fetchLastLiters(vid);
                    }}>
                    <option value="">Seleccionar...</option>
                    {vehicles.filter(v => v.active).map(v =>
                      <option key={v.id} value={v.id}>{v.name} — {v.plate}</option>
                    )}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo de combustible *</label>
                  <select className="form-input" required value={form.fuel_type}
                    onChange={e => setForm(f => ({ ...f, fuel_type: e.target.value }))}>
                    <option value="">Seleccionar...</option>
                    {fuelTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Litros solicitados *
                    {form.vehicle_id && (() => {
                      const v = vehicles.find(v => String(v.id) === String(form.vehicle_id));
                      return v?.tank_capacity
                        ? <span style={{ fontWeight: 400, color: 'var(--gray-500)', marginLeft: 8 }}>Tanque: {v.tank_capacity} L</span>
                        : null;
                    })()}
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="form-input" type="number" step="0.01" required value={form.liters_requested}
                      onChange={e => setForm(f => ({ ...f, liters_requested: e.target.value }))} />
                    {form.vehicle_id && (() => {
                      const v = vehicles.find(v => String(v.id) === String(form.vehicle_id));
                      if (!v?.tank_capacity) return null;
                      const antes = parseFloat(form.liters_before) || 0;
                      const falta = Math.max(0, parseFloat(v.tank_capacity) - antes);
                      return (
                        <button type="button" className="btn btn-ghost btn-sm"
                          style={{ whiteSpace: 'nowrap' }}
                          title={`Llena hasta ${v.tank_capacity} L`}
                          onClick={() => setForm(f => ({ ...f, liters_requested: falta.toFixed(2) }))}>
                          Tanque lleno
                        </button>
                      );
                    })()}
                  </div>
                  {form.vehicle_id && (() => {
                    const v = vehicles.find(v => String(v.id) === String(form.vehicle_id));
                    if (!v?.tank_capacity) return null;
                    return (
                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label style={{ fontSize: 12, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>Litros antes de cargar:</label>
                        <input className="form-input form-input-sm" type="number" step="0.01" min="0"
                          style={{ width: 90 }} value={form.liters_before} placeholder="0"
                          onChange={e => setForm(f => ({ ...f, liters_before: e.target.value }))} />
                      </div>
                    );
                  })()}
                </div>
                <div className="form-group">
                  <label className="form-label">Chofer / Operador *</label>
                  <input className="form-input" required value={form.driver_name}
                    onChange={e => setForm(f => ({ ...f, driver_name: e.target.value }))} />
                </div>
                {editing && (
                  <div className="form-group">
                    <label className="form-label">Estado</label>
                    <select className="form-input" value={form.status}
                      onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                      <option value="pendiente">Pendiente</option>
                      <option value="completada">Completada</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
                  </div>
                )}
                <div className="form-group form-group-full">
                  <label className="form-label">Observaciones</label>
                  <textarea className="form-input" rows="2" value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Fecha</th>
                <th>Vehículo</th>
                <th>Combustible</th>
                <th>Litros</th>
                <th>Chofer</th>
                <th>Estado</th>
                <th>Solicitado por</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr><td colSpan="9" style={{ textAlign: 'center', color: 'var(--gray-500)' }}>Sin órdenes</td></tr>
              )}
              {orders.map(o => (
                <tr key={o.id}>
                  <td><strong>{String(o.id).padStart(5,'0')}</strong></td>
                  <td>{new Date(o.ordered_at).toLocaleString('es')}</td>
                  <td><strong>{o.vehicle_name}</strong><br /><small>{o.plate}</small></td>
                  <td><span className="badge badge-blue">{o.fuel_type}</span></td>
                  <td>{Number(o.liters_requested).toLocaleString('es', { minimumFractionDigits: 2 })} L</td>
                  <td>{o.driver_name}</td>
                  <td><span className={`badge ${STATUS_BADGES[o.status]}`}>{STATUS_LABELS[o.status]}</span></td>
                  <td>{o.created_by}</td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm btn-icon" title="Imprimir PDF"
                      onClick={() => printOrder(o)}>🖨️</button>
                    <button className="btn btn-ghost btn-sm btn-icon" title="Editar"
                      onClick={() => openEdit(o)}>✏️</button>
                    {isAdmin && o.status === 'pendiente' && (
                      <button className="btn btn-ghost btn-sm" title="Marcar completada"
                        onClick={() => handleStatus(o, 'completada')}>✓</button>
                    )}
                    {isAdmin && (
                      <button className="btn btn-ghost btn-sm btn-icon" title="Eliminar"
                        onClick={() => handleDelete(o.id)}>🗑</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>}
    </div>
  );
}
