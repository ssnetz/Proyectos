import { useState, useEffect, useCallback } from 'react';
import { useBeneficiarios } from '../hooks/useApi';
import Modal from '../components/Modal';

const emptyForm = {
  dni: '', apellido: '', nombre: '', fecha_nacimiento: '',
  telefono: '', direccion: '', obra_social: '', numero_afiliado: '', observaciones: '',
};

export default function Beneficiarios() {
  const api = useBeneficiarios();

  const [beneficiarios, setBeneficiarios] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [success, setSuccess]             = useState('');
  const [search, setSearch]               = useState('');
  const [showInactive, setShowInactive]   = useState(false);

  const [modalId, setModalId] = useState(null);
  const [form, setForm]       = useState(emptyForm);
  const [saving, setSaving]   = useState(false);

  const load = useCallback(() =>
    api.list({ search, active_only: showInactive ? '0' : '1' }).then((r) => setBeneficiarios(r.data)),
  [search, showInactive]);

  useEffect(() => {
    load().catch(() => setError('Error cargando beneficiarios')).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading) load().catch(() => {});
  }, [search, showInactive]);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = () => { setForm(emptyForm); setModalId('create'); };
  const openEdit   = (b) => {
    setForm({
      dni: b.dni, apellido: b.apellido, nombre: b.nombre,
      fecha_nacimiento: b.fecha_nacimiento ?? '',
      telefono: b.telefono ?? '', direccion: b.direccion ?? '',
      obra_social: b.obra_social ?? '', numero_afiliado: b.numero_afiliado ?? '',
      observaciones: b.observaciones ?? '',
    });
    setModalId(b.id);
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      if (modalId === 'create') {
        await api.create(form);
        notify('Beneficiario creado');
      } else {
        await api.update(modalId, form);
        notify('Beneficiario actualizado');
      }
      setModalId(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const handleDeactivate = async (b) => {
    if (!confirm(`¿Desactivar a ${b.apellido} ${b.nombre}?`)) return;
    try {
      await api.remove(b.id);
      notify('Beneficiario desactivado');
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
              className="form-control" placeholder="Buscar por DNI, apellido o nombre..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ width: 280 }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.875rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              Mostrar inactivos
            </label>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>+ Nuevo beneficiario</button>
        </div>

        {loading ? <div className="spinner" /> : beneficiarios.length === 0 ? (
          <div className="empty"><div className="empty-icon">👥</div><p>No hay beneficiarios</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>DNI</th><th>Apellido y Nombre</th><th>Obra Social</th>
                  <th>N° Afiliado</th><th>Teléfono</th><th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {beneficiarios.map((b) => (
                  <tr key={b.id}>
                    <td><code style={{ fontSize: '.85rem' }}>{b.dni}</code></td>
                    <td><strong>{b.apellido}</strong>, {b.nombre}</td>
                    <td>{b.obra_social || <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                    <td>{b.numero_afiliado || <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                    <td>{b.telefono || <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                    <td>
                      {b.active ? (
                        <span className="badge badge-green">Activo</span>
                      ) : (
                        <span className="badge badge-gray">Inactivo</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(b)}>✏️</button>
                        {b.active && (
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDeactivate(b)}>🗑️</button>
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
          title={modalId === 'create' ? 'Nuevo beneficiario' : 'Editar beneficiario'}
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
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">DNI *</label>
              <input className="form-control" value={form.dni} onChange={f('dni')} placeholder="20123456" />
            </div>
            <div className="form-group">
              <label className="form-label">Apellido *</label>
              <input className="form-control" value={form.apellido} onChange={f('apellido')} />
            </div>
            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input className="form-control" value={form.nombre} onChange={f('nombre')} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Fecha de nacimiento</label>
              <input type="date" className="form-control" value={form.fecha_nacimiento} onChange={f('fecha_nacimiento')} />
            </div>
            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input className="form-control" value={form.telefono} onChange={f('telefono')} placeholder="+54 11 ..." />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Obra Social</label>
              <input className="form-control" value={form.obra_social} onChange={f('obra_social')} placeholder="Ej: OSDE, PAMI..." />
            </div>
            <div className="form-group">
              <label className="form-label">N° Afiliado</label>
              <input className="form-control" value={form.numero_afiliado} onChange={f('numero_afiliado')} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Dirección</label>
            <input className="form-control" value={form.direccion} onChange={f('direccion')} />
          </div>
          <div className="form-group">
            <label className="form-label">Observaciones</label>
            <textarea className="form-control" rows={2} value={form.observaciones} onChange={f('observaciones')} />
          </div>
        </Modal>
      )}
    </div>
  );
}
