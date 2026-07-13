import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

const emptyForm = {
  vehicle_id: '', type: '', brand: '', quantity: '', unit: 'litros',
  km_recorridos: '', notes: '',
  applied_at: new Date().toISOString().slice(0, 16),
};

export default function Lubricants() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [records, setRecords]             = useState([]);
  const [vehicles, setVehicles]           = useState([]);
  const [lubricantTypes, setLubricantTypes] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [filters, setFilters]           = useState({ vehicle_id: '', from: '', to: '' });
  const [appliedFilters, setAppliedFilters] = useState({ vehicle_id: '', from: '', to: '' });
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const load = (f = appliedFilters) => {
    const params = {};
    if (f.vehicle_id) params.vehicle_id = f.vehicle_id;
    if (f.from) params.from = f.from;
    if (f.to)   params.to   = f.to;
    axios.get('/fuel-control/backend/api/lubricants.php', { params }).then(r => {
      setRecords(r.data);
      setLoading(false);
    });
  };

  const handleSearch = () => { setAppliedFilters(filters); load(filters); };
  const handleClear  = () => {
    const empty = { vehicle_id: '', from: '', to: '' };
    setFilters(empty); setAppliedFilters(empty); load(empty);
  };

  useEffect(() => {
    axios.get('/fuel-control/backend/api/vehicles.php').then(r => setVehicles(r.data));
    axios.get('/fuel-control/backend/api/lubricant_types.php').then(r => setLubricantTypes(r.data));
    load({ vehicle_id: '', from: '', to: '' });
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

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

  const totalApplications = records.length;
  const totalQuantity     = records.reduce((s, r) => s + Number(r.quantity), 0);

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-actions">
        <div className="filters">
          <select className="form-input form-input-sm" value={filters.vehicle_id}
            onChange={e => setFilters(f => ({ ...f, vehicle_id: e.target.value }))}>
            <option value="">Todos los vehículos</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} &mdash; {v.plate}</option>)}
          </select>
          <input type="date" className="form-input form-input-sm" value={filters.from}
            onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
          <input type="date" className="form-input form-input-sm" value={filters.to}
            onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
          <button className="btn btn-primary btn-sm" onClick={handleSearch}>Buscar</button>
          <button className="btn btn-ghost btn-sm" onClick={handleClear}>Limpiar</button>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nueva aplicación</button>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Editar lubricante' : 'Nueva aplicación de lubricante'}</h2>
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
                      <option key={v.id} value={v.id}>{v.name} &mdash; {v.plate}</option>
                    )}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo de lubricante *</label>
                  <select className="form-input" required value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="">Seleccionar...</option>
                    {lubricantTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
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
                  <label className="form-label">Unidad *</label>
                  <select className="form-input" value={form.unit}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                    <option value="litros">litros</option>
                    <option value="kg">kg</option>
                    <option value="unidades">unidades</option>
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
        <div className="resumen-stats">
          <div className="resumen-stat">
            <span className="resumen-stat-value">{totalApplications}</span>
            <span className="resumen-stat-label">Aplicaciones</span>
          </div>
          <div className="resumen-stat">
            <span className="resumen-stat-value">{totalQuantity.toLocaleString('es', { minimumFractionDigits: 2 })}</span>
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
                <th>Tipo lubricante</th>
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
                  <td><span className="badge badge-blue">{r.type}</span></td>
                  <td>{r.brand ?? '—'}</td>
                  <td>{Number(r.quantity).toLocaleString('es')} {r.unit}</td>
                  <td>{r.km_recorridos ?? '—'}</td>
                  <td>{r.loaded_by}</td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm btn-icon" title="Editar"
                      onClick={() => openEdit(r)}>✏️</button>
                    {isAdmin && (
                      <button className="btn btn-ghost btn-sm btn-icon" title="Eliminar"
                        onClick={() => handleDelete(r.id)}>🗑</button>
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
