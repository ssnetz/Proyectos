import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const TONS_PER_TRIP = 8;

const emptyForm = {
  vehicle_id: '', driver_id: '', zone_id: '',
  departure_at: '', arrival_at: '',
  km_start: '', km_end: '',
  fuel_liters: '', trips_to_dump: '', notes: '',
};

const emptyFilters = { vehicle_id: '', driver_id: '', zone_id: '', from: '', to: '' };

function diffHours(dep, arr) {
  if (!dep || !arr) return null;
  const ms = new Date(arr) - new Date(dep);
  if (isNaN(ms) || ms < 0) return null;
  return ms / 3600000;
}

export default function Routes() {
  const { user }              = useAuth();
  const isAdmin               = user?.role === 'admin';

  const [records, setRecords]   = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers]   = useState([]);
  const [zones, setZones]       = useState([]);
  const [loading, setLoading]   = useState(true);

  const [filters, setFilters]               = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const load = (f = appliedFilters) => {
    const params = {};
    if (f.vehicle_id) params.vehicle_id = f.vehicle_id;
    if (f.driver_id)  params.driver_id  = f.driver_id;
    if (f.zone_id)    params.zone_id    = f.zone_id;
    if (f.from)       params.from       = f.from;
    if (f.to)         params.to         = f.to;
    axios.get('/fuel-control/backend/api/routes.php', { params })
      .then(r => { setRecords(r.data); setLoading(false); });
  };

  useEffect(() => {
    axios.get('/fuel-control/backend/api/vehicles.php').then(r => setVehicles(r.data));
    axios.get('/fuel-control/backend/api/drivers.php').then(r => setDrivers(r.data));
    axios.get('/fuel-control/backend/api/zones.php').then(r => setZones(r.data));
    load(emptyFilters);
  }, []);

  const handleSearch = () => {
    setAppliedFilters(filters);
    load(filters);
  };

  const handleClearFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    load(emptyFilters);
  };

  const openNew = () => { setEditing(null); setForm(emptyForm); setError(''); setShowForm(true); };
  const openEdit = (r) => {
    setEditing(r.id);
    setForm({
      vehicle_id:    r.vehicle_id,
      driver_id:     r.driver_id,
      zone_id:       r.zone_id,
      departure_at:  r.departure_at?.slice(0, 16) ?? '',
      arrival_at:    r.arrival_at?.slice(0, 16) ?? '',
      km_start:      r.km_start ?? '',
      km_end:        r.km_end ?? '',
      fuel_liters:   r.fuel_liters ?? '',
      trips_to_dump: r.trips_to_dump ?? '',
      notes:         r.notes ?? '',
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
        vehicle_id:    parseInt(form.vehicle_id),
        driver_id:     parseInt(form.driver_id),
        zone_id:       parseInt(form.zone_id),
        departure_at:  form.departure_at,
        arrival_at:    form.arrival_at || null,
        km_start:      form.km_start !== '' ? parseFloat(form.km_start) : null,
        km_end:        form.km_end !== '' ? parseFloat(form.km_end) : null,
        fuel_liters:   form.fuel_liters !== '' ? parseFloat(form.fuel_liters) : null,
        trips_to_dump: form.trips_to_dump !== '' ? parseInt(form.trips_to_dump) : null,
        notes:         form.notes || null,
      };
      if (editing) {
        await axios.put(`/fuel-control/backend/api/routes.php?id=${editing}`, payload);
      } else {
        await axios.post('/fuel-control/backend/api/routes.php', payload);
      }
      setShowForm(false);
      setEditing(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este recorrido?')) return;
    await axios.delete(`/fuel-control/backend/api/routes.php?id=${id}`);
    load();
  };

  // Summary calculations
  const totalRecorridos = records.length;
  const totalKm = records.reduce((s, r) => {
    const km = r.km_end != null && r.km_start != null ? Number(r.km_end) - Number(r.km_start) : 0;
    return s + km;
  }, 0);
  const totalToneladas = records.reduce((s, r) => s + (Number(r.trips_to_dump || 0) * TONS_PER_TRIP), 0);
  const totalHoras = records.reduce((s, r) => {
    const h = diffHours(r.departure_at, r.arrival_at);
    return s + (h ?? 0);
  }, 0);

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
          <select className="form-input form-input-sm" value={filters.driver_id}
            onChange={e => setFilters(f => ({ ...f, driver_id: e.target.value }))}>
            <option value="">Todos los choferes</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className="form-input form-input-sm" value={filters.zone_id}
            onChange={e => setFilters(f => ({ ...f, zone_id: e.target.value }))}>
            <option value="">Todas las zonas</option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
          <input type="date" className="form-input form-input-sm" value={filters.from}
            onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
          <input type="date" className="form-input form-input-sm" value={filters.to}
            onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
          <button className="btn btn-primary btn-sm" onClick={handleSearch}>Buscar</button>
          <button className="btn btn-ghost btn-sm" onClick={handleClearFilters}>Limpiar</button>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nuevo recorrido</button>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Editar recorrido' : 'Nuevo recorrido'}</h2>
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
                  <label className="form-label">Chofer *</label>
                  <select className="form-input" required value={form.driver_id}
                    onChange={e => setForm(f => ({ ...f, driver_id: e.target.value }))}>
                    <option value="">Seleccionar...</option>
                    {drivers.filter(d => d.active).map(d =>
                      <option key={d.id} value={d.id}>{d.name}</option>
                    )}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Zona *</label>
                  <select className="form-input" required value={form.zone_id}
                    onChange={e => setForm(f => ({ ...f, zone_id: e.target.value }))}>
                    <option value="">Seleccionar...</option>
                    {zones.filter(z => z.active).map(z =>
                      <option key={z.id} value={z.id}>{z.name}</option>
                    )}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Salida *</label>
                  <input className="form-input" type="datetime-local" required value={form.departure_at}
                    onChange={e => setForm(f => ({ ...f, departure_at: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Llegada</label>
                  <input className="form-input" type="datetime-local" value={form.arrival_at}
                    onChange={e => setForm(f => ({ ...f, arrival_at: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Km inicial</label>
                  <input className="form-input" type="number" step="0.1" min="0" value={form.km_start}
                    onChange={e => setForm(f => ({ ...f, km_start: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Km final</label>
                  <input className="form-input" type="number" step="0.1" min="0" value={form.km_end}
                    onChange={e => setForm(f => ({ ...f, km_end: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Litros combustible</label>
                  <input className="form-input" type="number" step="0.01" min="0" value={form.fuel_liters}
                    onChange={e => setForm(f => ({ ...f, fuel_liters: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Viajes al basural</label>
                  <input className="form-input" type="number" step="1" min="0" value={form.trips_to_dump}
                    onChange={e => setForm(f => ({ ...f, trips_to_dump: e.target.value }))} />
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
            <span className="resumen-stat-value">{totalRecorridos}</span>
            <span className="resumen-stat-label">Recorridos</span>
          </div>
          <div className="resumen-stat">
            <span className="resumen-stat-value">{totalKm.toLocaleString('es', { minimumFractionDigits: 1 })} km</span>
            <span className="resumen-stat-label">Total km</span>
          </div>
          <div className="resumen-stat">
            <span className="resumen-stat-value">{totalToneladas.toLocaleString('es')} t</span>
            <span className="resumen-stat-label">Total toneladas</span>
          </div>
          <div className="resumen-stat">
            <span className="resumen-stat-value">{totalHoras.toLocaleString('es', { minimumFractionDigits: 1 })} h</span>
            <span className="resumen-stat-label">Total horas</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Zona</th>
                <th>Vehículo</th>
                <th>Chofer</th>
                <th>Km recorridos</th>
                <th>Horas</th>
                <th>Litros</th>
                <th>Viajes basural</th>
                <th>Toneladas</th>
                <th>Operador</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && (
                <tr><td colSpan={isAdmin ? 11 : 10} style={{ textAlign: 'center', color: 'var(--gray-500)' }}>Sin recorridos</td></tr>
              )}
              {records.map(r => {
                const kmRecorridos = r.km_end != null && r.km_start != null
                  ? Number(r.km_end) - Number(r.km_start)
                  : null;
                const horas = diffHours(r.departure_at, r.arrival_at);
                const toneladas = r.trips_to_dump != null ? Number(r.trips_to_dump) * TONS_PER_TRIP : null;
                return (
                  <tr key={r.id}>
                    <td>{r.departure_at ? new Date(r.departure_at).toLocaleString('es') : '—'}</td>
                    <td>{r.zone_name ?? '—'}</td>
                    <td>
                      <strong>{r.vehicle_name ?? '—'}</strong>
                      {r.plate && <><br /><small>{r.plate}</small></>}
                    </td>
                    <td>{r.driver_name ?? '—'}</td>
                    <td>{kmRecorridos != null ? `${kmRecorridos.toLocaleString('es', { minimumFractionDigits: 1 })} km` : '—'}</td>
                    <td>{horas != null ? `${horas.toFixed(1)} h` : '—'}</td>
                    <td>{r.fuel_liters != null ? `${Number(r.fuel_liters).toLocaleString('es')} L` : '—'}</td>
                    <td>{r.trips_to_dump ?? '—'}</td>
                    <td>{toneladas != null ? `${toneladas.toLocaleString('es')} t` : '—'}</td>
                    <td>{r.loaded_by ?? '—'}</td>
                    {isAdmin && (
                      <td style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm btn-icon" title="Editar"
                          onClick={() => openEdit(r)}>✏️</button>
                        <button className="btn btn-ghost btn-sm btn-icon" title="Eliminar"
                          onClick={() => handleDelete(r.id)}>🗑</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            {records.length > 0 && (
              <tfoot>
                <tr style={{ fontWeight: 700, background: 'var(--gray-50)' }}>
                  <td colSpan="4" style={{ textAlign: 'right', paddingRight: 12 }}>TOTALES</td>
                  <td>{totalKm.toLocaleString('es', { minimumFractionDigits: 1 })} km</td>
                  <td>{totalHoras.toFixed(1)} h</td>
                  <td></td>
                  <td></td>
                  <td>{totalToneladas.toLocaleString('es')} t</td>
                  <td colSpan={isAdmin ? 2 : 1}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
