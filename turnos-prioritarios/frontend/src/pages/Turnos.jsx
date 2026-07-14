import { useState, useEffect } from 'react';
import { useTurnos, usePersonas, useProfesionales, useInstituciones } from '../hooks/useApi';
import Modal from '../components/Modal';
import { calcularEdad, buildWhatsAppLink } from '../utils';

const emptyForm = {
  persona_id: '', persona_label: '', personaMode: null,
  persona_documento: '', persona_apellidos: '', persona_nombres: '', persona_domicilio: '',
  persona_fecha_nacimiento: '', persona_email: '', persona_celular: '',
  profesional_id: '', institucion_id: '',
  fecha: '', hora: '', motivo: '', prioridad: 'media', estado: 'pendiente', observaciones: '',
  creado_en: '', enviarWhatsapp: true,
};

const prioridadBadge = { alta: 'badge-red', media: 'badge-yellow', baja: 'badge-gray' };
const estadoBadge = { pendiente: 'badge-yellow', confirmado: 'badge-blue', atendido: 'badge-green', cancelado: 'badge-red' };

function WhatsAppIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#25D366" />
      <path
        fill="#fff"
        d="M23.47 8.52A9.9 9.9 0 0 0 16.06 5.5c-5.47 0-9.92 4.45-9.92 9.92 0 1.75.46 3.46 1.33 4.96L6 26.5l6.27-1.64a9.9 9.9 0 0 0 4.74 1.21h.01c5.47 0 9.92-4.45 9.92-9.92a9.86 9.86 0 0 0-2.91-6.63h.44Zm-7.4 15.26h-.01a8.2 8.2 0 0 1-4.2-1.15l-.3-.18-3.72.97 1-3.63-.2-.31a8.22 8.22 0 0 1-1.26-4.38c0-4.55 3.71-8.26 8.27-8.26a8.2 8.2 0 0 1 5.85 2.42 8.2 8.2 0 0 1 2.42 5.85c0 4.55-3.71 8.26-8.27 8.26Zm4.53-6.19c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.78.97-.14.16-.29.18-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.7-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.24-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.4-.42-.56-.42h-.48c-.16 0-.43.06-.66.31-.23.25-.86.84-.86 2.04 0 1.2.88 2.36 1 2.52.12.16 1.73 2.64 4.19 3.7.59.25 1.04.4 1.4.52.59.19 1.12.16 1.54.1.47-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.1-.22-.16-.47-.28Z"
      />
    </svg>
  );
}

function PersonaPicker({ value, onChange, onCreateNew }) {
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
    onChange({
      persona_id: p.id,
      persona_label: `${p.apellidos}, ${p.nombres} (DNI ${p.documento})`,
      personaMode: 'existing',
      persona_documento: p.documento,
      persona_apellidos: p.apellidos,
      persona_nombres: p.nombres,
      persona_domicilio: p.domicilio || '',
      persona_fecha_nacimiento: p.fecha_nacimiento || '',
      persona_email: p.email || '',
      persona_celular: p.celular || '',
    });
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
        onChange={(e) => { setQuery(e.target.value); onChange({ persona_id: '', persona_label: e.target.value, personaMode: null }); setOpen(true); }}
      />
      {open && (
        <div className="card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, padding: 6, marginTop: 4, maxHeight: 260, overflowY: 'auto' }}>
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
          <div
            onClick={() => { onCreateNew(); setOpen(false); }}
            onMouseDown={(e) => e.preventDefault()}
            style={{ padding: '8px 10px', cursor: 'pointer', borderRadius: 6, fontSize: '.875rem', color: 'var(--primary)', borderTop: results.length ? '1px solid var(--gray-200)' : 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--gray-100)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            + No está en la lista: crear persona nueva
          </div>
        </div>
      )}
    </div>
  );
}

export default function Turnos() {
  const { list, create, update, cancel } = useTurnos();
  const { create: createPersona, update: updatePersona } = usePersonas();
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
  const [filterSolicitado, setFilterSolicitado] = useState('');

  const load = () => {
    const params = {};
    if (filterFecha) params.fecha = filterFecha;
    if (filterEstado) params.estado = filterEstado;
    if (filterSolicitado) params.solicitado = filterSolicitado;
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
  }, [filterFecha, filterEstado, filterSolicitado]);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = () => {
    setForm({ ...emptyForm, fecha: filterFecha || today });
    setModal('create');
    setError('');
  };

  const startNewPersona = () => {
    setForm((f) => ({
      ...f,
      persona_id: '', persona_label: '', personaMode: 'new',
      persona_documento: '', persona_apellidos: '', persona_nombres: '', persona_domicilio: '',
      persona_fecha_nacimiento: '', persona_email: '', persona_celular: '',
    }));
  };

  const openEdit = (t) => {
    setForm({
      ...emptyForm,
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
      creado_en: t.created_at || '',
    });
    setModal(t.id);
    setError('');
  };

  const handleSave = async () => {
    if (modal === 'create') {
      if (!form.persona_id && form.personaMode !== 'new') { setError('Selecciona una persona de la lista o creá una nueva'); return; }
      if (form.personaMode === 'new') {
        if (!form.persona_documento) { setError('El documento de la persona es requerido'); return; }
        if (!form.persona_apellidos) { setError('Los apellidos de la persona son requeridos'); return; }
        if (!form.persona_nombres)   { setError('Los nombres de la persona son requeridos'); return; }
      }
      if (!form.persona_fecha_nacimiento) { setError('La fecha de nacimiento de la persona es requerida'); return; }
      if (!form.persona_email)            { setError('El email de la persona es requerido'); return; }
      if (!form.persona_celular)          { setError('El celular/teléfono de la persona es requerido'); return; }
    }
    if (!form.profesional_id) { setError('Selecciona un profesional'); return; }
    if (!form.institucion_id) { setError('Selecciona una institución'); return; }
    if (!form.fecha || !form.hora) { setError('Fecha y hora son requeridas'); return; }

    // Abrimos la pestaña en blanco ya (sincrónico con el clic) para que el
    // navegador no la bloquee como pop-up; recién después de guardar el
    // turno la redirigimos al link de WhatsApp (o la cerramos si falla algo).
    const whatsappTab = (modal === 'create' && form.enviarWhatsapp) ? window.open('', '_blank', 'noopener') : null;

    setSaving(true);
    setError('');
    try {
      let personaId = form.persona_id;

      if (modal === 'create') {
        const personaPayload = {
          documento: form.persona_documento,
          apellidos: form.persona_apellidos,
          nombres: form.persona_nombres,
          domicilio: form.persona_domicilio,
          fecha_nacimiento: form.persona_fecha_nacimiento,
          email: form.persona_email,
          celular: form.persona_celular,
        };
        if (form.personaMode === 'new') {
          const r = await createPersona(personaPayload);
          personaId = r.data.id;
        } else {
          await updatePersona(form.persona_id, personaPayload);
        }
      }

      const turnoPayload = { ...form, persona_id: personaId };
      if (modal === 'create') {
        await create(turnoPayload);
        notify('Turno otorgado');
        if (whatsappTab) {
          const profesional = profesionales.find((p) => String(p.id) === String(form.profesional_id));
          const institucion = instituciones.find((i) => String(i.id) === String(form.institucion_id));
          const fechaFmt = new Date(`${form.fecha}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
          const mensaje = `Hola ${form.persona_nombres}! Te confirmamos tu turno prioritario:\n` +
            `📅 ${fechaFmt} a las ${form.hora}\n` +
            `🩺 ${profesional ? `${profesional.apellidos}, ${profesional.nombres} (${profesional.especialidad})` : ''}\n` +
            `🏥 ${institucion?.nombre || ''}\n\n` +
            `Hospital Cima`;
          const link = buildWhatsAppLink(form.persona_celular, mensaje);
          if (link) whatsappTab.location.href = link;
          else whatsappTab.close();
        }
      } else {
        await update(modal, turnoPayload);
        notify('Turno actualizado');
      }
      setModal(null);
      await load();
    } catch (e) {
      whatsappTab?.close();
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
            <input type="date" className="form-control" style={{ width: 170 }} value={filterFecha} onChange={(e) => setFilterFecha(e.target.value)} title="Fecha del turno" />
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
            <span style={{ fontSize: '.8rem', color: 'var(--gray-500)', marginLeft: 8 }}>Solicitado el:</span>
            <input
              type="date" className="form-control" style={{ width: 170 }}
              value={filterSolicitado}
              onChange={(e) => setFilterSolicitado(e.target.value)}
              title="Fecha en que se solicitó el turno (independiente de la fecha del turno)"
            />
            {filterSolicitado && (
              <button className="btn btn-ghost btn-sm" onClick={() => setFilterSolicitado('')}>Quitar filtro de solicitud</button>
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
                  <th>Fecha</th><th>Hora</th><th>Solicitado</th><th>Persona</th><th>Profesional</th><th>Institución</th>
                  <th>Prioridad</th><th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {turnos.map((t) => {
                  const fechaSolicitud = t.created_at?.slice(0, 10);
                  const esDiferido = fechaSolicitud && fechaSolicitud !== t.fecha;
                  return (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{t.fecha}</td>
                    <td>{t.hora?.slice(0, 5)}</td>
                    <td style={{ whiteSpace: 'nowrap', color: esDiferido ? 'var(--warning)' : 'var(--gray-400)' }} title={esDiferido ? 'Turno diferido: pedido en una fecha, agendado para otra' : ''}>
                      {fechaSolicitud || '—'}
                    </td>
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
                  );
                })}
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

          <div className="form-group" style={{ fontSize: '.8rem', color: 'var(--gray-500)' }}>
            Solicitado el: {modal === 'create' ? new Date().toLocaleDateString('es-AR') : (form.creado_en ? new Date(form.creado_en).toLocaleDateString('es-AR') : '—')}
          </div>

          <div className="form-group">
            <label className="form-label">Persona *</label>
            <PersonaPicker value={form} onChange={(v) => setForm({ ...form, ...v })} onCreateNew={startNewPersona} />
          </div>

          {modal === 'create' && form.personaMode && (
            <div className="card" style={{ padding: 12, marginBottom: 16, background: 'var(--gray-50)' }}>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '.875rem' }}>
                {form.personaMode === 'new' ? 'Nueva persona' : 'Confirmar / actualizar datos de contacto'}
              </div>

              {form.personaMode === 'new' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Documento *</label>
                    <input className="form-control" value={form.persona_documento} onChange={(e) => setForm({ ...form, persona_documento: e.target.value })} />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Apellidos *</label>
                      <input className="form-control" value={form.persona_apellidos} onChange={(e) => setForm({ ...form, persona_apellidos: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Nombres *</label>
                      <input className="form-control" value={form.persona_nombres} onChange={(e) => setForm({ ...form, persona_nombres: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Domicilio</label>
                    <input className="form-control" value={form.persona_domicilio} onChange={(e) => setForm({ ...form, persona_domicilio: e.target.value })} />
                  </div>
                </>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Fecha de nacimiento *</label>
                  <input
                    type="date" className="form-control"
                    value={form.persona_fecha_nacimiento}
                    onChange={(e) => setForm({ ...form, persona_fecha_nacimiento: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Edad</label>
                  <input className="form-control" value={calcularEdad(form.persona_fecha_nacimiento) ?? '—'} disabled />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input
                    type="email" className="form-control"
                    value={form.persona_email}
                    onChange={(e) => setForm({ ...form, persona_email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Celular / Teléfono *</label>
                  <input
                    className="form-control"
                    placeholder="Ej: 261 500-0001 (sin 0 ni 15)"
                    value={form.persona_celular}
                    onChange={(e) => setForm({ ...form, persona_celular: e.target.value })}
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, cursor: 'pointer', fontSize: '.875rem' }}>
                <input
                  type="checkbox"
                  checked={form.enviarWhatsapp}
                  onChange={(e) => setForm({ ...form, enviarWhatsapp: e.target.checked })}
                />
                <WhatsAppIcon />
                Enviar confirmación de turno por WhatsApp al celular al guardar
              </label>
            </div>
          )}

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
