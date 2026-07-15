import { useState, useEffect } from 'react';
import { useCandidatos, useListas } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const emptyForm = { lista_id: '', orden: '', apellidos: '', nombres: '', documento: '', titular: true };

export default function Candidatos() {
  const { list, create, update, remove } = useCandidatos();
  const { list: listListas } = useListas();
  const { user } = useAuth();
  const isAdmin  = user?.role === 'admin';

  const [candidatos, setCandidatos] = useState([]);
  const [listas, setListas] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [modal, setModal]       = useState(null);
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [filterLista, setFilterLista] = useState('');

  const load = (params) => list(params).then((r) => setCandidatos(r.data));

  useEffect(() => {
    listListas()
      .then((r) => setListas(r.data))
      .catch(() => setError('Error cargando listas'));
  }, []);

  useEffect(() => {
    setLoading(true);
    load(filterLista ? { lista_id: filterLista } : {})
      .catch(() => setError('Error cargando candidatos'))
      .finally(() => setLoading(false));
  }, [filterLista]);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = () => { setForm({ ...emptyForm, lista_id: filterLista || '' }); setModal('create'); setError(''); };
  const openEdit   = (c) => {
    setForm({
      lista_id: c.lista_id, orden: c.orden, apellidos: c.apellidos, nombres: c.nombres,
      documento: c.documento || '', titular: !!Number(c.titular),
    });
    setModal(c.id);
    setError('');
  };

  const handleSave = async () => {
    if (!form.lista_id) { setError('Selecciona una lista'); return; }
    if (form.orden === '') { setError('El orden en la lista es requerido'); return; }
    if (!form.apellidos || !form.nombres) { setError('Apellidos y nombres son requeridos'); return; }

    setSaving(true);
    setError('');
    try {
      if (modal === 'create') { await create(form); notify('Candidato creado'); }
      else { await update(modal, form); notify('Candidato actualizado'); }
      setModal(null);
      await load(filterLista ? { lista_id: filterLista } : {});
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este candidato?')) return;
    try {
      await remove(id);
      notify('Candidato eliminado');
      await load(filterLista ? { lista_id: filterLista } : {});
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
            <select className="form-control" style={{ width: 280 }} value={filterLista} onChange={(e) => setFilterLista(e.target.value)}>
              <option value="">Todas las listas</option>
              {listas.map((l) => (
                <option key={l.id} value={l.id}>Lista {l.numero} — {l.partido_nombre} ({l.cargo_nombre})</option>
              ))}
            </select>
          </div>
          {isAdmin && <button className="btn btn-primary" onClick={openCreate}>+ Nuevo candidato</button>}
        </div>

        {loading ? <div className="spinner" /> : candidatos.length === 0 ? (
          <div className="empty"><div className="empty-icon">🎖️</div><p>No hay candidatos cargados</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Orden</th><th>Apellidos</th><th>Nombres</th><th>DNI</th><th>Lista</th><th>Tipo</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {candidatos.map((c) => (
                  <tr key={c.id}>
                    <td>{c.orden}</td>
                    <td><strong>{c.apellidos}</strong></td>
                    <td>{c.nombres}</td>
                    <td style={{ color: 'var(--gray-500)' }}>{c.documento || '—'}</td>
                    <td>Lista {c.lista_numero} — {c.partido_nombre}<div style={{ fontSize: '.75rem', color: 'var(--gray-400)' }}>{c.cargo_nombre}</div></td>
                    <td>{Number(c.titular) ? <span className="badge badge-blue">Titular</span> : <span className="badge badge-gray">Suplente</span>}</td>
                    <td>
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>✏️</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(c.id)}>🗑️</button>
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
          title={modal === 'create' ? 'Nuevo candidato' : 'Editar candidato'}
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
            <label className="form-label">Lista *</label>
            <select className="form-control" value={form.lista_id} onChange={(e) => setForm({ ...form, lista_id: e.target.value })}>
              <option value="">Seleccionar...</option>
              {listas.map((l) => (
                <option key={l.id} value={l.id}>Lista {l.numero} — {l.partido_nombre} ({l.cargo_nombre})</option>
              ))}
            </select>
          </div>
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
              <label className="form-label">Documento</label>
              <input className="form-control" value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Orden en la lista *</label>
              <input type="number" min="1" className="form-control" value={form.orden} onChange={(e) => setForm({ ...form, orden: e.target.value })} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '.875rem' }}>
            <input type="checkbox" checked={form.titular} onChange={(e) => setForm({ ...form, titular: e.target.checked })} />
            Candidato titular (desmarcar para suplente)
          </label>
        </Modal>
      )}
    </div>
  );
}
