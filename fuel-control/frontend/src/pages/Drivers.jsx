import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const LICENSE_TYPES = ['A', 'B', 'C', 'D', 'E'];

const emptyForm = {
  name: '', dni: '', phone: '', license_type: 'B',
  hire_date: '', hourly_cost: '', active: true,
};

export default function Drivers() {
  const { user }                = useAuth();
  const isAdmin                 = user?.role === 'admin';
  const [drivers, setDrivers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const load = () =>
    axios.get('/fuel-control/backend/api/drivers.php?all=1')
      .then(r => { setDrivers(r.data); setLoading(false); });

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setError(''); setShowForm(true); };
  const openEdit = (d) => {
    setEditing(d.id);
    setForm({
      name:         d.name,
      dni:          d.dni ?? '',
      phone:        d.phone ?? '',
      license_type: d.license_type ?? 'B',
      hire_date:    d.hire_date ?? '',
      hourly_cost:  d.hourly_cost ?? '',
      active:       Boolean(d.active),
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
        hourly_cost: form.hourly_cost !== '' ? parseFloat(form.hourly_cost) : null,
      };
      if (editing) {
        await axios.put(`/fuel-control/backend/api/drivers.php?id=${editing}`, payload);
      } else {
        await axios.post('/fuel-control/backend/api/drivers.php', payload);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (d) => {
    await axios.put(`/fuel-control/backend/api/drivers.php?id=${d.id}`, { ...d, active: !d.active });
    load();
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      {isAdmin && (
        <div className="page-actions">
          <div />
          <button className="btn btn-primary" onClick={openNew}>+ Nuevo chofer</button>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Editar chofer' : 'Nuevo chofer'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-grid">
                <div className="form-group form-group-full">
                  <label className="form-label">Nombre completo *</label>
                  <input className="form-input" required value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">DNI</label>
                  <input className="form-input" value={form.dni}
                    onChange={e => setForm(f => ({ ...f, dni: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input className="form-input" value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo de licencia *</label>
                  <select className="form-input" required value={form.license_type}
                    onChange={e => setForm(f => ({ ...f, license_type: e.target.value }))}>
                    {LICENSE_TYPES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha de ingreso</label>
                  <input className="form-input" type="date" value={form.hire_date}
                    onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Costo por hora ($)</label>
                  <input className="form-input" type="number" step="0.01" min="0" value={form.hourly_cost}
                    onChange={e => setForm(f => ({ ...f, hourly_cost: e.target.value }))} />
                </div>
                {editing && (
                  <div className="form-group">
                    <label className="form-label">Estado</label>
                    <select className="form-input" value={form.active ? '1' : '0'}
                      onChange={e => setForm(f => ({ ...f, active: e.target.value === '1' }))}>
                      <option value="1">Activo</option>
                      <option value="0">Inactivo</option>
                    </select>
                  </div>
                )}
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
                <th>Nombre</th>
                <th>DNI</th>
                <th>Teléfono</th>
                <th>Licencia</th>
                <th>Fecha ingreso</th>
                <th>Costo/hora</th>
                <th>Estado</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {drivers.length === 0 && (
                <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--gray-500)' }}>Sin choferes cargados</td></tr>
              )}
              {drivers.map(d => (
                <tr key={d.id}>
                  <td><strong>{d.name}</strong></td>
                  <td>{d.dni ?? '—'}</td>
                  <td>{d.phone ?? '—'}</td>
                  <td><span className="badge badge-blue">{d.license_type ?? '—'}</span></td>
                  <td>{d.hire_date ? new Date(d.hire_date).toLocaleDateString('es') : '—'}</td>
                  <td>{d.hourly_cost != null ? `$${Number(d.hourly_cost).toLocaleString('es', { minimumFractionDigits: 2 })}` : '—'}</td>
                  <td><span className={`badge ${d.active ? 'badge-green' : 'badge-red'}`}>{d.active ? 'Activo' : 'Inactivo'}</span></td>
                  {isAdmin && (
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(d)}>Editar</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleToggle(d)}>
                        {d.active ? 'Desactivar' : 'Activar'}
                      </button>
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
