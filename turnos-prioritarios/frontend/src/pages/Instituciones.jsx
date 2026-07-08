import { useState, useEffect } from 'react';
import { useInstituciones } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const emptyForm = { nombre: '', descripcion: '' };

export default function Instituciones() {
  const { list, create, update, remove } = useInstituciones();
  const { user } = useAuth();
  const isAdmin  = user?.role === 'admin';
  const [instituciones, setInstituciones] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [modal, setModal]         = useState(null);
  const [form, setForm]           = useState(emptyForm);
  const [saving, setSaving]       = useState(false);

  const load = () => list().then((r) => setInstituciones(r.data));

  useEffect(() => {
    load().catch(() => setError('Error cargando instituciones')).finally(() => setLoading(false));
  }, []);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = () => { setForm(emptyForm); setModal('create'); setError(''); };
  const openEdit   = (i) => { setForm({ nombre: i.nombre, descripcion: i.descripcion || '' }); setModal(i.id); setError(''); };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (modal === 'create') { await create(form); notify('Institución creada'); }
      else { await update(modal, form); notify('Institución actualizada'); }
      setModal(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta institución?')) return;
    try {
      await remove(id);
      notify('Institución eliminada');
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
          {isAdmin && <button className="btn btn-primary" onClick={openCreate}>+ Nueva institución</button>}
        </div>

        {loading ? <div className="spinner" /> : instituciones.length === 0 ? (
          <div className="empty"><div className="empty-icon">🏥</div><p>No hay instituciones</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Nombre</th><th>Descripción</th><th>Turnos</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {instituciones.map((i) => (
                  <tr key={i.id}>
                    <td><strong>{i.nombre}</strong></td>
                    <td style={{ color: 'var(--gray-500)' }}>{i.descripcion || '—'}</td>
                    <td><span className="badge badge-blue">{i.turnos_count}</span></td>
                    <td>
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(i)}>✏️</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(i.id)}>🗑️</button>
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
          title={modal === 'create' ? 'Nueva institución' : 'Editar institución'}
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
          <div className="form-group">
            <label className="form-label">Descripción</label>
            <textarea className="form-control" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </div>
        </Modal>
      )}
    </div>
  );
}
