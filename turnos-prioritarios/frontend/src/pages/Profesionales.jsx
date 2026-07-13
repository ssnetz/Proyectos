import { useState, useEffect } from 'react';
import { useProfesionales } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const emptyForm = { apellidos: '', nombres: '', matricula: '', especialidad: '', domicilio: '', celular: '' };

export default function Profesionales() {
  const { list, create, update, remove } = useProfesionales();
  const { user } = useAuth();
  const isAdmin  = user?.role === 'admin';
  const [profesionales, setProfesionales] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [modal, setModal]         = useState(null);
  const [form, setForm]           = useState(emptyForm);
  const [saving, setSaving]       = useState(false);
  const [q, setQ]                 = useState('');

  const load = (params) => list(params).then((r) => setProfesionales(r.data));

  useEffect(() => {
    load().catch(() => setError('Error cargando profesionales')).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { load({ q }).catch(() => setError('Error buscando profesionales')); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = () => { setForm(emptyForm); setModal('create'); setError(''); };
  const openEdit   = (p) => {
    setForm({
      apellidos: p.apellidos, nombres: p.nombres, matricula: p.matricula,
      especialidad: p.especialidad || '', domicilio: p.domicilio || '', celular: p.celular || '',
    });
    setModal(p.id);
    setError('');
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (modal === 'create') { await create(form); notify('Profesional creado'); }
      else { await update(modal, form); notify('Profesional actualizado'); }
      setModal(null);
      await load({ q });
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este profesional?')) return;
    try {
      await remove(id);
      notify('Profesional eliminado');
      await load({ q });
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
          <div className="filters">
            <div className="search-input">
              <input
                className="form-control"
                style={{ width: 260 }}
                placeholder="Buscar por apellido, matrícula, especialidad..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
          {isAdmin && <button className="btn btn-primary" onClick={openCreate}>+ Nuevo profesional</button>}
        </div>

        {loading ? <div className="spinner" /> : profesionales.length === 0 ? (
          <div className="empty"><div className="empty-icon">🩺</div><p>No hay profesionales</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Apellidos</th><th>Nombres</th><th>Matrícula</th><th>Especialidad</th><th>Celular</th><th>Estado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {profesionales.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.apellidos}</strong></td>
                    <td>{p.nombres}</td>
                    <td>{p.matricula}</td>
                    <td>{p.especialidad || '—'}</td>
                    <td>{p.celular || '—'}</td>
                    <td>
                      {Number(p.activo) ? <span className="badge badge-green">Activo</span> : <span className="badge badge-red">Inactivo</span>}
                    </td>
                    <td>
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>✏️</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(p.id)}>🗑️</button>
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
          title={modal === 'create' ? 'Nuevo profesional' : 'Editar profesional'}
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
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Apellidos *</label>
              <input className="form-control" value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Nombres *</label>
              <input className="form-control" value={form.nombres} onChange={(e) => setForm({ ...form, nombres: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Matrícula *</label>
              <input className="form-control" value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Especialidad</label>
              <input className="form-control" value={form.especialidad} onChange={(e) => setForm({ ...form, especialidad: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Domicilio</label>
            <input className="form-control" value={form.domicilio} onChange={(e) => setForm({ ...form, domicilio: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Celular</label>
            <input className="form-control" value={form.celular} onChange={(e) => setForm({ ...form, celular: e.target.value })} />
          </div>
        </Modal>
      )}
    </div>
  );
}
