import { useState, useEffect } from 'react';
import { useLotes, useMedicamentos, useUbicaciones } from '../hooks/useApi';
import Modal from '../components/Modal';

const emptyForm = { product_id: '', lot_number: '', expiry_date: '', quantity: '', location_id: '' };

const filters = [
  ['todos', 'Todos'],
  ['proximos', 'Por vencer (30 días)'],
  ['vencidos', 'Vencidos'],
];

const vencimientoBadge = (daysLeft) => {
  const n = Number(daysLeft);
  if (n < 0) return <span className="badge badge-red">VENCIDO</span>;
  if (n <= 7) return <span className="badge badge-red">CRÍTICO</span>;
  if (n <= 30) return <span className="badge badge-yellow">PRÓXIMO</span>;
  return <span className="badge badge-green">OK</span>;
};

export default function Lotes() {
  const lotesApi = useLotes();
  const medicamentos = useMedicamentos();
  const ubicaciones = useUbicaciones();

  const [lotes, setLotes] = useState([]);
  const [products, setProducts] = useState([]);
  const [locs, setLocs] = useState([]);
  const [stockByLocation, setStockByLocation] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState('todos');
  const [locationFilter, setLocationFilter] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadLotes = (f) => {
    const params = {};
    if (f === 'proximos') params.expiring_days = 30;
    if (f === 'vencidos') params.expired = '1';
    return lotesApi.list(params).then((r) => setLotes(r.data));
  };

  const loadStockByLocation = () => ubicaciones.stockByLocation().then((r) => setStockByLocation(r.data)).catch(() => {});

  useEffect(() => {
    Promise.allSettled([loadLotes('todos'), medicamentos.list({ active: '1' }), ubicaciones.list(), ubicaciones.stockByLocation()])
      .then(([, p, l, s]) => {
        if (p.status === 'fulfilled') setProducts(p.value.data);
        if (l.status === 'fulfilled') setLocs(l.value.data);
        if (s.status === 'fulfilled') setStockByLocation(s.value.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const handleFilterChange = (f) => { setFilter(f); loadLotes(f).catch(() => {}); };

  const openCreate = () => { setForm(emptyForm); setError(''); setModal(true); };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await lotesApi.create(form);
      notify('Lote creado y stock actualizado');
      setModal(false);
      await Promise.all([loadLotes(filter), loadStockByLocation()]);
    } catch (e) {
      setError(e.response?.data?.error || 'Error al crear lote');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, lotNumber) => {
    if (!confirm(`¿Eliminar lote "${lotNumber}"? Se ajustará el stock del medicamento.`)) return;
    try {
      await lotesApi.remove(id);
      notify('Lote eliminado');
      await Promise.all([loadLotes(filter), loadStockByLocation()]);
    } catch (e) {
      setError(e.response?.data?.error || 'Error al eliminar');
    }
  };

  const filtered = locationFilter ? lotes.filter((l) => String(l.location_id) === locationFilter) : lotes;
  const totalUnits = stockByLocation.reduce((sum, l) => sum + Number(l.net_qty), 0);
  const selectedLocationName = stockByLocation.find((l) => String(l.location_id) === locationFilter)?.location_name;

  return (
    <div>
      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {!loading && stockByLocation.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">📍 Stock distribuido por ubicación</span>
            <span style={{ fontSize: '.8rem', color: 'var(--gray-500)' }}>
              Total: <strong>{totalUnits}</strong> unidades en {stockByLocation.length} ubicación{stockByLocation.length !== 1 ? 'es' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '8px 0 4px' }}>
            {stockByLocation.map((l) => {
              const active = locationFilter === String(l.location_id);
              return (
                <div
                  key={l.location_id}
                  onClick={() => setLocationFilter(active ? '' : String(l.location_id))}
                  style={{
                    background: active ? 'var(--primary)' : 'var(--gray-50)',
                    color: active ? '#fff' : 'inherit',
                    border: `1px solid ${active ? 'var(--primary)' : 'var(--gray-200)'}`,
                    borderRadius: 8, padding: '10px 16px', textAlign: 'center', cursor: 'pointer', transition: 'all .15s', minWidth: 100,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '1.3rem' }}>{l.net_qty}</div>
                  <div style={{ fontSize: '.75rem', marginTop: 2, opacity: .8 }}>{l.location_name}</div>
                  {l.location_type && <div style={{ fontSize: '.7rem', marginTop: 1, opacity: .6 }}>{l.location_type}</div>}
                </div>
              );
            })}
          </div>
          {locationFilter && (
            <p style={{ marginTop: 8, fontSize: '.8rem', color: 'var(--primary)', cursor: 'pointer' }} onClick={() => setLocationFilter('')}>
              ✕ Quitar filtro por ubicación
            </p>
          )}
        </div>
      )}

      <div className="card">
        <div className="table-actions">
          <div className="filters">
            {filters.map(([value, label]) => (
              <button key={value} type="button" className={`btn btn-sm ${filter === value ? 'btn-primary' : 'btn-ghost'}`} onClick={() => handleFilterChange(value)}>
                {label}
              </button>
            ))}
            {locs.length > 0 && (
              <select className="form-control" style={{ width: 180 }} value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
                <option value="">Todas las ubicaciones</option>
                {locs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )}
          </div>
          <button className="btn btn-primary" onClick={openCreate}>+ Nuevo lote</button>
        </div>

        {loading ? (
          <div className="spinner" />
        ) : filtered.length === 0 ? (
          <div className="empty"><div className="empty-icon">📦</div><p>{locationFilter ? 'No hay lotes en esta ubicación' : 'No hay lotes para mostrar'}</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Medicamento</th><th>N° Lote</th><th>Vencimiento</th><th>Cantidad orig.</th>
                  <th>Ubicación</th><th>Días hasta venc.</th><th>Estado</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id}>
                    <td><strong>{l.product_name}</strong></td>
                    <td><code style={{ fontSize: '.8rem' }}>{l.lot_number}</code></td>
                    <td>{new Date(l.expiry_date + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                    <td>{l.quantity} <span style={{ color: 'var(--gray-400)', fontSize: '.8rem' }}>{l.unit}</span></td>
                    <td>{l.location_name || <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                    <td style={{ fontWeight: 600, color: Number(l.days_left) < 0 ? 'var(--danger)' : Number(l.days_left) <= 30 ? 'var(--warning)' : 'inherit' }}>
                      {Number(l.days_left) < 0 ? `Vencido hace ${Math.abs(Number(l.days_left))} días` : `${l.days_left} días`}
                    </td>
                    <td>{vencimientoBadge(l.days_left)}</td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => handleDelete(l.id, l.lot_number)}>🗑️</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <p style={{ marginTop: 8, fontSize: '.8rem', color: 'var(--gray-400)' }}>
            {filtered.length} lote{filtered.length !== 1 ? 's' : ''}{locationFilter ? ` en ${selectedLocationName || 'ubicación seleccionada'}` : ''}
          </p>
        )}
      </div>

      {modal && (
        <Modal
          title="Nuevo lote"
          onClose={() => setModal(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar lote'}</button>
            </>
          }
        >
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="form-group">
            <label className="form-label">Medicamento *</label>
            <select className="form-control" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
              <option value="">Seleccionar medicamento...</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} [{p.code}]</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">N° de Lote *</label>
              <input className="form-control" placeholder="Ej: L-2024-001" value={form.lot_number} onChange={(e) => setForm({ ...form, lot_number: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha de vencimiento *</label>
              <input type="date" className="form-control" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Cantidad *</label>
              <input type="number" min="1" className="form-control" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Ubicación</label>
              <select className="form-control" value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })}>
                <option value="">Sin ubicación específica</option>
                {locs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
