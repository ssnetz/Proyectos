import { useState, useEffect } from 'react';
import { useListas, usePartidos, useCargos } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const emptyForm = { partido_id: '', cargo_id: '', numero: '', nombre: '' };

export default function Listas() {
  const { list, create, update, remove } = useListas();
  const { list: listPartidos } = usePartidos();
  const { list: listCargos } = useCargos();
  const { user } = useAuth();
  const isAdmin  = user?.role === 'admin';

  const [listas, setListas] = useState([]);
  const [partidos, setPartidos] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [modal, setModal]       = useState(null);
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [filterCargo, setFilterCargo] = useState('');

  const load = (params) => list(params).then((r) => setListas(r.data));

  useEffect(() => {
    Promise.all([listPartidos(), listCargos()])
      .then(([p, c]) => { setPartidos(p.data); setCargos(c.data); })
      .catch(() => setError('Error cargando datos base'));
  }, []);

  useEffect(() => {
    setLoading(true);
    load(filterCargo ? { cargo_id: filterCargo } : {})
      .catch(() => setError('Error cargando listas'))
      .finally(() => setLoading(false));
  }, [filterCargo]);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = () => { setForm({ ...emptyForm, cargo_id: filterCargo || '' }); setModal('create'); setError(''); };
  const openEdit   = (l) => {
    setForm({ partido_id: l.partido_id, cargo_id: l.cargo_id, numero: l.numero, nombre: l.nombre || '' });
    setModal(l.id);
    setError('');
  };

  const handleSave = async () => {
    if (!form.partido_id) { setError('Selecciona un partido'); return; }
    if (!form.cargo_id) { setError('Selecciona un cargo'); return; }
    if (!form.numero) { setError('El número de lista es requerido'); return; }

    setSaving(true);
    setError('');
    try {
      if (modal === 'create') { await create(form); notify('Lista creada'); }
      else { await update(modal, form); notify('Lista actualizada'); }
      setModal(null);
      await load(filterCargo ? { cargo_id: filterCargo } : {});
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta lista?')) return;
    try {
      await remove(id);
      notify('Lista eliminada');
      await load(filterCargo ? { cargo_id: filterCargo } : {});
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
            <select className="form-control" style={{ width: 200 }} value={filterCargo} onChange={(e) => setFilterCargo(e.target.value)}>
              <option value="">Todos los cargos</option>
              {cargos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          {isAdmin && <button className="btn btn-primary" onClick={openCreate}>+ Nueva lista</button>}
        </div>

        {loading ? <div className="spinner" /> : listas.length === 0 ? (
          <div className="empty"><div className="empty-icon">📋</div><p>No hay listas cargadas</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>N°</th><th>Partido</th><th>Cargo</th><th>Nombre</th><th>Candidatos</th><th>Estado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {listas.map((l) => (
                  <tr key={l.id}>
                    <td><strong>{l.numero}</strong></td>
                    <td>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: l.partido_color || 'var(--gray-300)', marginRight: 6 }} />
                      {l.partido_nombre}
                    </td>
                    <td>{l.cargo_nombre}</td>
                    <td style={{ color: 'var(--gray-500)' }}>{l.nombre || '—'}</td>
                    <td><span className="badge badge-blue">{l.candidatos_count}</span></td>
                    <td>{Number(l.activo) ? <span className="badge badge-green">Activa</span> : <span className="badge badge-red">Inactiva</span>}</td>
                    <td>
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(l)}>✏️</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(l.id)}>🗑️</button>
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
          title={modal === 'create' ? 'Nueva lista' : 'Editar lista'}
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
              <label className="form-label">Partido *</label>
              <select className="form-control" value={form.partido_id} onChange={(e) => setForm({ ...form, partido_id: e.target.value })}>
                <option value="">Seleccionar...</option>
                {partidos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Cargo *</label>
              <select className="form-control" value={form.cargo_id} onChange={(e) => setForm({ ...form, cargo_id: e.target.value })}>
                <option value="">Seleccionar...</option>
                {cargos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Número *</label>
              <input className="form-control" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Nombre de fantasía</label>
              <input className="form-control" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
