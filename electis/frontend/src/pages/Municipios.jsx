import { useState, useEffect } from 'react';
import { useMunicipios } from '../hooks/useApi';
import Modal from '../components/Modal';

const emptyForm = { nombre: '', provincia: '', seccion_electoral: '' };

export default function Municipios() {
  const { list, create, update } = useMunicipios();
  const [municipios, setMunicipios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [modal, setModal]     = useState(null); // null | 'create' | municipioId
  const [form, setForm]       = useState(emptyForm);
  const [saving, setSaving]   = useState(false);

  const load = () => list().then((r) => setMunicipios(r.data));

  useEffect(() => {
    load().catch(() => setError('Error cargando municipios')).finally(() => setLoading(false));
  }, []);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = () => { setForm(emptyForm); setModal('create'); setError(''); };
  const openEdit   = (m) => {
    setForm({ nombre: m.nombre, provincia: m.provincia || '', seccion_electoral: m.seccion_electoral || '' });
    setModal(m.id);
    setError('');
  };

  const handleSave = async () => {
    if (!form.nombre) { setError('El nombre es requerido'); return; }
    setSaving(true);
    setError('');
    try {
      if (modal === 'create') { await create(form); notify('Municipio creado'); }
      else { await update(modal, form); notify('Municipio actualizado'); }
      setModal(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (m) => {
    const action = Number(m.activo) ? 'Desactivar' : 'Activar';
    if (!confirm(`¿${action} el municipio "${m.nombre}"?`)) return;
    try {
      await update(m.id, { nombre: m.nombre, provincia: m.provincia, seccion_electoral: m.seccion_electoral, activo: Number(m.activo) ? 0 : 1 });
      notify(`Municipio ${Number(m.activo) ? 'desactivado' : 'activado'}`);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al actualizar municipio');
    }
  };

  return (
    <div>
      {error   && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="table-actions">
          <div />
          <button className="btn btn-primary" onClick={openCreate}>+ Nuevo municipio</button>
        </div>

        {loading ? <div className="spinner" /> : municipios.length === 0 ? (
          <div className="empty"><div className="empty-icon">🏙️</div><p>No hay municipios cargados</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Nombre</th><th>Provincia</th><th>Sección electoral</th><th>Estado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {municipios.map((m) => (
                  <tr key={m.id}>
                    <td><strong>{m.nombre}</strong></td>
                    <td style={{ color: 'var(--gray-500)' }}>{m.provincia || '—'}</td>
                    <td style={{ color: 'var(--gray-500)' }}>{m.seccion_electoral || '—'}</td>
                    <td>{Number(m.activo) ? <span className="badge badge-green">Activo</span> : <span className="badge badge-red">Inactivo</span>}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(m)}>✏️</button>
                        <button
                          className={`btn btn-sm ${Number(m.activo) ? 'btn-ghost' : 'btn-success'}`}
                          onClick={() => handleToggleActive(m)}
                          title={Number(m.activo) ? 'Desactivar' : 'Activar'}
                        >
                          {Number(m.activo) ? '🚫' : '✅'}
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
          title={modal === 'create' ? 'Nuevo municipio' : 'Editar municipio'}
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
            <input className="form-control" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Cosquín" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Provincia</label>
              <input className="form-control" value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} placeholder="Ej: Córdoba" />
            </div>
            <div className="form-group">
              <label className="form-label">Sección electoral</label>
              <input className="form-control" value={form.seccion_electoral} onChange={(e) => setForm({ ...form, seccion_electoral: e.target.value })} placeholder="Ej: 12-Punilla" />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
