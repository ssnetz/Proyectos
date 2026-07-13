import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const emptyForm = { name: '', cuit: '', phone: '', email: '', address: '', notes: '', active: true };

export default function Suppliers() {
  const { user }                    = useAuth();
  const isAdmin                     = user?.role === 'admin';
  const [suppliers, setSuppliers]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState(null);
  const [form, setForm]             = useState(emptyForm);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const load = () =>
    axios.get('/fuel-control/backend/api/suppliers.php?all=1')
      .then(r => { setSuppliers(r.data); setLoading(false); });

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setError(''); setShowForm(true); };
  const openEdit = (s) => {
    setEditing(s.id);
    setForm({
      name:    s.name,
      cuit:    s.cuit    ?? '',
      phone:   s.phone   ?? '',
      email:   s.email   ?? '',
      address: s.address ?? '',
      notes:   s.notes   ?? '',
      active:  Boolean(s.active),
    });
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (editing) {
        await axios.put(`/fuel-control/backend/api/suppliers.php?id=${editing}`, form);
      } else {
        await axios.post('/fuel-control/backend/api/suppliers.php', form);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (s) => {
    await axios.put(`/fuel-control/backend/api/suppliers.php?id=${s.id}`, { ...s, active: !s.active });
    load();
  };

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  if (loading) return <div className="spinner" />;

  return (
    <div>
      {isAdmin && (
        <div className="page-actions">
          <div />
          <button className="btn btn-primary" onClick={openNew}>+ Nuevo proveedor</button>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-grid">
                <div className="form-group form-group-full">
                  <label className="form-label">Nombre / Razón social *</label>
                  <input className="form-input" required value={form.name} onChange={f('name')} />
                </div>
                <div className="form-group">
                  <label className="form-label">CUIT</label>
                  <input className="form-input" value={form.cuit} onChange={f('cuit')} placeholder="20-12345678-9" />
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input className="form-input" value={form.phone} onChange={f('phone')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={form.email} onChange={f('email')} />
                </div>
                <div className="form-group form-group-full">
                  <label className="form-label">Dirección</label>
                  <input className="form-input" value={form.address} onChange={f('address')} />
                </div>
                <div className="form-group form-group-full">
                  <label className="form-label">Notas</label>
                  <textarea className="form-input" rows={2} value={form.notes} onChange={f('notes')} />
                </div>
                {editing && (
                  <div className="form-group">
                    <label className="form-label">Estado</label>
                    <select className="form-input" value={form.active ? '1' : '0'}
                      onChange={e => setForm(p => ({ ...p, active: e.target.value === '1' }))}>
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
                <th>CUIT</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Dirección</th>
                <th>Estado</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 && (
                <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--gray-500)' }}>Sin proveedores cargados</td></tr>
              )}
              {suppliers.map(s => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td>{s.cuit ?? '—'}</td>
                  <td>{s.phone ?? '—'}</td>
                  <td>{s.email ?? '—'}</td>
                  <td>{s.address ?? '—'}</td>
                  <td><span className={`badge ${s.active ? 'badge-green' : 'badge-red'}`}>{s.active ? 'Activo' : 'Inactivo'}</span></td>
                  {isAdmin && (
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}>Editar</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleToggle(s)}>
                        {s.active ? 'Desactivar' : 'Activar'}
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
