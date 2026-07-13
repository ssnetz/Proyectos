import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const emptyForm = {
  vehicle_id: '', fuel_type: '', liters_requested: '',
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

  return (
    <div>
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
                    onChange={e => setForm(f => ({ ...f, vehicle_id: e.target.value }))}>
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
                  <label className="form-label">Litros solicitados *</label>
                  <input className="form-input" type="number" step="0.01" required value={form.liters_requested}
                    onChange={e => setForm(f => ({ ...f, liters_requested: e.target.value }))} />
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
    </div>
  );
}
