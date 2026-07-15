import { useState, useEffect } from 'react';
import { useUsuarios } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const emptyForm = { username: '', email: '', password: '', role: 'operador' };

export default function Usuarios() {
  const { list, create, update } = useUsuarios();
  const { user: currentUser } = useAuth();

  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [modal, setModal]   = useState(null); // null | 'create' | userId
  const [form, setForm]     = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => list().then((r) => setUsuarios(r.data));

  useEffect(() => {
    load().catch(() => setError('Error cargando usuarios')).finally(() => setLoading(false));
  }, []);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = () => { setForm(emptyForm); setModal('create'); setError(''); };

  const openEdit = (u) => {
    setForm({ username: u.usuario, email: u.email || '', password: '', role: u.rol });
    setModal(u.id);
    setError('');
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (modal === 'create') { await create(form); notify('Usuario creado'); }
      else { await update(modal, form); notify('Usuario actualizado'); }
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
    const action = u.activo ? 'Desactivar' : 'Activar';
    if (!confirm(`¿${action} al usuario "${u.usuario}"?`)) return;
    try {
      await update(u.id, { username: u.usuario, email: u.email, role: u.rol, active: u.activo ? 0 : 1 });
      notify(`Usuario ${u.activo ? 'desactivado' : 'activado'}`);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al actualizar usuario');
    }
  };

  const isCurrentUser = (u) => u.id === currentUser?.id;

  return (
    <div>
      {error   && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="table-actions">
          <div />
          <button className="btn btn-primary" onClick={openCreate}>+ Nuevo usuario</button>
        </div>

        {loading ? (
          <div className="spinner" />
        ) : usuarios.length === 0 ? (
          <div className="empty"><div className="empty-icon">👤</div><p>No hay usuarios</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th><th>Email</th><th>Rol</th><th>Estado</th><th>Creado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.usuario}</strong>
                      {isCurrentUser(u) && <span className="badge badge-blue" style={{ marginLeft: 8, fontSize: '.7rem' }}>yo</span>}
                    </td>
                    <td style={{ color: 'var(--gray-500)' }}>{u.email || '—'}</td>
                    <td>
                      {u.rol === 'admin' ? <span className="badge badge-purple">admin</span> : <span className="badge badge-gray">operador</span>}
                    </td>
                    <td>
                      {Number(u.activo) ? <span className="badge badge-green">Activo</span> : <span className="badge badge-red">Inactivo</span>}
                    </td>
                    <td style={{ color: 'var(--gray-500)', fontSize: '.8rem' }}>
                      {new Date(u.created_at).toLocaleDateString('es-AR')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => openEdit(u)}
                          disabled={isCurrentUser(u)}
                          title={isCurrentUser(u) ? 'No puedes editar tu propio usuario' : 'Editar'}
                        >
                          ✏️
                        </button>
                        <button
                          className={`btn btn-sm ${u.activo ? 'btn-ghost' : 'btn-success'}`}
                          onClick={() => handleToggleActive(u)}
                          disabled={isCurrentUser(u)}
                          title={isCurrentUser(u) ? 'No puedes modificar tu propio usuario' : (u.activo ? 'Desactivar' : 'Activar')}
                        >
                          {u.activo ? '🚫' : '✅'}
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
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          }
        >
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="form-group">
            <label className="form-label">Usuario *</label>
            <input className="form-control" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="off" />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">
              {modal === 'create' ? 'Contraseña *' : 'Contraseña (dejar en blanco para no cambiar)'}
            </label>
            <input type="password" className="form-control" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
          </div>
          <div className="form-group">
            <label className="form-label">Rol</label>
            <select className="form-control" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="operador">Operador</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </Modal>
      )}
    </div>
  );
}
