import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const emptyForm = { name: '', description: '' };

export default function Areas() {
  const { user }              = useAuth();
  const [areas, setAreas]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const isAdmin = user?.role === 'admin';

  const load = () =>
    axios.get('/fuel-control/backend/api/areas.php')
      .then(r => { setAreas(r.data); setLoading(false); });

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setError(''); setShowForm(true); };
  const openEdit = (a) => {
    setEditing(a.id);
    setForm({ name: a.name, description: a.description ?? '' });
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (editing) {
        await axios.put(`/fuel-control/backend/api/areas.php?id=${editing}`, form);
      } else {
        await axios.post('/fuel-control/backend/api/areas.php', form);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (a) => {
    if (!confirm(`¿Eliminar el área "${a.name}"? Los vehículos asignados quedarán sin área.`)) return;
    await axios.delete(`/fuel-control/backend/api/areas.php?id=${a.id}`);
    load();
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p style={{ color: 'var(--gray-500)', fontSize: '.9rem' }}>
          {areas.length} área{areas.length !== 1 ? 's' : ''} registrada{areas.length !== 1 ? 's' : ''}
        </p>
        {isAdmin && (
          <button className="btn btn-primary" onClick={openNew}>+ Nueva Área</button>
        )}
      </div>

      {areas.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--gray-500)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏛️</div>
          <p>No hay áreas registradas.</p>
          {isAdmin && <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openNew}>Crear primera área</button>}
        </div>
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Área</th>
                  <th>Descripción</th>
                  {isAdmin && <th style={{ width: 100 }}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {areas.map((a, i) => (
                  <tr key={a.id}>
                    <td style={{ color: 'var(--gray-400)', fontSize: '.8em' }}>{i + 1}</td>
                    <td><strong>{a.name}</strong></td>
                    <td style={{ color: 'var(--gray-500)', fontSize: '.9em' }}>{a.description || '—'}</td>
                    {isAdmin && (
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => openEdit(a)}>✏️</button>
                        <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(a)}>🗑️</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? 'Editar Área' : 'Nueva Área Municipal'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
                <div className="form-group">
                  <label className="form-label">Nombre del área *</label>
                  <input
                    className="form-input"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ej: Secretaría de Obras Públicas"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Descripción</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Descripción opcional del área..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear área'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
