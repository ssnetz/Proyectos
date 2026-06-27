import { useEffect, useState } from 'react';
import axios from 'axios';

const DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

const emptyForm = {
  vehicle_id: '', liters: '', km_recorridos: '', price_per_liter: '',
  fuel_type: '', station: '', notes: '',
  fueled_at: new Date().toISOString().slice(0, 16),
};

export default function Fueling() {
  const [records, setRecords]     = useState([]);
  const [vehicles, setVehicles]   = useState([]);
  const [fuelTypes, setFuelTypes] = useState([]);
  const [fuelPrices, setFuelPrices] = useState({});
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [filters, setFilters]       = useState({ vehicle_id: '', from: '', to: '' });
  const [appliedFilters, setAppliedFilters] = useState({ vehicle_id: '', from: '', to: '' });
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const load = (f = appliedFilters) => {
    const params = {};
    if (f.vehicle_id) params.vehicle_id = f.vehicle_id;
    if (f.from) params.from = f.from;
    if (f.to)   params.to   = f.to;
    axios.get('/fuel-control/backend/api/fueling.php', { params }).then(r => {
      setRecords(r.data);
      setLoading(false);
    });
  };

  const handleSearch = () => {
    setAppliedFilters(filters);
    load(filters);
  };

  const handleClearFilters = () => {
    const empty = { vehicle_id: '', from: '', to: '' };
    setFilters(empty);
    setAppliedFilters(empty);
    load(empty);
  };

  useEffect(() => {
    axios.get('/fuel-control/backend/api/vehicles.php').then(r => setVehicles(r.data));
    axios.get('/fuel-control/backend/api/fuel_types.php').then(r => {
      setFuelTypes(r.data);
      if (r.data.length > 0) {
        setForm(f => ({ ...f, fuel_type: f.fuel_type || r.data[0].name }));
      }
    });
    axios.get('/fuel-control/backend/api/fuel_prices.php').then(r => {
      const map = {};
      r.data.forEach(p => { if (p.price) map[p.fuel_type] = p.price; });
      setFuelPrices(map);
    });
    load({ vehicle_id: '', from: '', to: '' });
  }, []);

  const openNew = () => {
    setEditing(null);
    const defaultType = fuelTypes.length > 0 ? fuelTypes[0].name : '';
    setForm({ ...emptyForm, fuel_type: defaultType, price_per_liter: fuelPrices[defaultType] ?? '' });
    setError('');
    setShowForm(true);
  };

  const openEdit = (r) => {
    setEditing(r.id);
    setForm({
      vehicle_id:      r.vehicle_id,
      liters:          r.liters,
      km_recorridos:   r.km_recorridos ?? '',
      price_per_liter: r.price_per_liter ?? '',
      fuel_type:       r.fuel_type,
      station:         r.station ?? '',
      notes:           r.notes ?? '',
      fueled_at:       r.fueled_at?.slice(0, 16) ?? new Date().toISOString().slice(0, 16),
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
        vehicle_id:      parseInt(form.vehicle_id),
        liters:          parseFloat(form.liters),
        km_recorridos:   form.km_recorridos ? parseFloat(form.km_recorridos) : null,
        price_per_liter: form.price_per_liter ? parseFloat(form.price_per_liter) : null,
      };
      if (editing) {
        await axios.put(`/fuel-control/backend/api/fueling.php?id=${editing}`, payload);
      } else {
        await axios.post('/fuel-control/backend/api/fueling.php', payload);
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
    await axios.delete(`/fuel-control/backend/api/fueling.php?id=${id}`);
    load();
  };

  const totalLiters = records.reduce((s, r) => s + Number(r.liters), 0);
  const totalCost   = records.reduce((s, r) => s + Number(r.total_cost || 0), 0);
  const totalKm     = records.reduce((s, r) => s + Number(r.km_recorridos || 0), 0);
  const totalLoads  = records.length;

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
          <button className="btn btn-primary btn-sm" onClick={handleSearch}>Buscar</button>
          <button className="btn btn-ghost btn-sm" onClick={handleClearFilters}>Limpiar</button>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nueva carga</button>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Editar carga' : 'Nueva carga de combustible'}</h2>
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
                  <select className="form-input" value={form.fuel_type}
                    onChange={e => {
                      const tipo = e.target.value;
                      setForm(f => ({
                        ...f,
                        fuel_type: tipo,
                        price_per_liter: fuelPrices[tipo] ?? f.price_per_liter,
                      }));
                    }}>
                    {fuelTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Litros *</label>
                  <input className="form-input" type="number" step="0.01" required value={form.liters}
                    onChange={e => setForm(f => ({ ...f, liters: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Precio por litro</label>
                  <input className="form-input" type="number" step="0.0001" value={form.price_per_liter}
                    onChange={e => setForm(f => ({ ...f, price_per_liter: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Km Recorridos</label>
                  <input className="form-input" type="number" step="0.1" value={form.km_recorridos}
                    onChange={e => setForm(f => ({ ...f, km_recorridos: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha y hora *</label>
                  <input className="form-input" type="datetime-local" required value={form.fueled_at}
                    onChange={e => setForm(f => ({ ...f, fueled_at: e.target.value }))} />
                </div>
                <div className="form-group form-group-full">
                  <label className="form-label">Estación / Proveedor</label>
                  <input className="form-input" value={form.station}
                    onChange={e => setForm(f => ({ ...f, station: e.target.value }))} />
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
        <div className="resumen-label">📋 {filterLabel()}</div>
        <div className="resumen-stats">
          <div className="resumen-stat">
            <span className="resumen-stat-value">{totalLoads}</span>
            <span className="resumen-stat-label">Cargas</span>
          </div>
          <div className="resumen-stat">
            <span className="resumen-stat-value">{totalLiters.toLocaleString('es', { minimumFractionDigits: 2 })} L</span>
            <span className="resumen-stat-label">Total litros</span>
          </div>
          <div className="resumen-stat">
            <span className="resumen-stat-value">{totalKm.toLocaleString('es', { minimumFractionDigits: 1 })} km</span>
            <span className="resumen-stat-label">Total km recorridos</span>
          </div>
          <div className="resumen-stat">
            <span className="resumen-stat-value">${totalCost.toLocaleString('es', { minimumFractionDigits: 2 })}</span>
            <span className="resumen-stat-label">Total costo</span>
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
                <th>Combustible</th>
                <th>Litros</th>
                <th>$/L</th>
                <th>Total $</th>
                <th>Km Recorridos</th>
                <th>Km/L</th>
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
                  <td>{new Date(r.fueled_at).toLocaleString('es')}</td>
                  <td>{DIAS[new Date(r.fueled_at).getDay()]}</td>
                  <td><strong>{r.vehicle_name}</strong><br /><small>{r.plate}</small></td>
                  <td><span className="badge badge-blue">{r.fuel_type}</span></td>
                  <td>{Number(r.liters).toLocaleString('es')} L</td>
                  <td>{r.price_per_liter ? `$${Number(r.price_per_liter).toFixed(4)}` : '—'}</td>
                  <td>{r.total_cost ? `$${Number(r.total_cost).toLocaleString('es', { minimumFractionDigits: 2 })}` : '—'}</td>
                  <td>{r.km_recorridos ?? '—'}</td>
                  <td>{r.km_recorridos && Number(r.liters) > 0
                    ? (Number(r.km_recorridos) / Number(r.liters)).toFixed(2)
                    : '—'}
                  </td>
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
                  <td colSpan="4" style={{ textAlign: 'right', paddingRight: 12 }}>TOTALES</td>
                  <td>{totalLiters.toLocaleString('es', { minimumFractionDigits: 2 })} L</td>
                  <td></td>
                  <td>${totalCost.toLocaleString('es', { minimumFractionDigits: 2 })}</td>
                  <td>{totalKm.toLocaleString('es', { minimumFractionDigits: 1 })} km</td>
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
