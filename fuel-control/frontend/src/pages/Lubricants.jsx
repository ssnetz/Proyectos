import { useEffect, useState } from 'react';
import axios from 'axios';

const DIAS  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const UNITS = ['litros', 'kg', 'unidades'];

const emptyForm = {
  vehicle_id: '', type: '', brand: '', quantity: '', unit: 'litros',
  km_recorridos: '', notes: '', applied_at: new Date().toISOString().slice(0, 16),
};

export default function Lubricants() {
  const [records, setRecords]   = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [filters, setFilters]   = useState({ vehicle_id: '', from: '', to: '' });
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const load = () => {
    const params = {};
    if (filters.vehicle_id) params.vehicle_id = filters.vehicle_id;
    if (filters.from) params.from = filters.from;
    if (filters.to)   params.to   = filters.to;
    axios.get('/fuel-control/backend/api/lubricants.php', { params }).then(r => {
      setRecords(r.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    axios.get('/fuel-control/backend/api/vehicles.php').then(r => setVehicles(r.data));
    load();
  }, []);

  useEffect(() => { load(); }, [filters]);

  const openNew = () => { setEditing(null); setForm(emptyForm); setError(''); setShowForm(true); };

  const openEdit = (r) => {
    setEditing(r.id);
    setForm({
      vehicle_id:    r.vehicle_id,
      type:          r.type,
      brand:         r.brand ?? '',
      quantity:      r.quantity,
      unit:          r.unit,
      km_recorridos: r.km_recorridos ?? '',
      notes:         r.notes ?? '',
      applied_at:    r.applied_at?.slice(0, 16) ?? new Date().toISOString().slice(0, 16),
    });
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        vehicle_id:    parseInt(form.vehicle_id),
        quantity:      parseFloat(form.quantity),
        km_recorridos: form.km_recorridos ? parseFloat(form.km_recorridos) : null,
      };
      if (editing) {
        await axios.put(`/fuel-control/backend/api/lubricants.php?id=${editing}`, payload);
      } else {
        await axios.post('/fuel-control/backend/api/lubricants.php', payload);
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
    if (!confirm('¿Eliminar este registro?')) return;
    await axios.delete(`/fuel-control/backend/api/lubricants.php?id=${id}`);
    load();
  };

  const totalQty   = records.reduce((s, r) => s + Number(r.quantity), 0);
  const totalCount = records.length;

  const filterLabel = () => {
    const v = vehicles.find(v => String(v.id) === String(filters.vehicle_id));
    const parts = [];
    if (v) parts.push(v.name + ' — ' + v.plate);
    if (filters.from) parts.push(`desde ${filters.from}`);
    if (filters.to)   parts.push(`hasta ${filters.to}`);
    return parts.length ? parts.join(' · ') : 'Todos los vehículos';
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
          <input type="date" className="form-input form-input-sm" value={filters.from}
            onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
          <input type="date" className="form-input form-input-sm" value={filters.to}
            onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nuevo registro</button>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Editar lubricante' : 'Registrar lubricante'}</h2>
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
                  <label className="form-label">Tipo de lubricante *</label>
                  <input className="form-input" required placeholder="ej: Aceite motor, Grasa, Hidráulico"
                    value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Marca</label>
                  <input className="form-input" value={form.brand}
                    onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Cantidad *</label>
                  <input className="form-input" type="number" step="0.001" required value={form.quantity}
                    onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Unidad</label>
                  <select className="form-input" value={form.unit}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Km Recorridos</label>
                  <input className="form-input" type="number" step="0.1" value={form.km_recorridos}
                    onChange={e => setForm(f => ({ ...f, km_recorridos: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha y hora *</label>
                  <input className="form-input" type="datetime-local" required value={form.applied_at}
                    onChange={e => setForm(f => ({ ...f, applied_at: e.target.value }))} />
                </div>
                <div className="form-group form-group-full">
                  <label className="form-label">Notas</label>
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

      <div className="resumen-cargas">
        <div className="resumen-label">🛢️ {filterLabel()}</div>
        <div className="resumen-stats">
          <div className="resumen-stat">
            <span className="resumen-stat-value">{totalCount}</span>
            <span className="resumen-stat-label">Registros</span>
          </div>
          <div className="resumen-stat">
            <span className="resumen-stat-value">{totalQty.toLocaleString('es', { minimumFractionDigits: 3 })}</span>
            <span className="resumen-stat-label">Total cantidad</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Día</th>
                <th>Vehículo</th>
                <th>Tipo</th>
                <th>Marca</th>
                <th>Cantidad</th>
                <th>Km Recorridos</th>
                <th>Operador</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && (
                <tr><td colSpan="9" style={{ textAlign: 'center', color: 'var(--gray-500)' }}>Sin registros</td></tr>
              )}
              {records.map(r => (
                <tr key={r.id}>
                  <td>{new Date(r.applied_at).toLocaleString('es')}</td>
                  <td>{DIAS[new Date(r.applied_at).getDay()]}</td>
                  <td><strong>{r.vehicle_name}</strong><br /><small>{r.plate}</small></td>
                  <td><span className="badge badge-orange">{r.type}</span></td>
                  <td>{r.brand ?? '—'}</td>
                  <td>{Number(r.quantity).toLocaleString('es', { minimumFractionDigits: 3 })} {r.unit}</td>
                  <td>{r.km_recorridos ?? '—'}</td>
                  <td>{r.loaded_by}</td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm btn-icon" title="Editar"
                      onClick={() => openEdit(r)}>✏️</button>
                    <button className="btn btn-ghost btn-sm btn-icon" title="Eliminar"
                      onClick={() => handleDelete(r.id)}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
            {records.length > 0 && (
              <tfoot>
                <tr style={{ fontWeight: 700, background: 'var(--gray-50)' }}>
                  <td colSpan="5" style={{ textAlign: 'right', paddingRight: 12 }}>TOTAL</td>
                  <td>{totalQty.toLocaleString('es', { minimumFractionDigits: 3 })}</td>
                  <td colSpan="3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
