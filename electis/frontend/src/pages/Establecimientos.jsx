import { useState, useEffect } from 'react';
import { useEstablecimientos } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const emptyForm = { nombre: '', direccion: '', circuito: '' };

export default function Establecimientos() {
  const { list, create, update, remove } = useEstablecimientos();
  const { user } = useAuth();
  const isAdmin  = user?.role === 'admin';
  const [establecimientos, setEstablecimientos] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [modal, setModal]         = useState(null);
  const [form, setForm]           = useState(emptyForm);
  const [saving, setSaving]       = useState(false);

  const load = () => list().then((r) => setEstablecimientos(r.data));

  useEffect(() => {
    load().catch(() => setError('Error cargando establecimientos')).finally(() => setLoading(false));
  }, []);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = () => { setForm(emptyForm); setModal('create'); setError(''); };
  const openEdit   = (e) => { setForm({ nombre: e.nombre, direccion: e.direccion || '', circuito: e.circuito || '' }); setModal(e.id); setError(''); };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (modal === 'create') { await create(form); notify('Establecimiento creado'); }
      else { await update(modal, form); notify('Establecimiento actualizado'); }
      setModal(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este establecimiento?')) return;
    try {
      await remove(id);
      notify('Establecimiento eliminado');
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al eliminar');
    }
  };

  return (
    <div>
      {error   && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="table-actions">
          <div />
          {isAdmin && <button className="btn btn-primary" onClick={openCreate}>+ Nuevo establecimiento</button>}
        </div>

        {loading ? <div className="spinner" /> : establecimientos.length === 0 ? (
          <div className="empty"><div className="empty-icon">🏫</div><p>No hay establecimientos</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Nombre</th><th>Dirección</th><th>Circuito</th><th>Mesas</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {establecimientos.map((e) => (
                  <tr key={e.id}>
                    <td><strong>{e.nombre}</strong></td>
                    <td style={{ color: 'var(--gray-500)' }}>{e.direccion || '—'}</td>
                    <td>{e.circuito || '—'}</td>
                    <td><span className="badge badge-blue">{e.mesas_count}</span></td>
                    <td>
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(e)}>✏️</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(e.id)}>🗑️</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal !== null && (
        <Modal
          title={modal === 'create' ? 'Nuevo establecimiento' : 'Editar establecimiento'}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          }
        >
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="form-group">
            <label className="form-label">Nombre *</label>
            <input className="form-control" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Dirección</label>
              <input className="form-control" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Circuito</label>
              <input className="form-control" value={form.circuito} onChange={(e) => setForm({ ...form, circuito: e.target.value })} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
