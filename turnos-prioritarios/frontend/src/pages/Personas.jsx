import { useState, useEffect } from 'react';
import { usePersonas } from '../hooks/useApi';
import Modal from '../components/Modal';

const emptyForm = { documento: '', apellidos: '', nombres: '', domicilio: '' };

export default function Personas() {
  const { list, create, update } = usePersonas();
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [modal, setModal]       = useState(null);
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [q, setQ]               = useState('');

  const load = (params) => list(params).then((r) => setPersonas(r.data));

  useEffect(() => {
    load().catch(() => setError('Error cargando personas')).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { load({ q }).catch(() => setError('Error buscando personas')); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = () => { setForm(emptyForm); setModal('create'); setError(''); };
  const openEdit   = (p) => {
    setForm({ documento: p.documento, apellidos: p.apellidos, nombres: p.nombres, domicilio: p.domicilio || '' });
    setModal(p.id);
    setError('');
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (modal === 'create') { await create(form); notify('Persona creada'); }
      else { await update(modal, form); notify('Persona actualizada'); }
      setModal(null);
      await load({ q });
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
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
                placeholder="Buscar por documento, apellido o nombre..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>+ Nueva persona</button>
        </div>

        {loading ? <div className="spinner" /> : personas.length === 0 ? (
          <div className="empty"><div className="empty-icon">🧑</div><p>No hay personas registradas</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Documento</th><th>Apellidos</th><th>Nombres</th><th>Domicilio</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {personas.map((p) => (
                  <tr key={p.id}>
                    <td>{p.documento}</td>
                    <td><strong>{p.apellidos}</strong></td>
                    <td>{p.nombres}</td>
                    <td style={{ color: 'var(--gray-500)' }}>{p.domicilio || '—'}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>✏️</button>
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
          title={modal === 'create' ? 'Nueva persona' : 'Editar persona'}
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
            <label className="form-label">Documento *</label>
            <input className="form-control" value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} />
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
          <div className="form-group">
            <label className="form-label">Domicilio</label>
            <input className="form-control" value={form.domicilio} onChange={(e) => setForm({ ...form, domicilio: e.target.value })} />
          </div>
        </Modal>
      )}
    </div>
  );
}
