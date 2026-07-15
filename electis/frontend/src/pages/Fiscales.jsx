import { useState, useEffect } from 'react';
import { useFiscales, usePartidos, useMesas } from '../hooks/useApi';
import Modal from '../components/Modal';

const emptyForm = { apellidos: '', nombres: '', documento: '', celular: '', partido_id: '', mesa_id: '', tipo: 'mesa' };

export default function Fiscales() {
  const { list, create, update, remove } = useFiscales();
  const { list: listPartidos } = usePartidos();
  const { list: listMesas } = useMesas();

  const [fiscales, setFiscales] = useState([]);
  const [partidos, setPartidos] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [modal, setModal]       = useState(null);
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [q, setQ]               = useState('');

  const load = (params) => list(params).then((r) => setFiscales(r.data));

  useEffect(() => {
    Promise.all([load(), listPartidos(), listMesas()])
      .then(([, p, m]) => { setPartidos(p.data); setMesas(m.data); })
      .catch(() => setError('Error cargando datos'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { load({ q }).catch(() => setError('Error buscando fiscales')); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = () => { setForm(emptyForm); setModal('create'); setError(''); };
  const openEdit   = (f) => {
    setForm({
      apellidos: f.apellidos, nombres: f.nombres, documento: f.documento, celular: f.celular || '',
      partido_id: f.partido_id || '', mesa_id: f.mesa_id || '', tipo: f.tipo,
    });
    setModal(f.id);
    setError('');
  };

  const handleSave = async () => {
    if (!form.apellidos || !form.nombres) { setError('Apellidos y nombres son requeridos'); return; }
    if (!form.documento) { setError('El documento es requerido'); return; }

    setSaving(true);
    setError('');
    try {
      if (modal === 'create') { await create(form); notify('Fiscal creado'); }
      else { await update(modal, form); notify('Fiscal actualizado'); }
      setModal(null);
      await load({ q });
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este fiscal?')) return;
    try {
      await remove(id);
      notify('Fiscal eliminado');
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
              <input className="form-control" style={{ width: 260 }} placeholder="Buscar por documento, apellido o nombre..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>+ Nuevo fiscal</button>
        </div>

        {loading ? <div className="spinner" /> : fiscales.length === 0 ? (
          <div className="empty"><div className="empty-icon">🕵️</div><p>No hay fiscales cargados</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Apellidos</th><th>Nombres</th><th>DNI</th><th>Celular</th><th>Partido</th><th>Mesa</th><th>Tipo</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {fiscales.map((f) => (
                  <tr key={f.id}>
                    <td><strong>{f.apellidos}</strong></td>
                    <td>{f.nombres}</td>
                    <td>{f.documento}</td>
                    <td style={{ color: 'var(--gray-500)' }}>{f.celular || '—'}</td>
                    <td>{f.partido_nombre || '—'}</td>
                    <td>{f.mesa_numero ? <span className="badge badge-blue">{f.mesa_numero}</span> : '—'}</td>
                    <td>{f.tipo === 'general' ? <span className="badge badge-purple">General</span> : <span className="badge badge-gray">Mesa</span>}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(f)}>✏️</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(f.id)}>🗑️</button>
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
          title={modal === 'create' ? 'Nuevo fiscal' : 'Editar fiscal'}
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
              <label className="form-label">Documento *</label>
              <input className="form-control" value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Celular</label>
              <input className="form-control" value={form.celular} onChange={(e) => setForm({ ...form, celular: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Partido</label>
              <select className="form-control" value={form.partido_id} onChange={(e) => setForm({ ...form, partido_id: e.target.value })}>
                <option value="">Sin partido</option>
                {partidos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-control" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                <option value="mesa">De mesa</option>
                <option value="general">General</option>
              </select>
            </div>
          </div>
          {form.tipo === 'mesa' && (
            <div className="form-group">
              <label className="form-label">Mesa asignada</label>
              <select className="form-control" value={form.mesa_id} onChange={(e) => setForm({ ...form, mesa_id: e.target.value })}>
                <option value="">Sin asignar</option>
                {mesas.map((m) => <option key={m.id} value={m.id}>Mesa {m.numero} — {m.establecimiento_nombre}</option>)}
              </select>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
