import { useState, useEffect, useCallback } from 'react';
import { useMedicamentos, useCategorias, useProveedores, useMovimientos, useLotes, useUbicaciones } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const emptyForm = {
  code: '', name: '', description: '', therapeutic_action: '',
  category_id: '', supplier_id: '',
  purchase_price: '0', sale_price: '0', stock: '0', min_stock: '5', unit: 'unidad',
};

const emptyMovement = { type: 'entrada', quantity: '', reason: '', reference: '', location_id: '', to_location_id: '', category_id: '' };

const vencimientoBadge = (daysLeft) => {
  const n = Number(daysLeft);
  if (n < 0) return <span className="badge badge-red">VENCIDO</span>;
  if (n <= 7) return <span className="badge badge-red">CRÍTICO</span>;
  if (n <= 30) return <span className="badge badge-yellow">PRÓXIMO</span>;
  return <span className="badge badge-green">OK</span>;
};

const stockBadge = (p) => {
  if (p.stock === 0 || p.stock === '0') return <span className="badge badge-red">Sin stock</span>;
  if (Number(p.stock) <= Number(p.min_stock)) return <span className="badge badge-yellow">Stock bajo</span>;
  return <span className="badge badge-green">OK</span>;
};

export default function Medicamentos() {
  const medicamentos = useMedicamentos();
  const categorias = useCategorias();
  const proveedores = useProveedores();
  const movimientos = useMovimientos();
  const lotes = useLotes();
  const ubicaciones = useUbicaciones();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [supps, setSupps] = useState([]);
  const [locs, setLocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [modal, setModal] = useState(null); // null | 'create' | productId
  const [detail, setDetail] = useState(null); // product being viewed (lotes/distribucion)
  const [detailLotes, setDetailLotes] = useState([]);
  const [detailDistribucion, setDetailDistribucion] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [movementProduct, setMovementProduct] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [movementForm, setMovementForm] = useState(emptyMovement);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const params = {};
    if (search) params.search = search;
    if (categoryId) params.category_id = categoryId;
    if (lowStockOnly) params.low_stock = '1';
    return medicamentos.list(params).then((r) => setItems(r.data));
  }, [search, categoryId, lowStockOnly]);

  useEffect(() => {
    Promise.allSettled([load(), categorias.list(), proveedores.list(), ubicaciones.list()]).then(([, c, s, l]) => {
      if (c.status === 'fulfilled') setCats(c.value.data);
      if (s.status === 'fulfilled') setSupps(s.value.data);
      if (l.status === 'fulfilled') setLocs(l.value.data);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading) load().catch(() => {});
  }, [search, categoryId, lowStockOnly]);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = () => { setForm(emptyForm); setError(''); setModal('create'); };

  const openEdit = (p) => {
    setForm({
      code: p.code, name: p.name, description: p.description || '', therapeutic_action: p.therapeutic_action || '',
      category_id: p.category_id ?? '', supplier_id: p.supplier_id ?? '',
      purchase_price: p.purchase_price, sale_price: p.sale_price, stock: p.stock, min_stock: p.min_stock, unit: p.unit,
    });
    setError('');
    setModal(p.id);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (modal === 'create') { await medicamentos.create(form); notify('Medicamento creado'); }
      else { await medicamentos.update(modal, form); notify('Medicamento actualizado'); }
      setModal(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id, name) => {
    if (!confirm(`¿Desactivar el medicamento "${name}"?`)) return;
    try {
      await medicamentos.remove(id);
      notify('Medicamento desactivado');
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al eliminar');
    }
  };

  const openDetail = (p) => {
    setDetail(p);
    setDetailLotes([]);
    setDetailDistribucion([]);
    setDetailLoading(true);
    Promise.all([lotes.list({ product_id: p.id }), medicamentos.distribucion(p.id)])
      .then(([l, d]) => { setDetailLotes(l.data); setDetailDistribucion(d.data); })
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  };

  const openMovement = (p) => {
    setMovementProduct(p);
    setMovementForm({ ...emptyMovement, category_id: p.category_id ? String(p.category_id) : '' });
    setError('');
  };

  const handleRegisterMovement = async () => {
    const productId = movementProduct.id;
    setSaving(true);
    setError('');
    try {
      await movimientos.create({ ...movementForm, product_id: productId });
      notify('Movimiento registrado');
      setMovementProduct(null);
      await load();
      if (detail?.id === productId) openDetail(detail);
    } catch (e) {
      setError(e.response?.data?.error || 'Error al registrar movimiento');
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
            <div className="search-input">
              <input
                className="form-control"
                placeholder="Buscar medicamento, código, acción..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 260 }}
              />
            </div>
            <select className="form-control" style={{ width: 180 }} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Todas las categorías</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.875rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
              Solo stock bajo
            </label>
          </div>
          {isAdmin && <button className="btn btn-primary" onClick={openCreate}>+ Nuevo medicamento</button>}
        </div>

        {loading ? (
          <div className="spinner" />
        ) : items.length === 0 ? (
          <div className="empty"><div className="empty-icon">💊</div><p>No hay medicamentos</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th><th>Nombre</th><th>Acción terapéutica</th><th>Categoría</th>
                  <th>Stock actual</th><th>Stock mín.</th><th>Unidad</th><th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td><code style={{ fontSize: '.8rem' }}>{p.code}</code></td>
                    <td><strong>{p.name}</strong></td>
                    <td style={{ color: 'var(--gray-600)', maxWidth: 200 }}>{p.therapeutic_action || '—'}</td>
                    <td>{p.category_name || '—'}</td>
                    <td>
                      <strong style={{ color: p.stock === 0 ? 'var(--danger)' : Number(p.stock) <= Number(p.min_stock) ? 'var(--warning)' : 'inherit' }}>
                        {p.stock}
                      </strong>
                    </td>
                    <td style={{ color: 'var(--gray-500)' }}>{p.min_stock}</td>
                    <td style={{ color: 'var(--gray-500)' }}>{p.unit}</td>
                    <td>{stockBadge(p)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" title="Ver lotes y distribución" onClick={() => openDetail(p)}>📦</button>
                        <button className="btn btn-ghost btn-sm" title="Registrar movimiento" onClick={() => openMovement(p)}>↕</button>
                        {isAdmin && (
                          <>
                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>✏️</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleDeactivate(p.id, p.name)}>🗑️</button>
                          </>
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
          title={modal === 'create' ? 'Nuevo medicamento' : 'Editar medicamento'}
          onClose={() => setModal(null)}
          size="modal-lg"
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </>
          }
        >
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Código *</label>
              <input className="form-control" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Acción terapéutica</label>
            <input className="form-control" placeholder="Ej: Analgésico, Antibiótico..." value={form.therapeutic_action} onChange={(e) => setForm({ ...form, therapeutic_action: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Descripción</label>
            <textarea className="form-control" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select className="form-control" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">Sin categoría</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Proveedor</label>
              <select className="form-control" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                <option value="">Sin proveedor</option>
                {supps.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">Precio compra</label>
              <input type="number" min="0" className="form-control" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Precio venta</label>
              <input type="number" min="0" className="form-control" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Unidad</label>
              <input className="form-control" placeholder="unidad, caja, frasco..." value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            {modal === 'create' && (
              <div className="form-group">
                <label className="form-label">Stock inicial</label>
                <input type="number" min="0" className="form-control" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Stock mínimo</label>
              <input type="number" min="0" className="form-control" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
            </div>
          </div>
        </Modal>
      )}

      {detail && (
        <Modal title={`Lotes y stock — ${detail.name}`} onClose={() => setDetail(null)} size="modal-lg">
          <div style={{ marginBottom: 16, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: '.75rem', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Stock total</span>
              <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: detail.stock === 0 ? 'var(--danger)' : Number(detail.stock) <= Number(detail.min_stock) ? 'var(--warning)' : 'var(--gray-800)' }}>
                {detail.stock} <span style={{ fontSize: '.9rem', fontWeight: 400 }}>{detail.unit}</span>
              </p>
            </div>
            <div>
              <span style={{ fontSize: '.75rem', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Stock mínimo</span>
              <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>{detail.min_stock} <span style={{ fontSize: '.9rem', fontWeight: 400 }}>{detail.unit}</span></p>
            </div>
            {detail.category_name && (
              <div>
                <span style={{ fontSize: '.75rem', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Categoría</span>
                <p style={{ margin: 0 }}>{detail.category_name}</p>
              </div>
            )}
          </div>

          {detailLoading ? <div className="spinner" /> : (
            <>
              {detailDistribucion.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontWeight: 600, marginBottom: 8, color: 'var(--gray-700)' }}>Distribución por ubicación</p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {detailDistribucion.map((d) => (
                      <div key={d.location_id ?? d.location_name} style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{d.net_qty}</div>
                        <div style={{ fontSize: '.75rem', color: 'var(--gray-500)' }}>{d.location_name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailLotes.length === 0 ? (
                <div className="empty" style={{ padding: '24px 0' }}><div className="empty-icon">📦</div><p>No hay lotes registrados para este medicamento</p></div>
              ) : (
                <>
                  <p style={{ fontWeight: 600, marginBottom: 8, color: 'var(--gray-700)' }}>Lotes</p>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>N° Lote</th><th>Vencimiento</th><th>Días restantes</th><th>Cantidad</th><th>Ubicación</th><th>Estado</th></tr>
                      </thead>
                      <tbody>
                        {detailLotes.map((l) => (
                          <tr key={l.id}>
                            <td><code style={{ fontSize: '.8rem' }}>{l.lot_number}</code></td>
                            <td>{new Date(l.expiry_date + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                            <td style={{ fontWeight: 600, color: Number(l.days_left) < 0 ? 'var(--danger)' : Number(l.days_left) <= 30 ? 'var(--warning)' : 'inherit' }}>
                              {Number(l.days_left) < 0 ? `Venció hace ${Math.abs(Number(l.days_left))} días` : `${l.days_left} días`}
                            </td>
                            <td><strong>{l.quantity}</strong> {l.unit}</td>
                            <td>{l.location_name || <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                            <td>{vencimientoBadge(l.days_left)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </Modal>
      )}

      {movementProduct && (
        <Modal
          title={`Movimiento — ${movementProduct.name}`}
          onClose={() => setMovementProduct(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setMovementProduct(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleRegisterMovement} disabled={saving}>{saving ? 'Registrando...' : 'Registrar'}</button>
            </>
          }
        >
          {error && <div className="alert alert-danger">{error}</div>}
          <p style={{ marginBottom: 16, color: 'var(--gray-500)', fontSize: '.875rem' }}>
            Stock actual: <strong>{movementProduct.stock}</strong> {movementProduct.unit}
          </p>
          <div className="form-group">
            <label className="form-label">Tipo de movimiento</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['entrada', '⬆ Entrada'], ['ajuste', '⚙ Ajuste']].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`btn ${movementForm.type === value ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setMovementForm({ ...movementForm, type: value })}
                  style={{ flex: 1 }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{movementForm.type === 'ajuste' ? 'Nuevo stock total' : 'Cantidad'}</label>
            <input type="number" min="1" className="form-control" value={movementForm.quantity} onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })} />
          </div>
          {movementForm.type === 'entrada' && cats.length > 0 && (
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select className="form-control" value={movementForm.category_id} onChange={(e) => setMovementForm({ ...movementForm, category_id: e.target.value })}>
                <option value="">— Sin categoría —</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          {locs.length > 0 && (
            <div className="form-group">
              <label className="form-label">{movementForm.type === 'entrada' ? 'Depositar en' : 'Ubicación'}</label>
              <select className="form-control" value={movementForm.location_id} onChange={(e) => setMovementForm({ ...movementForm, location_id: e.target.value })}>
                <option value="">— Sin especificar —</option>
                {locs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Motivo</label>
            <input className="form-control" placeholder="Ej: Compra, Inventario, Baja..." value={movementForm.reason} onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Referencia</label>
            <input className="form-control" placeholder="Factura, remito, etc." value={movementForm.reference} onChange={(e) => setMovementForm({ ...movementForm, reference: e.target.value })} />
          </div>
        </Modal>
      )}
    </div>
  );
}
