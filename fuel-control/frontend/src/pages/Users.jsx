import { useEffect, useState } from 'react';
import axios from 'axios';
import { MODULES } from '../config/modules';

const emptyForm = { username: '', password: '', role: 'operator', active: true, permissions: null };

export default function Users() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const load = () =>
    axios.get('/fuel-control/backend/api/users.php').then(r => { setUsers(r.data); setLoading(false); });

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setError(''); setShowForm(true); };
  const openEdit = (u) => {
    setEditing(u.id);
    setForm({ username: u.username, password: '', role: u.role, active: Boolean(u.active), permissions: u.permissions ?? null });
    setError('');
    setShowForm(true);
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

  const generarPin = async (id) => {
    const r = await axios.put(`/fuel-control/backend/api/users.php?id=${id}&action=regenerar_pin`);
    setUsers(us => us.map(u => u.id === id ? { ...u, pin: r.data.pin } : u));
  };

  const quitarPin = async (id) => {
    await axios.put(`/fuel-control/backend/api/users.php?id=${id}&action=quitar_pin`);
    setUsers(us => us.map(u => u.id === id ? { ...u, pin: null } : u));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, permissions: form.role === 'admin' ? null : form.permissions };
      if (editing) {
        await axios.put(`/fuel-control/backend/api/users.php?id=${editing}`, payload);
      } else {
        await axios.post('/fuel-control/backend/api/users.php', payload);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-actions">
        <button className="btn btn-primary" onClick={openNew}>+ Nuevo usuario</button>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Editar usuario' : 'Nuevo usuario'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Usuario *</label>
                  <input className="form-input" required value={form.username}
                    disabled={!!editing}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{editing ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}</label>
                  <input className="form-input" type="password" value={form.password}
                    required={!editing}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Rol</label>
                  <select className="form-input" value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="operator">Operador</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {editing && (
                  <div className="form-group">
                    <label className="form-label">Estado</label>
                    <select className="form-input" value={form.active ? '1' : '0'}
                      onChange={e => setForm(f => ({ ...f, active: e.target.value === '1' }))}>
                      <option value="1">Activo</option>
                      <option value="0">Inactivo</option>
                    </select>
                  </div>
                )}
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
                      onChange={e => toggleFullAccess(e.target.checked)} />
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
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr><th>Usuario</th><th>Rol</th><th>Acceso</th><th>Estado</th><th>PIN Carga con Foto 📷</th><th></th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.username}</strong></td>
                  <td><span className={`badge ${u.role === 'admin' ? 'badge-purple' : 'badge-gray'}`}>{u.role}</span></td>
                  <td>
                    {u.role === 'admin' || u.permissions === null
                      ? <span style={{ color: 'var(--gray-500)', fontSize: '.85rem' }}>Completo</span>
                      : <span style={{ color: 'var(--gray-500)', fontSize: '.85rem' }}>{u.permissions.length} módulo{u.permissions.length === 1 ? '' : 's'}</span>}
                  </td>
                  <td><span className={`badge ${u.active ? 'badge-green' : 'badge-red'}`}>{u.active ? 'Activo' : 'Inactivo'}</span></td>
                  <td>
                    {u.pin ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <code style={{ fontSize: '.95rem', letterSpacing: 1 }}>{u.pin}</code>
                        <button className="btn btn-ghost btn-sm" title="Quitar acceso móvil" onClick={() => quitarPin(u.id)}>Quitar</button>
                      </span>
                    ) : (
                      <button className="btn btn-ghost btn-sm" onClick={() => generarPin(u.id)}>Generar PIN</button>
                    )}
                  </td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
