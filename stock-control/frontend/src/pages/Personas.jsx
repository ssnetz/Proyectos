import { useState, useEffect, useCallback } from 'react';
import { usePersonas } from '../hooks/useApi';
import Modal from '../components/Modal';

const TIPO_DOC = { '1': 'DNI', '2': 'CUIL', '3': 'CUIT', '4': 'Pasaporte', '5': 'LC', '6': 'LE' };
const SEXO = { M: 'Masculino', F: 'Femenino', X: 'Otro' };

const emptyForm = {
  tipo_documento: '1', documento: '', apellido: '', nombre: '', sexo: '',
  calle: '', numeracion: '', departamento: '', piso: '', barrio: '', cuit_cuil: '',
};

export default function Personas() {
  const api = usePersonas();

  const [personas, setPersonas]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [search, setSearch]       = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const [modalId, setModalId] = useState(null);
  const [form, setForm]       = useState(emptyForm);
  const [saving, setSaving]   = useState(false);

  const load = useCallback(() =>
    api.list({ search, active_only: showInactive ? '0' : '1' }).then((r) => setPersonas(r.data)),
  [search, showInactive]);

  useEffect(() => {
    load().catch(() => setError('Error cargando personas')).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading) load().catch(() => {});
  }, [search, showInactive]);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = () => { setForm(emptyForm); setError(''); setModalId('create'); };
  const openEdit   = (p) => {
    setError('');
    setForm({
      tipo_documento: p.tipo_documento ?? '1',
      documento: p.documento,
      apellido:  p.apellido,
      nombre:    p.nombre    ?? '',
      sexo:      p.sexo      ?? '',
      calle:     p.calle     ?? '',
      numeracion:p.numeracion?? '',
      departamento: p.departamento ?? '',
      piso:      p.piso      ?? '',
      barrio:    p.barrio    ?? '',
      cuit_cuil: p.cuit_cuil ?? '',
    });
    setModalId(p.id);
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      if (modalId === 'create') {
        await api.create(form);
        notify('Persona creada correctamente');
      } else {
        await api.update(modalId, form);
        notify('Persona actualizada');
      }
      setModalId(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const handleDeactivate = async (p) => {
    if (!confirm(`¿Desactivar a ${p.apellido} ${p.nombre || ''}?`)) return;
    try {
      await api.remove(p.id);
      notify('Persona desactivada');
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al desactivar');
    }
  };

  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      {error   && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="table-actions">
          <div className="filters">
            <input
              className="form-control" placeholder="Buscar por documento, apellido o nombre..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ width: 300 }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.875rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              Mostrar inactivos
            </label>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>+ Nueva persona</button>
        </div>

        {loading ? <div className="spinner" /> : personas.length === 0 ? (
          <div className="empty"><div className="empty-icon">👥</div><p>No hay personas registradas</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Documento</th><th>Apellido y Nombre</th><th>Sexo</th>
                  <th>Barrio</th><th>CUIT/CUIL</th><th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {personas.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span style={{ fontSize: '.75rem', color: 'var(--gray-400)' }}>{TIPO_DOC[p.tipo_documento] ?? p.tipo_documento} </span>
                      <code style={{ fontSize: '.85rem' }}>{p.documento}</code>
                    </td>
                    <td><strong>{p.apellido}</strong>{p.nombre ? `, ${p.nombre}` : ''}</td>
                    <td>{p.sexo ? (SEXO[p.sexo] ?? p.sexo) : <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                    <td>{p.barrio || <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                    <td>{p.cuit_cuil || <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                    <td>
                      {p.active
                        ? <span className="badge badge-green">Activo</span>
                        : <span className="badge badge-gray">Inactivo</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>✏️</button>
                        {p.active && (
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDeactivate(p)}>🗑️</button>
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

      {modalId !== null && (
        <Modal
          title={modalId === 'create' ? 'Nueva persona' : 'Editar persona'}
          onClose={() => setModalId(null)}
          size="modal-lg"
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setModalId(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          }
        >
          {error && <div className="alert alert-danger">{error}</div>}

          {/* Identificación */}
          <div className="form-row">
            <div className="form-group" style={{ flex: '0 0 140px' }}>
              <label className="form-label">Tipo doc.</label>
              <select className="form-control" value={form.tipo_documento} onChange={f('tipo_documento')}>
                {Object.entries(TIPO_DOC).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Número de documento *</label>
              <input className="form-control" value={form.documento} onChange={f('documento')} placeholder="20123456" />
            </div>
            <div className="form-group" style={{ flex: '0 0 140px' }}>
              <label className="form-label">Sexo</label>
              <select className="form-control" value={form.sexo} onChange={f('sexo')}>
                <option value="">—</option>
                {Object.entries(SEXO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Apellido *</label>
              <input className="form-control" value={form.apellido} onChange={f('apellido')} />
            </div>
            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input className="form-control" value={form.nombre} onChange={f('nombre')} />
            </div>
          </div>

          {/* Domicilio */}
          <p style={{ fontSize: '.75rem', color: 'var(--gray-400)', margin: '8px 0 4px', textTransform: 'uppercase', letterSpacing: '.05em' }}>Domicilio</p>
          <div className="form-row">
            <div className="form-group" style={{ flex: 3 }}>
              <label className="form-label">Calle</label>
              <input className="form-control" value={form.calle} onChange={f('calle')} />
            </div>
            <div className="form-group" style={{ flex: '0 0 90px' }}>
              <label className="form-label">Número</label>
              <input className="form-control" value={form.numeracion} onChange={f('numeracion')} />
            </div>
            <div className="form-group" style={{ flex: '0 0 80px' }}>
              <label className="form-label">Piso</label>
              <input className="form-control" value={form.piso} onChange={f('piso')} />
            </div>
            <div className="form-group" style={{ flex: '0 0 80px' }}>
              <label className="form-label">Dpto.</label>
              <input className="form-control" value={form.departamento} onChange={f('departamento')} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Barrio</label>
              <input className="form-control" value={form.barrio} onChange={f('barrio')} />
            </div>
            <div className="form-group">
              <label className="form-label">CUIT / CUIL</label>
              <input className="form-control" value={form.cuit_cuil} onChange={f('cuit_cuil')} placeholder="20-12345678-9" />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
