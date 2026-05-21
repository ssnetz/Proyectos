import { useState, useEffect } from 'react';
import { useLotes, useMedicamentos, useUbicaciones } from '../hooks/useApi';
import Modal from '../components/Modal';

function loteBadge(daysLeft) {
  const d = Number(daysLeft);
  if (d < 0)  return <span className="badge badge-red">VENCIDO</span>;
  if (d <= 7)  return <span className="badge badge-red">CRÍTICO</span>;
  if (d <= 30) return <span className="badge badge-yellow">PRÓXIMO</span>;
  return <span className="badge badge-green">OK</span>;
}

const emptyForm = {
  product_id: '', lot_number: '', expiry_date: '', quantity: '', location_id: '',
};

export default function Lotes() {
  const lotesApi = useLotes();
  const medApi   = useMedicamentos();
  const ubApi    = useUbicaciones();

  const [lotes, setLotes]               = useState([]);
  const [medicamentos, setMedicamentos] = useState([]);
  const [ubicaciones, setUbicaciones]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');
  const [filtro, setFiltro]             = useState('todos');
  const [modal, setModal]               = useState(false);
  const [form, setForm]                 = useState(emptyForm);
  const [saving, setSaving]             = useState(false);

  const loadLotes = (f) => {
    const params = {};
    if (f === 'proximos') params.expiring_days = 30;
    if (f === 'vencidos') params.expired = '1';
    return lotesApi.list(params).then((r) => setLotes(r.data));
  };

  useEffect(() => {
    Promise.all([loadLotes('todos'), medApi.list({ active: '1' }), ubApi.list()])
      .then(([, meds, ubs]) => {
        setMedicamentos(meds.data);
        setUbicaciones(ubs.data);
      })
      .catch(() => setError('Error al cargar datos'))
      .finally(() => setLoading(false));
  }, []);

  const changeFiltro = (f) => { setFiltro(f); loadLotes(f).catch(() => {}); };

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };
  const fld = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const openModal = () => { setForm(emptyForm); setError(''); setModal(true); };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await lotesApi.create(form);
      notify('Lote creado y stock actualizado');
      setModal(false);
      await loadLotes(filtro);
    } catch (e) {
      setError(e.response?.data?.error || 'Error al crear lote');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id, lotNum) => {
    if (!confirm(`¿Eliminar lote "${lotNum}"? Se ajustará el stock del medicamento.`)) return;
    try {
      await lotesApi.remove(id);
      notify('Lote eliminado');
      await loadLotes(filtro);
    } catch (e) { setError(e.response?.data?.error || 'Error al eliminar'); }
  };

  return (
    <div>
      {error   && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="table-actions">
          <div className="filters">
            {[['todos','Todos'],['proximos','Por vencer (30 días)'],['vencidos','Vencidos']].map(([val, lbl]) => (
              <button key={val} type="button"
                className={`btn btn-sm ${filtro === val ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => changeFiltro(val)}>
                {lbl}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={openModal}>+ Nuevo lote</button>
        </div>

        {loading ? <div className="spinner" /> : lotes.length === 0 ? (
          <div className="empty"><div className="empty-icon">📦</div><p>No hay lotes para mostrar</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Medicamento</th><th>N° Lote</th><th>Vencimiento</th>
                  <th>Cantidad</th><th>Ubicación</th><th>Días hasta venc.</th>
                  <th>Estado</th><th></th>
                </tr>
              </thead>
              <tbody>
                {lotes.map((l) => (
                  <tr key={l.id}>
                    <td><strong>{l.product_name}</strong></td>
                    <td><code style={{ fontSize: '.8rem' }}>{l.lot_number}</code></td>
                    <td>{new Date(l.expiry_date + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                    <td>{l.quantity} <span style={{ color: 'var(--gray-400)', fontSize: '.8rem' }}>{l.unit}</span></td>
                    <td>{l.location_name || <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                    <td style={{
                      fontWeight: 600,
                      color: Number(l.days_left) < 0 ? 'var(--danger)'
                           : Number(l.days_left) <= 30 ? 'var(--warning)'
                           : 'inherit'
                    }}>
                      {Number(l.days_left) < 0
                        ? `Vencido hace ${Math.abs(Number(l.days_left))} días`
                        : `${l.days_left} días`}
                    </td>
                    <td>{loteBadge(l.days_left)}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm"
                        onClick={() => handleDelete(l.id, l.lot_number)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <Modal
          title="Nuevo lote"
          onClose={() => setModal(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar lote'}
              </button>
            </>
          }
        >
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="form-group">
            <label className="form-label">Medicamento *</label>
            <select className="form-control" value={form.product_id} onChange={fld('product_id')}>
              <option value="">Seleccionar medicamento...</option>
              {medicamentos.map((m) => (
                <option key={m.id} value={m.id}>{m.name} [{m.code}]</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">N° de Lote *</label>
              <input className="form-control" placeholder="Ej: L-2024-001"
                value={form.lot_number} onChange={fld('lot_number')} />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha de vencimiento *</label>
              <input type="date" className="form-control"
                value={form.expiry_date} onChange={fld('expiry_date')} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Cantidad *</label>
              <input type="number" min="1" className="form-control"
                value={form.quantity} onChange={fld('quantity')} />
            </div>
            <div className="form-group">
              <label className="form-label">Ubicación</label>
              <select className="form-control" value={form.location_id} onChange={fld('location_id')}>
                <option value="">Sin ubicación específica</option>
                {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
