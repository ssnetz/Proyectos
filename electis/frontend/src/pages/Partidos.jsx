import { useState, useEffect } from 'react';
import { usePartidos } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const emptyForm = { nombre: '', sigla: '', color: '#2563eb' };

export default function Partidos() {
  const { list, create, update, remove } = usePartidos();
  const { user } = useAuth();
  const isAdmin  = user?.role === 'admin';
  const [partidos, setPartidos] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [modal, setModal]       = useState(null);
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [q, setQ]               = useState('');

  const load = (params) => list(params).then((r) => setPartidos(r.data));

  useEffect(() => {
    load().catch(() => setError('Error cargando partidos')).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { load({ q }).catch(() => setError('Error buscando partidos')); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = () => { setForm(emptyForm); setModal('create'); setError(''); };
  const openEdit   = (p) => { setForm({ nombre: p.nombre, sigla: p.sigla || '', color: p.color || '#2563eb' }); setModal(p.id); setError(''); };

  const handleSave = async () => {
    if (!form.nombre) { setError('El nombre es requerido'); return; }
    setSaving(true);
    setError('');
    try {
      if (modal === 'create') { await create(form); notify('Partido creado'); }
      else { await update(modal, form); notify('Partido actualizado'); }
      setModal(null);
      await load({ q });
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este partido?')) return;
    try {
      await remove(id);
      notify('Partido eliminado');
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
              <input className="form-control" style={{ width: 240 }} placeholder="Buscar por nombre o sigla..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          {isAdmin && <button className="btn btn-primary" onClick={openCreate}>+ Nuevo partido</button>}
        </div>

        {loading ? <div className="spinner" /> : partidos.length === 0 ? (
          <div className="empty"><div className="empty-icon">🚩</div><p>No hay partidos cargados</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Color</th><th>Nombre</th><th>Sigla</th><th>Estado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {partidos.map((p) => (
                  <tr key={p.id}>
                    <td><span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: 4, background: p.color || 'var(--gray-300)' }} /></td>
                    <td><strong>{p.nombre}</strong></td>
                    <td>{p.sigla || '—'}</td>
                    <td>{Number(p.activo) ? <span className="badge badge-green">Activo</span> : <span className="badge badge-red">Inactivo</span>}</td>
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
          title={modal === 'create' ? 'Nuevo partido' : 'Editar partido'}
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
            <input className="form-control" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Sigla</label>
              <input className="form-control" value={form.sigla} onChange={(e) => setForm({ ...form, sigla: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Color</label>
              <input type="color" className="form-control" style={{ padding: 4, height: 38 }} value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
