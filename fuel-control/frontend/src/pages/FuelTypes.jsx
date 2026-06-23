import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const emptyForm = { name: '', active: 1 };

export default function FuelTypes() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [types, setTypes]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const load = () =>
    axios.get('/fuel-control/backend/api/fuel_types.php?all=1').then(r => {
      setTypes(r.data);
      setLoading(false);
    });

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (t) => {
    setEditing(t.id);
    setForm({ name: t.name, active: t.active });
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await axios.put(`/fuel-control/backend/api/fuel_types.php?id=${editing}`, form);
      } else {
        await axios.post('/fuel-control/backend/api/fuel_types.php', form);
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

  const handleToggle = async (t) => {
    try {
      await axios.put(`/fuel-control/backend/api/fuel_types.php?id=${t.id}`, {
        name: t.name,
        active: t.active ? 0 : 1,
      });
      load();
    } catch (err) {
      alert(err.response?.data?.error ?? 'Error al actualizar');
    }
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      {isAdmin && (
        <div className="page-actions">
          <div />
          <button className="btn btn-primary" onClick={openNew}>+ Nuevo tipo</button>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Editar tipo de combustible' : 'Nuevo tipo de combustible'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-grid">
                <div className="form-group form-group-full">
                  <label className="form-label">Nombre *</label>
                  <input
                    className="form-input"
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
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
                <th>Nombre</th>
                <th>Estado</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {types.length === 0 && (
                <tr><td colSpan="3" style={{ textAlign: 'center', color: 'var(--gray-500)' }}>Sin tipos de combustible</td></tr>
              )}
              {types.map(t => (
                <tr key={t.id}>
                  <td><strong>{t.name}</strong></td>
                  <td>
                    <span className={`badge ${t.active ? 'badge-green' : 'badge-gray'}`}>
                      {t.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm btn-icon" title="Editar"
                        onClick={() => openEdit(t)}>✏️</button>
                      <button className="btn btn-ghost btn-sm" title={t.active ? 'Desactivar' : 'Activar'}
                        onClick={() => handleToggle(t)}>
                        {t.active ? 'Desactivar' : 'Activar'}
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
