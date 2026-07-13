import { useState, useEffect } from 'react';
import { useTurnos, usePersonas, useProfesionales, useInstituciones } from '../hooks/useApi';
import Modal from '../components/Modal';

const emptyForm = {
  persona_id: '', persona_label: '',
  profesional_id: '', institucion_id: '',
  fecha: '', hora: '', motivo: '', prioridad: 'media', estado: 'pendiente', observaciones: '',
};

const prioridadBadge = { alta: 'badge-red', media: 'badge-yellow', baja: 'badge-gray' };
const estadoBadge = { pendiente: 'badge-yellow', confirmado: 'badge-blue', atendido: 'badge-green', cancelado: 'badge-red' };

function PersonaPicker({ value, onChange }) {
  const { list } = usePersonas();
  const [query, setQuery] = useState(value.persona_label || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => { setQuery(value.persona_label || ''); }, [value.persona_label]);

  useEffect(() => {
    if (!open || query.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      list({ q: query }).then((r) => setResults(r.data)).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [query, open]);

  const pick = (p) => {
    onChange({ persona_id: p.id, persona_label: `${p.apellidos}, ${p.nombres} (DNI ${p.documento})` });
    setQuery(`${p.apellidos}, ${p.nombres} (DNI ${p.documento})`);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="form-control"
        placeholder="Buscar por documento, apellido o nombre..."
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); onChange({ persona_id: '', persona_label: e.target.value }); setOpen(true); }}
      />
      {open && results.length > 0 && (
        <div className="card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, padding: 6, marginTop: 4, maxHeight: 220, overflowY: 'auto' }}>
          {results.map((p) => (
            <div
              key={p.id}
              onClick={() => pick(p)}
              style={{ padding: '8px 10px', cursor: 'pointer', borderRadius: 6, fontSize: '.875rem' }}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--gray-100)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <strong>{p.apellidos}, {p.nombres}</strong> — DNI {p.documento}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Turnos() {
  const { list, create, update, cancel } = useTurnos();
  const { list: listProfesionales } = useProfesionales();
  const { list: listInstituciones } = useInstituciones();

  const [turnos, setTurnos] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [instituciones, setInstituciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [modal, setModal]     = useState(null);
  const [form, setForm]       = useState(emptyForm);
  const [saving, setSaving]   = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const [filterFecha, setFilterFecha] = useState(today);
  const [filterEstado, setFilterEstado] = useState('');

  const load = () => {
    const params = {};
    if (filterFecha) params.fecha = filterFecha;
    if (filterEstado) params.estado = filterEstado;
    return list(params).then((r) => setTurnos(r.data));
  };

  useEffect(() => {
    Promise.all([listProfesionales(), listInstituciones()])
      .then(([p, i]) => { setProfesionales(p.data); setInstituciones(i.data); })
      .catch(() => setError('Error cargando datos base'));
  }, []);

  useEffect(() => {
    setLoading(true);
    load().catch(() => setError('Error cargando turnos')).finally(() => setLoading(false));
  }, [filterFecha, filterEstado]);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = () => {
    setForm({ ...emptyForm, fecha: filterFecha || today });
    setModal('create');
    setError('');
  };

  const openEdit = (t) => {
    setForm({
      persona_id: t.persona_id,
      persona_label: t.persona_apellidos ? `${t.persona_apellidos}, ${t.persona_nombres} (DNI ${t.persona_documento})` : '',
      profesional_id: t.profesional_id,
      institucion_id: t.institucion_id,
      fecha: t.fecha,
      hora: t.hora?.slice(0, 5) || '',
      motivo: t.motivo || '',
      prioridad: t.prioridad,
      estado: t.estado,
      observaciones: t.observaciones || '',
    });
    setModal(t.id);
    setError('');
  };

  const handleSave = async () => {
    if (!form.persona_id) { setError('Selecciona una persona de la lista'); return; }
    if (!form.profesional_id) { setError('Selecciona un profesional'); return; }
    if (!form.institucion_id) { setError('Selecciona una institución'); return; }
    if (!form.fecha || !form.hora) { setError('Fecha y hora son requeridas'); return; }

    setSaving(true);
    setError('');
    try {
      if (modal === 'create') { await create(form); notify('Turno otorgado'); }
      else { await update(modal, form); notify('Turno actualizado'); }
      setModal(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id) => {
    if (!confirm('¿Cancelar este turno?')) return;
    try {
      await cancel(id);
      notify('Turno cancelado');
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al cancelar');
    }
  };

  return (
    <div>
      {error   && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="table-actions">
          <div className="filters">
            <input type="date" className="form-control" style={{ width: 170 }} value={filterFecha} onChange={(e) => setFilterFecha(e.target.value)} />
            <select className="form-control" style={{ width: 160 }} value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="confirmado">Confirmado</option>
              <option value="atendido">Atendido</option>
              <option value="cancelado">Cancelado</option>
            </select>
            {filterFecha && (
              <button className="btn btn-ghost btn-sm" onClick={() => setFilterFecha('')}>Ver todas las fechas</button>
            )}
          </div>
          <button className="btn btn-primary" onClick={openCreate}>+ Nuevo turno</button>
        </div>

        {loading ? <div className="spinner" /> : turnos.length === 0 ? (
          <div className="empty"><div className="empty-icon">📅</div><p>No hay turnos para los filtros seleccionados</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th><th>Hora</th><th>Persona</th><th>Profesional</th><th>Institución</th>
                  <th>Prioridad</th><th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {turnos.map((t) => (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{t.fecha}</td>
                    <td>{t.hora?.slice(0, 5)}</td>
                    <td>{t.persona_apellidos ? `${t.persona_apellidos}, ${t.persona_nombres}` : '—'}</td>
                    <td>{t.profesional_apellidos}, {t.profesional_nombres}<div style={{ fontSize: '.75rem', color: 'var(--gray-400)' }}>{t.profesional_especialidad}</div></td>
                    <td>{t.institucion_nombre}</td>
                    <td><span className={`badge ${prioridadBadge[t.prioridad]}`}>{t.prioridad}</span></td>
                    <td><span className={`badge ${estadoBadge[t.estado]}`}>{t.estado}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)}>✏️</button>
                        {t.estado !== 'cancelado' && (
                          <button className="btn btn-ghost btn-sm" onClick={() => handleCancel(t.id)}>🚫</button>
                        )}
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
          size="modal-lg"
          title={modal === 'create' ? 'Nuevo turno prioritario' : 'Editar turno'}
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
            <label className="form-label">Persona *</label>
            <PersonaPicker value={form} onChange={(v) => setForm({ ...form, ...v })} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Profesional *</label>
              <select className="form-control" value={form.profesional_id} onChange={(e) => setForm({ ...form, profesional_id: e.target.value })}>
                <option value="">Seleccionar...</option>
                {profesionales.map((p) => (
                  <option key={p.id} value={p.id}>{p.apellidos}, {p.nombres} — {p.especialidad}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Institución *</label>
              <select className="form-control" value={form.institucion_id} onChange={(e) => setForm({ ...form, institucion_id: e.target.value })}>
                <option value="">Seleccionar...</option>
                {instituciones.map((i) => (
                  <option key={i.id} value={i.id}>{i.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Fecha *</label>
              <input type="date" className="form-control" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Hora *</label>
              <input type="time" className="form-control" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Prioridad</label>
              <select className="form-control" value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value })}>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
            {modal !== 'create' && (
              <div className="form-group">
                <label className="form-label">Estado</label>
                <select className="form-control" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                  <option value="pendiente">Pendiente</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="atendido">Atendido</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Motivo</label>
            <input className="form-control" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Observaciones</label>
            <textarea className="form-control" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
          </div>
        </Modal>
      )}
    </div>
  );
}
