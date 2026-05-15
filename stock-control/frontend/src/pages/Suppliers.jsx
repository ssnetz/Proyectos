import { useState, useEffect } from 'react';
import { useSuppliers } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const emptyForm = { name: '', contact: '', email: '', phone: '', address: '' };

export default function Suppliers() {
  const { list, create, update, remove } = useSuppliers();
  const { user } = useAuth();
  const isAdmin  = user?.role === 'admin';
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [modal, setModal]         = useState(null);
  const [form, setForm]           = useState(emptyForm);
  const [saving, setSaving]       = useState(false);

  const load = () => list().then((r) => setSuppliers(r.data));

  useEffect(() => {
    load().catch(() => setError('Error cargando proveedores')).finally(() => setLoading(false));
  }, []);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = () => { setForm(emptyForm); setModal('create'); setError(''); };
  const openEdit   = (s) => {
    setForm({ name: s.name, contact: s.contact || '', email: s.email || '', phone: s.phone || '', address: s.address || '' });
    setModal(s.id);
    setError('');
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (modal === 'create') {
        await create(form);
        notify('Proveedor creado');
      } else {
        await update(modal, form);
        notify('Proveedor actualizado');
      }
      setModal(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este proveedor?')) return;
    try {
      await remove(id);
      notify('Proveedor eliminado');
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
          {isAdmin && <button className="btn btn-primary" onClick={openCreate}>+ Nuevo proveedor</button>}
        </div>

        {loading ? <div className="spinner" /> : suppliers.length === 0 ? (
          <div className="empty"><div className="empty-icon">🏭</div><p>No hay proveedores</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Nombre</th><th>Contacto</th><th>Email</th><th>Teléfono</th><th>Productos</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.contact || '—'}</td>
                    <td>{s.email ? <a href={`mailto:${s.email}`} style={{ color: 'var(--primary)' }}>{s.email}</a> : '—'}</td>
                    <td>{s.phone || '—'}</td>
                    <td><span className="badge badge-blue">{s.product_count}</span></td>
                    <td>
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}>✏️</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(s.id)}>🗑️</button>
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
          title={modal === 'create' ? 'Nuevo proveedor' : 'Editar proveedor'}
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
            <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Contacto</label>
              <input className="form-control" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input className="form-control" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Dirección</label>
            <textarea className="form-control" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
        </Modal>
      )}
    </div>
  );
}
