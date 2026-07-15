import { useState, useEffect } from 'react';
import { useMesas, useEstablecimientos } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const emptyForm = { establecimiento_id: '', numero: '', electores_habilitados: '' };

const actaEstadoBadge = { pendiente: 'badge-yellow', cargada: 'badge-blue', validada: 'badge-green' };

export default function Mesas() {
  const { list, create, update, remove } = useMesas();
  const { list: listEstablecimientos } = useEstablecimientos();
  const { user } = useAuth();
  const isAdmin  = user?.role === 'admin';
  const [mesas, setMesas] = useState([]);
  const [establecimientos, setEstablecimientos] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [modal, setModal]         = useState(null);
  const [form, setForm]           = useState(emptyForm);
  const [saving, setSaving]       = useState(false);
  const [q, setQ]                 = useState('');

  const load = (params) => list(params).then((r) => setMesas(r.data));

  useEffect(() => {
    Promise.all([load(), listEstablecimientos()])
      .then(([, e]) => setEstablecimientos(e.data))
      .catch(() => setError('Error cargando datos'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { load({ q }).catch(() => setError('Error buscando mesas')); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = () => { setForm(emptyForm); setModal('create'); setError(''); };
  const openEdit   = (m) => {
    setForm({
      establecimiento_id: m.establecimiento_id, numero: m.numero,
      electores_habilitados: m.electores_habilitados ?? '',
    });
    setModal(m.id);
    setError('');
  };

  const handleSave = async () => {
    if (!form.establecimiento_id) { setError('Selecciona un establecimiento'); return; }
    if (!form.numero) { setError('El número de mesa es requerido'); return; }

    setSaving(true);
    setError('');
    try {
      if (modal === 'create') { await create(form); notify('Mesa creada'); }
      else { await update(modal, form); notify('Mesa actualizada'); }
      setModal(null);
      await load({ q });
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta mesa?')) return;
    try {
      await remove(id);
      notify('Mesa eliminada');
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
              <input className="form-control" style={{ width: 200 }} placeholder="Buscar por número..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          {isAdmin && <button className="btn btn-primary" onClick={openCreate}>+ Nueva mesa</button>}
        </div>

        {loading ? <div className="spinner" /> : mesas.length === 0 ? (
          <div className="empty"><div className="empty-icon">🪑</div><p>No hay mesas</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Mesa</th><th>Establecimiento</th><th>Electores habilitados</th><th>Padrón</th><th>Acta</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {mesas.map((m) => (
                  <tr key={m.id}>
                    <td><strong>{m.numero}</strong></td>
                    <td>{m.establecimiento_nombre}</td>
                    <td>{m.electores_habilitados}</td>
                    <td><span className="badge badge-gray">{m.electores_count}</span></td>
                    <td>
                      <span className={`badge ${actaEstadoBadge[m.acta_estado] || 'badge-gray'}`}>
                        {m.acta_estado || 'sin cargar'}
                      </span>
                    </td>
                    <td>
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(m)}>✏️</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(m.id)}>🗑️</button>
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
          title={modal === 'create' ? 'Nueva mesa' : 'Editar mesa'}
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
            <label className="form-label">Establecimiento *</label>
            <select className="form-control" value={form.establecimiento_id} onChange={(e) => setForm({ ...form, establecimiento_id: e.target.value })}>
              <option value="">Seleccionar...</option>
              {establecimientos.map((e) => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Número *</label>
              <input className="form-control" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Electores habilitados</label>
              <input type="number" className="form-control" value={form.electores_habilitados} onChange={(e) => setForm({ ...form, electores_habilitados: e.target.value })} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
