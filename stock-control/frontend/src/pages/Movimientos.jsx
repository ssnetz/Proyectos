import { useState, useEffect } from 'react';
import { useMovimientos, useMedicamentos } from '../hooks/useApi';
import Modal from '../components/Modal';

const TIPOS = [
  { value: '',        label: 'Todos los tipos' },
  { value: 'entrada', label: 'Entradas' },
  { value: 'salida',  label: 'Salidas' },
  { value: 'ajuste',  label: 'Ajustes' },
];

export default function Movimientos() {
  const movApi = useMovimientos();
  const medApi = useMedicamentos();

  const [movs, setMovs]             = useState([]);
  const [medicamentos, setMedicamentos] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');

  const [filterType, setFilterType] = useState('');
  const [filterProd, setFilterProd] = useState('');
  const [fromDate, setFromDate]     = useState('');
  const [toDate, setToDate]         = useState('');

  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState({ product_id: '', type: 'entrada', quantity: '', reason: '', reference: '' });
  const [saving, setSaving] = useState(false);

  const loadMovs = () => {
    const params = { limit: 100 };
    if (filterType) params.type = filterType;
    if (filterProd) params.product_id = filterProd;
    if (fromDate) params.from = fromDate;
    if (toDate) params.to = toDate;
    return movApi.list(params).then((r) => setMovs(r.data));
  };

  useEffect(() => {
    Promise.allSettled([loadMovs(), medApi.list({ active: '1' })])
      .then(([, meds]) => {
        if (meds.status === 'fulfilled') setMedicamentos(meds.value.data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading) loadMovs().catch(() => {});
  }, [filterType, filterProd, fromDate, toDate]);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };
  const fld = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const openModal = () => {
    setForm({ product_id: '', type: 'entrada', quantity: '', reason: '', reference: '' });
    setError(''); setModal(true);
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await movApi.create(form);
      notify('Movimiento registrado');
      setModal(false);
      await loadMovs();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al registrar');
    } finally { setSaving(false); }
  };

  const typeLabel = (t) => {
    const map = { entrada: '⬆ Entrada', salida: '⬇ Salida', ajuste: '⚙ Ajuste', dispensa: '💊 Dispensa' };
    return map[t] || t;
  };

  const typeClass = (t) => {
    if (t === 'entrada') return 'mov-entrada';
    if (t === 'salida' || t === 'dispensa') return 'mov-salida';
    return 'mov-ajuste';
  };

  return (
    <div>
      {error   && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="table-actions">
          <div className="filters">
            <select className="form-control" style={{ width: 160 }} value={filterType}
              onChange={(e) => setFilterType(e.target.value)}>
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select className="form-control" style={{ width: 200 }} value={filterProd}
              onChange={(e) => setFilterProd(e.target.value)}>
              <option value="">Todos los medicamentos</option>
              {medicamentos.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <input type="date" className="form-control" style={{ width: 150 }}
              value={fromDate} onChange={(e) => setFromDate(e.target.value)} title="Desde" />
            <input type="date" className="form-control" style={{ width: 150 }}
              value={toDate} onChange={(e) => setToDate(e.target.value)} title="Hasta" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => loadMovs().catch(() => {})} title="Actualizar lista">↻ Actualizar</button>
            <button className="btn btn-primary" onClick={openModal}>+ Registrar movimiento</button>
          </div>
        </div>

        {loading ? <div className="spinner" /> : movs.length === 0 ? (
          <div className="empty"><div className="empty-icon">↕️</div><p>No hay movimientos</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th><th>Medicamento</th><th>Tipo</th><th>Cantidad</th>
                  <th>Stock anterior</th><th>Stock nuevo</th><th>Motivo</th><th>Operador</th>
                </tr>
              </thead>
              <tbody>
                {movs.map((m) => (
                  <tr key={m.id}>
                    <td style={{ color: 'var(--gray-500)', fontSize: '.8rem', whiteSpace: 'nowrap' }}>
                      {new Date(m.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td><strong>{m.product_name}</strong></td>
                    <td><span className={typeClass(m.type)}>{typeLabel(m.type)}</span></td>
                    <td><strong>{m.quantity}</strong></td>
                    <td style={{ color: 'var(--gray-400)' }}>{m.previous_stock}</td>
                    <td><strong>{m.new_stock}</strong></td>
                    <td style={{ color: 'var(--gray-500)', maxWidth: 200 }}>{m.reason || '—'}</td>
                    <td style={{ color: 'var(--gray-400)', fontSize: '.8rem' }}>{m.user || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <Modal
          title="Registrar movimiento de stock"
          onClose={() => setModal(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Registrando...' : 'Registrar'}
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
                <option key={m.id} value={m.id}>{m.name} (stock: {m.stock})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Tipo *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['entrada','⬆ Entrada'],['ajuste','⚙ Ajuste']].map(([t, lbl]) => (
                <button key={t} type="button"
                  className={`btn ${form.type === t ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setForm((f) => ({ ...f, type: t }))}
                  style={{ flex: 1 }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">
              {form.type === 'ajuste' ? 'Nuevo stock total *' : 'Cantidad *'}
            </label>
            <input type="number" min="1" className="form-control"
              value={form.quantity} onChange={fld('quantity')} />
          </div>
          <div className="form-group">
            <label className="form-label">Motivo</label>
            <input className="form-control" placeholder="Ej: Compra, Inventario, Vencimiento..."
              value={form.reason} onChange={fld('reason')} />
          </div>
          <div className="form-group">
            <label className="form-label">Referencia</label>
            <input className="form-control" placeholder="N° factura, remito, etc."
              value={form.reference} onChange={fld('reference')} />
          </div>
        </Modal>
      )}
    </div>
  );
}
