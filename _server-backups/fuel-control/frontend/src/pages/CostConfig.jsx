import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const emptyForm = {
  vehicle_id: '', insurance_monthly: '', depreciation_monthly: '', maintenance_per_km: '',
};

export default function CostConfig() {
  const { user }                  = useAuth();
  const isAdmin                   = user?.role === 'admin';
  const [configs, setConfigs]     = useState([]);
  const [vehicles, setVehicles]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(emptyForm);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const load = () =>
    axios.get('/fuel-control/backend/api/cost_config.php')
      .then(r => { setConfigs(r.data); setLoading(false); });

  useEffect(() => {
    axios.get('/fuel-control/backend/api/vehicles.php').then(r => setVehicles(r.data));
    load();
  }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setError(''); setShowForm(true); };
  const openEdit = (c) => {
    setEditing(c.id);
    setForm({
      vehicle_id:           c.vehicle_id,
      insurance_monthly:    c.insurance_monthly ?? '',
      depreciation_monthly: c.depreciation_monthly ?? '',
      maintenance_per_km:   c.maintenance_per_km ?? '',
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
        vehicle_id:           parseInt(form.vehicle_id),
        insurance_monthly:    form.insurance_monthly !== '' ? parseFloat(form.insurance_monthly) : null,
        depreciation_monthly: form.depreciation_monthly !== '' ? parseFloat(form.depreciation_monthly) : null,
        maintenance_per_km:   form.maintenance_per_km !== '' ? parseFloat(form.maintenance_per_km) : null,
      };
      if (editing) {
        await axios.put(`/fuel-control/backend/api/cost_config.php?id=${editing}`, payload);
      } else {
        await axios.post('/fuel-control/backend/api/cost_config.php', payload);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const vehicleName = (id) => {
    const v = vehicles.find(v => String(v.id) === String(id));
    return v ? `${v.name} — ${v.plate}` : id;
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      {isAdmin && (
        <div className="page-actions">
          <div />
          <button className="btn btn-primary" onClick={openNew}>+ Nueva configuración</button>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Editar configuración' : 'Nueva configuración de costos'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-grid">
                <div className="form-group form-group-full">
                  <label className="form-label">Vehículo *</label>
                  <select className="form-input" required value={form.vehicle_id}
                    onChange={e => setForm(f => ({ ...f, vehicle_id: e.target.value }))}>
                    <option value="">Seleccionar...</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.name} — {v.plate}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Seguro mensual ($)</label>
                  <input className="form-input" type="number" step="0.01" min="0"
                    value={form.insurance_monthly}
                    onChange={e => setForm(f => ({ ...f, insurance_monthly: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Amortización mensual ($)</label>
                  <input className="form-input" type="number" step="0.01" min="0"
                    value={form.depreciation_monthly}
                    onChange={e => setForm(f => ({ ...f, depreciation_monthly: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Mantenimiento por km ($/km)</label>
                  <input className="form-input" type="number" step="0.0001" min="0"
                    value={form.maintenance_per_km}
                    onChange={e => setForm(f => ({ ...f, maintenance_per_km: e.target.value }))} />
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
                <th>Vehículo</th>
                <th>Seguro mensual</th>
                <th>Amortización mensual</th>
                <th>Mantenimiento/km</th>
                <th>Fecha</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {configs.length === 0 && (
                <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--gray-500)' }}>Sin configuraciones cargadas</td></tr>
              )}
              {configs.map(c => (
                <tr key={c.id}>
                  <td><strong>{vehicleName(c.vehicle_id)}</strong></td>
                  <td>{c.insurance_monthly != null ? `$${Number(c.insurance_monthly).toLocaleString('es', { minimumFractionDigits: 2 })}` : '—'}</td>
                  <td>{c.depreciation_monthly != null ? `$${Number(c.depreciation_monthly).toLocaleString('es', { minimumFractionDigits: 2 })}` : '—'}</td>
                  <td>{c.maintenance_per_km != null ? `$${Number(c.maintenance_per_km).toFixed(4)}` : '—'}</td>
                  <td>{c.created_at ? new Date(c.created_at).toLocaleDateString('es') : '—'}</td>
                  {isAdmin && (
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>Editar</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
