import { useState, useEffect } from 'react';
import { useCategorias } from '../hooks/useApi';
import Modal from '../components/Modal';

const emptyForm = { name: '', description: '' };

export default function Categorias() {
  const { list, create, update, remove } = useCategorias();
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [modal, setModal]     = useState(null);
  const [form, setForm]       = useState(emptyForm);
  const [saving, setSaving]   = useState(false);

  const load = () => list().then((r) => setItems(r.data));
  useEffect(() => { load().catch(() => setError('Error al cargar')).finally(() => setLoading(false)); }, []);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };
  const fld = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const openCreate = () => { setForm(emptyForm); setError(''); setModal('create'); };
  const openEdit   = (c) => { setForm({ name: c.name, description: c.description || '' }); setError(''); setModal(c.id); };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      if (modal === 'create') { await create(form); notify('Categoría creada'); }
      else { await update(modal, form); notify('Categoría actualizada'); }
      setModal(null); await load();
    } catch (e) { setError(e.response?.data?.error || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta categoría?')) return;
    try { await remove(id); notify('Categoría eliminada'); await load(); }
    catch (e) { setError(e.response?.data?.error || 'Error al eliminar'); }
  };

  return (
    <div>
      {error   && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      <div className="card">
        <div className="table-actions">
          <div />
          <button className="btn btn-primary" onClick={openCreate}>+ Nueva categoría</button>
        </div>
        {loading ? <div className="spinner" /> : items.length === 0 ? (
          <div className="empty"><div className="empty-icon">🏷️</div><p>No hay categorías</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Nombre</th><th>Descripción</th><th>Medicamentos</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td style={{ color: 'var(--gray-500)' }}>{c.description || '—'}</td>
                    <td><span className="badge badge-blue">{c.product_count}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>✏️</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(c.id)}>🗑️</button>
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
          title={modal === 'create' ? 'Nueva categoría' : 'Editar categoría'}
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
            <input className="form-control" value={form.name} onChange={fld('name')} />
          </div>
          <div className="form-group">
            <label className="form-label">Descripción</label>
            <textarea className="form-control" value={form.description} onChange={fld('description')} />
          </div>
        </Modal>
      )}
    </div>
  );
}
