import { useState, useEffect } from 'react';
import { useMovimientos, useMedicamentos } from '../hooks/useApi';
import Modal from '../components/Modal';

const emptyForm = { product_id: '', type: 'entrada', quantity: '', reason: '', reference: '' };

const typeFilters = [
  { value: '', label: 'Todos los tipos' },
  { value: 'entrada', label: 'Entradas' },
  { value: 'salida', label: 'Salidas' },
  { value: 'ajuste', label: 'Ajustes' },
];

const typeLabels = { entrada: '⬆ Entrada', salida: '⬇ Salida', ajuste: '⚙ Ajuste', dispensa: '💊 Dispensa' };
const typeClass = (type) => (type === 'entrada' ? 'mov-entrada' : type === 'salida' || type === 'dispensa' ? 'mov-salida' : 'mov-ajuste');

export default function Movimientos() {
  const movimientosApi = useMovimientos();
  const medicamentos = useMedicamentos();

  const [movimientos, setMovimientos] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [type, setType] = useState('');
  const [productId, setProductId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    const params = { limit: 100 };
    if (type) params.type = type;
    if (productId) params.product_id = productId;
    if (from) params.from = from;
    if (to) params.to = to;
    return movimientosApi.list(params).then((r) => setMovimientos(r.data));
  };

  useEffect(() => {
    Promise.allSettled([load(), medicamentos.list({ active: '1' })]).then(([, p]) => {
      if (p.status === 'fulfilled') setProducts(p.value.data);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading) load().catch(() => {});
  }, [type, productId, from, to]);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = () => { setForm(emptyForm); setError(''); setModal(true); };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await movimientosApi.create(form);
      notify('Movimiento registrado');
      setModal(false);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al registrar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="table-actions">
          <div className="filters">
            <select className="form-control" style={{ width: 160 }} value={type} onChange={(e) => setType(e.target.value)}>
              {typeFilters.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <select className="form-control" style={{ width: 200 }} value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Todos los medicamentos</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="date" className="form-control" style={{ width: 150 }} value={from} onChange={(e) => setFrom(e.target.value)} title="Desde" />
            <input type="date" className="form-control" style={{ width: 150 }} value={to} onChange={(e) => setTo(e.target.value)} title="Hasta" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => load().catch(() => {})} title="Actualizar lista">↻ Actualizar</button>
            <button className="btn btn-primary" onClick={openCreate}>+ Registrar movimiento</button>
          </div>
        </div>

        {loading ? (
          <div className="spinner" />
        ) : movimientos.length === 0 ? (
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
                {movimientos.map((m) => (
                  <tr key={m.id}>
                    <td style={{ color: 'var(--gray-500)', fontSize: '.8rem', whiteSpace: 'nowrap' }}>
                      {new Date(m.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td><strong>{m.product_name}</strong></td>
                    <td><span className={typeClass(m.type)}>{typeLabels[m.type] || m.type}</span></td>
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
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Registrando...' : 'Registrar'}</button>
            </>
          }
        >
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="form-group">
            <label className="form-label">Medicamento *</label>
            <select className="form-control" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
              <option value="">Seleccionar medicamento...</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} (stock: {p.stock})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Tipo *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['entrada', '⬆ Entrada'], ['ajuste', '⚙ Ajuste']].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`btn ${form.type === value ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setForm({ ...form, type: value })}
                  style={{ flex: 1 }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{form.type === 'ajuste' ? 'Nuevo stock total *' : 'Cantidad *'}</label>
            <input type="number" min="1" className="form-control" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Motivo</label>
            <input className="form-control" placeholder="Ej: Compra, Inventario, Vencimiento..." value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Referencia</label>
            <input className="form-control" placeholder="N° factura, remito, etc." value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </div>
        </Modal>
      )}
    </div>
  );
}
