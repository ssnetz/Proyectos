import { useState, useEffect } from 'react';
import { useUsuarios } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { MODULES } from '../config/modules';
import Modal from '../components/Modal';

const emptyForm = { username: '', email: '', password: '', role: 'operador', permissions: null };

// Agrupa MODULES por su sección (Escrutinio, Catálogos, ...) preservando el orden
const MODULE_SECTIONS = MODULES.reduce((acc, m) => {
  let sec = acc.find(s => s.name === m.section);
  if (!sec) { sec = { name: m.section, items: [] }; acc.push(sec); }
  sec.items.push(m);
  return acc;
}, []);

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
    setForm({ username: u.usuario, email: u.email || '', password: '', role: u.rol, permissions: u.permissions ?? null });
    setModal(u.id);
    setError('');
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
    const action = u.activo ? 'Desactivar' : 'Activar';
    if (!confirm(`¿${action} al usuario "${u.usuario}"?`)) return;
    try {
      await update(u.id, { username: u.usuario, email: u.email, role: u.rol, permissions: u.permissions, active: u.activo ? 0 : 1 });
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
                  <th>Usuario</th><th>Email</th><th>Rol</th><th>Acceso</th><th>Estado</th><th>Creado</th><th>Acciones</th>
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
                    <td style={{ color: 'var(--gray-500)', fontSize: '.85rem' }}>
                      {u.rol === 'admin' || u.permissions === null
                        ? 'Completo'
                        : `${u.permissions.length} módulo${u.permissions.length === 1 ? '' : 's'}`}
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
                <div style={{ padding: 12, background: 'var(--gray-50)', borderRadius: 8 }}>
                  {MODULE_SECTIONS.map(sec => (
                    <div key={sec.name} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--gray-500)', marginBottom: 4 }}>
                        {sec.name}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 6 }}>
                        {sec.items.map(m => (
                          <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.82rem' }}>
                            <input type="checkbox" checked={form.permissions.includes(m.key)}
                              onChange={() => toggleModule(m.key)} />
                            {m.icon} {m.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
