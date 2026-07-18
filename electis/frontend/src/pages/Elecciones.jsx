import { useState, useEffect } from 'react';
import { useElecciones } from '../hooks/useApi';
import Modal from '../components/Modal';

const emptyForm = { nombre: '', fecha: '' };

export default function Elecciones() {
  const { list, create, update } = useElecciones();
  const [elecciones, setElecciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [modal, setModal]     = useState(null); // null | 'create' | eleccionId
  const [form, setForm]       = useState(emptyForm);
  const [saving, setSaving]   = useState(false);

  const load = () => list().then((r) => setElecciones(r.data));

  useEffect(() => {
    load().catch(() => setError('Error cargando elecciones')).finally(() => setLoading(false));
  }, []);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = () => { setForm(emptyForm); setModal('create'); setError(''); };
  const openEdit   = (e) => { setForm({ nombre: e.nombre, fecha: e.fecha || '' }); setModal(e.id); setError(''); };

  const handleSave = async () => {
    if (!form.nombre) { setError('El nombre es requerido'); return; }
    setSaving(true);
    setError('');
    try {
      if (modal === 'create') { await create(form); notify('Elección creada'); }
      else { await update(modal, form); notify('Elección actualizada'); }
      setModal(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (e) => {
    const action = Number(e.activo) ? 'Desactivar' : 'Activar';
    if (!confirm(`¿${action} la "${e.nombre}"? (esto solo la oculta del selector, no borra sus datos)`)) return;
    try {
      await update(e.id, { nombre: e.nombre, fecha: e.fecha, activo: Number(e.activo) ? 0 : 1 });
      notify(`Elección ${Number(e.activo) ? 'desactivada' : 'activada'}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar elección');
    }
  };

  return (
    <div>
      {error   && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="table-actions">
          <div />
          <button className="btn btn-primary" onClick={openCreate}>+ Nueva elección</button>
        </div>

        <p style={{ fontSize: '.85rem', color: 'var(--gray-500)', marginBottom: 16 }}>
          Cargos, listas, candidatos, mesas, padrón, actas y fiscales son propios de cada elección.
          Establecimientos y partidos se comparten entre todas las elecciones del municipio.
        </p>

        {loading ? <div className="spinner" /> : elecciones.length === 0 ? (
          <div className="empty"><div className="empty-icon">🗓️</div><p>No hay elecciones cargadas</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Nombre</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {elecciones.map((e) => (
                  <tr key={e.id}>
                    <td><strong>{e.nombre}</strong></td>
                    <td style={{ color: 'var(--gray-500)' }}>{e.fecha || '—'}</td>
                    <td>{Number(e.activo) ? <span className="badge badge-green">Activa</span> : <span className="badge badge-red">Inactiva</span>}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(e)}>✏️</button>
                        <button
                          className={`btn btn-sm ${Number(e.activo) ? 'btn-ghost' : 'btn-success'}`}
                          onClick={() => handleToggleActive(e)}
                          title={Number(e.activo) ? 'Desactivar' : 'Activar'}
                        >
                          {Number(e.activo) ? '🚫' : '✅'}
                        </button>
                      </div>
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
          title={modal === 'create' ? 'Nueva elección' : 'Editar elección'}
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
            <input className="form-control" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Elección 2027" />
          </div>
          <div className="form-group">
            <label className="form-label">Fecha</label>
            <input type="date" className="form-control" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          </div>
        </Modal>
      )}
    </div>
  );
}
