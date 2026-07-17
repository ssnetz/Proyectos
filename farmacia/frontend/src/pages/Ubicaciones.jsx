import { useState, useEffect } from 'react';
import { useUbicaciones } from '../hooks/useApi';
import Modal from '../components/Modal';

const emptyForm = { name: '', type: '' };

export default function Ubicaciones() {
  const { list, create, update, remove } = useUbicaciones();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modal, setModal] = useState(null); // null | 'create' | id
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => list({ active_only: '0' }).then((r) => setItems(r.data));

  useEffect(() => {
    load().catch(() => setError('Error al cargar')).finally(() => setLoading(false));
  }, []);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = () => { setForm(emptyForm); setError(''); setModal('create'); };

  const openEdit = (l) => {
    setForm({ name: l.name, type: l.type || '' });
    setError('');
    setModal(l.id);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (modal === 'create') { await create(form); notify('Ubicación creada'); }
      else { await update(modal, form); notify('Ubicación actualizada'); }
      setModal(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id) => {
    if (!confirm('¿Desactivar esta ubicación?')) return;
    try {
      await remove(id);
      notify('Ubicación desactivada');
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al desactivar');
    }
  };

  return (
    <div>
      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="table-actions">
          <div />
          <button className="btn btn-primary" onClick={openCreate}>+ Nueva ubicación</button>
        </div>

        {loading ? (
          <div className="spinner" />
        ) : items.length === 0 ? (
          <div className="empty"><div className="empty-icon">📍</div><p>No hay ubicaciones</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Nombre</th><th>Tipo</th><th>Estado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {items.map((l) => (
                  <tr key={l.id}>
                    <td><strong>{l.name}</strong></td>
                    <td>{l.type || '—'}</td>
                    <td>{l.active == 1 ? <span className="badge badge-green">Activa</span> : <span className="badge badge-gray">Inactiva</span>}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(l)}>✏️</button>
                        {l.active == 1 && <button className="btn btn-ghost btn-sm" onClick={() => handleDeactivate(l.id)}>🗑️</button>}
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
          title={modal === 'create' ? 'Nueva ubicación' : 'Editar ubicación'}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </>
          }
        >
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="form-group">
            <label className="form-label">Nombre *</label>
            <input className="form-control" placeholder="Ej: Depósito A, Heladera 1..." value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <input className="form-control" placeholder="Ej: deposito, heladera, estante..." value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
          </div>
        </Modal>
      )}
    </div>
  );
}
