import { useState, useEffect, useCallback, useRef } from 'react';
import { useDispensas, useBeneficiarios, useProducts } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const today = () => new Date().toISOString().slice(0, 10);

export default function Dispensas() {
  const dispensasApi     = useDispensas();
  const beneficiariosApi = useBeneficiarios();
  const productsApi      = useProducts();
  const { user }         = useAuth();

  const [dispensas, setDispensas]         = useState([]);
  const [beneficiarios, setBeneficiarios] = useState([]);
  const [products, setProducts]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [success, setSuccess]             = useState('');

  // Create modal state
  const [showCreate, setShowCreate]       = useState(false);
  const [saving, setSaving]               = useState(false);
  const [benSearch, setBenSearch]         = useState('');
  const [benDropdown, setBenDropdown]     = useState(false);
  const [selectedBen, setSelectedBen]     = useState(null);
  const [fecha, setFecha]                 = useState(today());
  const [observaciones, setObservaciones] = useState('');
  const [items, setItems]                 = useState([]);
  const [formError, setFormError]         = useState('');
  const benRef = useRef(null);

  // Detail modal state
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(() =>
    dispensasApi.list().then((r) => setDispensas(r.data)),
  []);

  useEffect(() => {
    Promise.all([
      load(),
      beneficiariosApi.list({ active_only: '1' }),
      productsApi.list(),
    ]).then(([, bens, prods]) => {
      setBeneficiarios(bens.data);
      setProducts(prods.data.filter((p) => p.active));
    }).catch(() => setError('Error cargando datos'))
      .finally(() => setLoading(false));
  }, []);

  // Close beneficiary dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (benRef.current && !benRef.current.contains(e.target)) setBenDropdown(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  // ─── Beneficiary search helpers ──────────────────────────────────────────
  const filteredBens = benSearch.length >= 1
    ? beneficiarios.filter((b) => {
        const q = benSearch.toLowerCase();
        return b.dni.includes(q) || b.apellido.toLowerCase().includes(q) || b.nombre.toLowerCase().includes(q);
      }).slice(0, 8)
    : [];

  const selectBen = (b) => { setSelectedBen(b); setBenSearch(''); setBenDropdown(false); };
  const clearBen  = () => { setSelectedBen(null); setBenSearch(''); };

  // ─── Items helpers ───────────────────────────────────────────────────────
  const addItem = () => setItems([...items, { product_id: '', cantidad: 1 }]);
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx, key, val) =>
    setItems(items.map((it, i) => i === idx ? { ...it, [key]: val } : it));

  const getProduct = (id) => products.find((p) => p.id === parseInt(id));
  const usedProductIds = new Set(items.map((it) => parseInt(it.product_id)).filter(Boolean));

  // ─── Open create modal ───────────────────────────────────────────────────
  const openCreate = () => {
    setSelectedBen(null); setBenSearch(''); setFecha(today());
    setObservaciones(''); setItems([]); setFormError('');
    setShowCreate(true);
  };

  // ─── Submit dispensa ─────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setFormError('');
    if (!selectedBen)              return setFormError('Seleccioná un beneficiario');
    if (items.length === 0)        return setFormError('Agregá al menos un medicamento');
    for (const it of items) {
      if (!it.product_id)          return setFormError('Seleccioná el medicamento en todos los ítems');
      if (!it.cantidad || it.cantidad < 1) return setFormError('La cantidad debe ser mayor a 0');
      const p = getProduct(it.product_id);
      if (p && it.cantidad > p.stock) return setFormError(`Stock insuficiente para ${p.name} (disponible: ${p.stock})`);
    }

    setSaving(true);
    try {
      await dispensasApi.create({
        beneficiario_id: selectedBen.id,
        fecha,
        observaciones: observaciones || null,
        items: items.map((it) => ({ product_id: parseInt(it.product_id), cantidad: parseInt(it.cantidad) })),
      });
      notify('Dispensa registrada correctamente');
      setShowCreate(false);
      // Refresh dispensas and products (stock changed)
      const [, prods] = await Promise.all([load(), productsApi.list()]);
      setProducts(prods.data.filter((p) => p.active));
    } catch (e) {
      setFormError(e.response?.data?.error || 'Error al registrar la dispensa');
    } finally { setSaving(false); }
  };

  // ─── View detail ─────────────────────────────────────────────────────────
  const openDetail = async (id) => {
    setLoadingDetail(true);
    setDetail({ id });
    try {
      const r = await dispensasApi.get(id);
      setDetail(r.data);
    } catch { setDetail(null); setError('Error cargando detalle'); }
    finally { setLoadingDetail(false); }
  };

  const fmt = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-AR') : '—';

  return (
    <div>
      {error   && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="table-actions">
          <div />
          <button className="btn btn-primary" onClick={openCreate}>+ Nueva dispensa</button>
        </div>

        {loading ? <div className="spinner" /> : dispensas.length === 0 ? (
          <div className="empty"><div className="empty-icon">💊</div><p>No hay dispensas registradas</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Fecha</th><th>Beneficiario</th><th>Obra Social</th>
                  <th>Medicamentos</th><th>Operador</th><th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {dispensas.map((d) => (
                  <tr key={d.id}>
                    <td><code style={{ fontSize: '.8rem' }}>#{d.id}</code></td>
                    <td>{fmt(d.fecha)}</td>
                    <td>
                      <strong>{d.apellido}</strong>, {d.nombre}
                      <br /><code style={{ fontSize: '.75rem', color: 'var(--gray-400)' }}>DNI {d.dni}</code>
                    </td>
                    <td>
                      {d.obra_social
                        ? <>{d.obra_social}<br /><span style={{ fontSize: '.75rem', color: 'var(--gray-400)' }}>{d.numero_afiliado}</span></>
                        : <span style={{ color: 'var(--gray-400)' }}>—</span>}
                    </td>
                    <td>
                      <span className="badge badge-purple">{d.total_items} ítem{d.total_items !== 1 ? 's' : ''}</span>
                      <span style={{ marginLeft: 6, fontSize: '.8rem', color: 'var(--gray-400)' }}>{d.total_unidades} u.</span>
                    </td>
                    <td style={{ fontSize: '.85rem' }}>{d.user || '—'}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => openDetail(d.id)}>Ver</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Create modal ──────────────────────────────────────────────── */}
      {showCreate && (
        <Modal
          title="Nueva Dispensa"
          onClose={() => setShowCreate(false)}
          size="modal-lg"
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Registrando...' : 'Confirmar dispensa'}
              </button>
            </>
          }
        >
          {formError && <div className="alert alert-danger">{formError}</div>}

          {/* Beneficiario */}
          <fieldset style={{ border: '1px solid var(--gray-700)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
            <legend style={{ fontSize: '.8rem', color: 'var(--gray-400)', padding: '0 6px' }}>Beneficiario</legend>
            {selectedBen ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--gray-800)', borderRadius: 6, padding: '8px 12px' }}>
                <div>
                  <strong>{selectedBen.apellido}, {selectedBen.nombre}</strong>
                  <span style={{ marginLeft: 10, fontSize: '.8rem', color: 'var(--gray-400)' }}>DNI {selectedBen.dni}</span>
                  {selectedBen.obra_social && (
                    <span style={{ marginLeft: 10, fontSize: '.8rem', color: 'var(--gray-400)' }}>{selectedBen.obra_social}</span>
                  )}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={clearBen} style={{ fontSize: '.75rem' }}>Cambiar</button>
              </div>
            ) : (
              <div ref={benRef} style={{ position: 'relative' }}>
                <input
                  className="form-control"
                  placeholder="Buscar por DNI, apellido o nombre..."
                  value={benSearch}
                  onChange={(e) => { setBenSearch(e.target.value); setBenDropdown(true); }}
                  onFocus={() => setBenDropdown(true)}
                  autoComplete="off"
                />
                {benDropdown && filteredBens.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: 'var(--gray-800)', border: '1px solid var(--gray-700)',
                    borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.4)', maxHeight: 220, overflowY: 'auto'
                  }}>
                    {filteredBens.map((b) => (
                      <div
                        key={b.id}
                        onMouseDown={() => selectBen(b)}
                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--gray-700)' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gray-700)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = ''}
                      >
                        <strong>{b.apellido}</strong>, {b.nombre}
                        <span style={{ marginLeft: 10, fontSize: '.8rem', color: 'var(--gray-400)' }}>DNI {b.dni}</span>
                        {b.obra_social && <span style={{ marginLeft: 10, fontSize: '.75rem', color: 'var(--gray-500)' }}>{b.obra_social}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {benDropdown && benSearch.length >= 1 && filteredBens.length === 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: 'var(--gray-800)', border: '1px solid var(--gray-700)',
                    borderRadius: 6, padding: '10px 12px', fontSize: '.85rem', color: 'var(--gray-400)'
                  }}>
                    Sin resultados
                  </div>
                )}
              </div>
            )}
          </fieldset>

          {/* Fecha y observaciones */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Fecha *</label>
              <input type="date" className="form-control" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Observaciones</label>
              <input className="form-control" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Opcional..." />
            </div>
          </div>

          {/* Items */}
          <fieldset style={{ border: '1px solid var(--gray-700)', borderRadius: 8, padding: '12px 16px' }}>
            <legend style={{ fontSize: '.8rem', color: 'var(--gray-400)', padding: '0 6px' }}>Medicamentos</legend>
            {items.length === 0 && (
              <p style={{ color: 'var(--gray-500)', fontSize: '.875rem', marginBottom: 8 }}>Ningún medicamento agregado aún.</p>
            )}
            {items.map((item, idx) => {
              const prod = getProduct(item.product_id);
              const maxQty = prod ? prod.stock : 9999;
              const isOver = prod && parseInt(item.cantidad) > prod.stock;
              return (
                <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                  <div style={{ flex: 3 }}>
                    <select
                      className="form-control"
                      value={item.product_id}
                      onChange={(e) => updateItem(idx, 'product_id', e.target.value)}
                    >
                      <option value="">Seleccionar medicamento...</option>
                      {products
                        .filter((p) => !usedProductIds.has(p.id) || p.id === parseInt(item.product_id))
                        .map((p) => (
                          <option key={p.id} value={p.id} disabled={p.stock === 0}>
                            {p.name} — stock: {p.stock} {p.unit}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div style={{ width: 100 }}>
                    <input
                      type="number" className="form-control" min="1" max={maxQty}
                      value={item.cantidad}
                      onChange={(e) => updateItem(idx, 'cantidad', e.target.value)}
                      style={isOver ? { borderColor: 'var(--red-500)' } : {}}
                    />
                  </div>
                  {prod && (
                    <div style={{ fontSize: '.75rem', color: isOver ? 'var(--red-400)' : 'var(--gray-400)', paddingTop: 8, whiteSpace: 'nowrap' }}>
                      stock: {prod.stock}
                    </div>
                  )}
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeItem(idx)} style={{ marginTop: 2 }}>✕</button>
                </div>
              );
            })}
            <button
              className="btn btn-ghost btn-sm"
              onClick={addItem}
              style={{ marginTop: 4 }}
              disabled={products.filter((p) => p.stock > 0).length === 0}
            >
              + Agregar medicamento
            </button>
          </fieldset>
        </Modal>
      )}

      {/* ─── Detail modal ──────────────────────────────────────────────── */}
      {detail && (
        <Modal
          title={`Detalle de Dispensa #${detail.id}`}
          onClose={() => setDetail(null)}
          size="modal-lg"
        >
          {loadingDetail ? <div className="spinner" /> : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', marginBottom: 16 }}>
                <div>
                  <span style={{ fontSize: '.75rem', color: 'var(--gray-400)' }}>Beneficiario</span>
                  <p style={{ margin: 0, fontWeight: 600 }}>{detail.apellido}, {detail.nombre}</p>
                  <p style={{ margin: 0, fontSize: '.8rem', color: 'var(--gray-400)' }}>DNI {detail.dni}</p>
                </div>
                <div>
                  <span style={{ fontSize: '.75rem', color: 'var(--gray-400)' }}>Obra Social</span>
                  <p style={{ margin: 0 }}>{detail.obra_social || '—'}</p>
                  {detail.numero_afiliado && <p style={{ margin: 0, fontSize: '.8rem', color: 'var(--gray-400)' }}>N° {detail.numero_afiliado}</p>}
                </div>
                <div>
                  <span style={{ fontSize: '.75rem', color: 'var(--gray-400)' }}>Fecha</span>
                  <p style={{ margin: 0 }}>{fmt(detail.fecha)}</p>
                </div>
                <div>
                  <span style={{ fontSize: '.75rem', color: 'var(--gray-400)' }}>Operador</span>
                  <p style={{ margin: 0 }}>{detail.user || '—'}</p>
                </div>
                {detail.observaciones && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: '.75rem', color: 'var(--gray-400)' }}>Observaciones</span>
                    <p style={{ margin: 0 }}>{detail.observaciones}</p>
                  </div>
                )}
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Código</th><th>Medicamento</th><th>Cantidad</th><th>Stock previo</th><th>Stock final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.items || []).map((it) => (
                      <tr key={it.id}>
                        <td><code style={{ fontSize: '.8rem' }}>{it.product_code}</code></td>
                        <td>{it.product_name}</td>
                        <td><strong>{it.cantidad}</strong> {it.unit}</td>
                        <td style={{ color: 'var(--gray-400)' }}>{it.stock_previo}</td>
                        <td>{it.stock_nuevo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
