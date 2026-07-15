import { useState, useEffect } from 'react';
import { useCargos } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const emptyForm = { nombre: '', bancas: 1, orden: 0 };

export default function Cargos() {
  const { list, create, update, remove } = useCargos();
  const { user } = useAuth();
  const isAdmin  = user?.role === 'admin';
  const [cargos, setCargos] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [modal, setModal]       = useState(null);
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);

  const load = () => list().then((r) => setCargos(r.data));

  useEffect(() => {
    load().catch(() => setError('Error cargando cargos')).finally(() => setLoading(false));
  }, []);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = () => { setForm(emptyForm); setModal('create'); setError(''); };
  const openEdit   = (c) => { setForm({ nombre: c.nombre, bancas: c.bancas, orden: c.orden }); setModal(c.id); setError(''); };

  const handleSave = async () => {
    if (!form.nombre) { setError('El nombre es requerido'); return; }
    setSaving(true);
    setError('');
    try {
      if (modal === 'create') { await create(form); notify('Cargo creado'); }
      else { await update(modal, form); notify('Cargo actualizado'); }
      setModal(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este cargo?')) return;
    try {
      await remove(id);
      notify('Cargo eliminado');
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
          {isAdmin && <button className="btn btn-primary" onClick={openCreate}>+ Nuevo cargo</button>}
        </div>

        {loading ? <div className="spinner" /> : cargos.length === 0 ? (
          <div className="empty"><div className="empty-icon">🏛️</div><p>No hay cargos cargados</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Nombre</th><th>Bancas</th><th>Orden</th><th>Estado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {cargos.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.nombre}</strong></td>
                    <td>{c.bancas}</td>
                    <td>{c.orden}</td>
                    <td>{Number(c.activo) ? <span className="badge badge-green">Activo</span> : <span className="badge badge-red">Inactivo</span>}</td>
                    <td>
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>✏️</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(c.id)}>🗑️</button>
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
          title={modal === 'create' ? 'Nuevo cargo' : 'Editar cargo'}
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
            <input className="form-control" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Intendente, Concejales..." />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Bancas en juego</label>
              <input type="number" min="1" className="form-control" value={form.bancas} onChange={(e) => setForm({ ...form, bancas: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Orden en la boleta</label>
              <input type="number" className="form-control" value={form.orden} onChange={(e) => setForm({ ...form, orden: e.target.value })} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
