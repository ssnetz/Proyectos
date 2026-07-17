import { useState, useEffect } from 'react';
import { useUsuarios } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { MODULES } from '../config/modules';
import Modal from '../components/Modal';

const emptyForm = { username: '', email: '', password: '', role: 'operador', permissions: null };

export default function Usuarios() {
  const { list, create, update } = useUsuarios();
  const { user: currentUser } = useAuth();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modal, setModal] = useState(null); // null | 'create' | id
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => list().then((r) => setItems(r.data));

  useEffect(() => {
    load().catch(() => setError('Error al cargar')).finally(() => setLoading(false));
  }, []);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = () => { setForm(emptyForm); setError(''); setModal('create'); };

  const openEdit = (u) => {
    setForm({ username: u.username, email: u.email || '', password: '', role: u.role, permissions: u.permissions ?? null });
    setError('');
    setModal(u.id);
  };

  const toggleFullAccess = (full) => {
    setForm(f => ({ ...f, permissions: full ? null : MODULES.map(m => m.key) }));
  };

  const toggleModule = (key) => {
    setForm(f => {
      const current = f.permissions ?? [];
      const next = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
      return { ...f, permissions: next };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, permissions: form.role === 'admin' ? null : form.permissions };
      if (modal === 'create') { await create(payload); notify('Usuario creado'); }
      else { await update(modal, payload); notify('Usuario actualizado'); }
      setModal(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (u) => {
    if (u.id === currentUser?.id) return;
    const action = u.active ? 'desactivar' : 'activar';
    if (!confirm(`¿${action} al usuario "${u.username}"?`)) return;
    try {
      await update(u.id, { username: u.username, email: u.email, role: u.role, permissions: u.permissions, active: u.active ? 0 : 1 });
      notify(`Usuario ${u.active ? 'desactivado' : 'activado'}`);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al actualizar');
    }
  };

  const isCurrentUser = (u) => u.id === currentUser?.id;

  return (
    <div>
      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="table-actions">
          <div />
          <button className="btn btn-primary" onClick={openCreate}>+ Nuevo usuario</button>
        </div>

        {loading ? (
          <div className="spinner" />
        ) : items.length === 0 ? (
          <div className="empty"><div className="empty-icon">👤</div><p>No hay usuarios</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th><th>Email</th><th>Rol</th><th>Acceso</th><th>Estado</th><th>Creado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.username}</strong>
                      {isCurrentUser(u) && <span className="badge badge-blue" style={{ marginLeft: 8, fontSize: '.7rem' }}>yo</span>}
                    </td>
                    <td style={{ color: 'var(--gray-500)' }}>{u.email || '—'}</td>
                    <td>{u.role === 'admin' ? <span className="badge badge-purple">admin</span> : <span className="badge badge-gray">operador</span>}</td>
                    <td style={{ color: 'var(--gray-500)', fontSize: '.85rem' }}>
                      {u.role === 'admin' || u.permissions === null
                        ? 'Completo'
                        : `${u.permissions.length} módulo${u.permissions.length === 1 ? '' : 's'}`}
                    </td>
                    <td>{u.active ? <span className="badge badge-green">Activo</span> : <span className="badge badge-red">Inactivo</span>}</td>
                    <td style={{ color: 'var(--gray-500)', fontSize: '.8rem' }}>{new Date(u.created_at).toLocaleDateString('es-AR')}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)} disabled={isCurrentUser(u)}>✏️</button>
                        <button
                          className={`btn btn-sm ${u.active ? 'btn-ghost' : 'btn-success'}`}
                          onClick={() => handleToggleActive(u)}
                          disabled={isCurrentUser(u)}
                        >
                          {u.active ? '🚫' : '✅'}
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
          title={modal === 'create' ? 'Nuevo usuario' : 'Editar usuario'}
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
            <label className="form-label">Nombre de usuario *</label>
            <input className="form-control" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="off" />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">{modal === 'create' ? 'Contraseña *' : 'Contraseña (dejar vacío para no cambiar)'}</label>
            <input type="password" className="form-control" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
          </div>
          <div className="form-group">
            <label className="form-label">Rol</label>
            <select className="form-control" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="operador">Operador</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          {form.role === 'admin' ? (
            <div style={{ marginTop: 8, padding: '10px 14px', background: 'var(--gray-50)', color: 'var(--gray-600)', borderRadius: 8, fontSize: '.85rem' }}>
              Los administradores tienen acceso a todo el sistema.
            </div>
          ) : (
            <div className="form-group" style={{ marginTop: 8 }}>
              <label className="form-label">Acceso a módulos</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.85rem', marginBottom: 10 }}>
                <input type="checkbox" checked={form.permissions === null}
                  onChange={(e) => toggleFullAccess(e.target.checked)} />
                Acceso completo a todos los módulos
              </label>
              {form.permissions !== null && (
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 6,
                  padding: 12, background: 'var(--gray-50)', borderRadius: 8,
                }}>
                  {MODULES.map(m => (
                    <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.82rem' }}>
                      <input type="checkbox" checked={form.permissions.includes(m.key)}
                        onChange={() => toggleModule(m.key)} />
                      {m.icon} {m.label}
                    </label>
                  ))}
                </div>
              )}
              <p style={{ fontSize: '.75rem', color: 'var(--gray-500)', marginTop: 8 }}>
                Ubicaciones y Usuarios son exclusivos de administradores, no se configuran acá.
              </p>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
