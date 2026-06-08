import { useState, useEffect, useCallback } from 'react';
import { useMedicamentos, useCategorias, useProveedores, useMovimientos, useLotes, useUbicaciones } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const emptyForm = {
  code: '', name: '', description: '', therapeutic_action: '',
  category_id: '', supplier_id: '',
  purchase_price: '0', sale_price: '0', stock: '0', min_stock: '5', unit: 'unidad',
};

export default function Medicamentos() {
  const medApi   = useMedicamentos();
  const catApi   = useCategorias();
  const provApi  = useProveedores();
  const movApi   = useMovimientos();
  const lotesApi = useLotes();
  const ubApi    = useUbicaciones();
  const { user } = useAuth();
  const isAdmin  = user?.role === 'admin';

  const [items, setItems]         = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [search, setSearch]       = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showLow, setShowLow]     = useState(false);
  const [modal, setModal]       = useState(null);
  const [movModal, setMovModal] = useState(null);
  const [detailMed, setDetailMed] = useState(null); // null | product obj
  const [detailLotes, setDetailLotes] = useState([]);
  const [detailDistrib, setDetailDistrib] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [form, setForm]           = useState(emptyForm);
  const [movForm, setMovForm]     = useState({ type: 'entrada', quantity: '', reason: '', reference: '', location_id: '', to_location_id: '', category_id: '' });
  const [saving, setSaving]       = useState(false);

  const loadItems = useCallback(() => {
    const params = {};
    if (search) params.search = search;
    if (filterCat) params.category_id = filterCat;
    if (showLow) params.low_stock = '1';
    return medApi.list(params).then((r) => setItems(r.data));
  }, [search, filterCat, showLow]);

  useEffect(() => {
    Promise.all([loadItems(), catApi.list(), provApi.list(), ubApi.list()])
      .then(([, cats, provs, ubs]) => {
        setCategorias(cats.data);
        setProveedores(provs.data);
        setUbicaciones(ubs.data);
      })
      .catch(() => setError('Error al cargar datos'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading) loadItems().catch(() => {});
  }, [search, filterCat, showLow]);

  // Cuando se actualizan los items, sincronizar el stock del detalle si está abierto
  useEffect(() => {
    if (!detailMed) return;
    const updated = items.find((p) => p.id === detailMed.id);
    if (updated && updated.stock !== detailMed.stock) setDetailMed(updated);
  }, [items]);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };
  const fld = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const mfld = (k) => (e) => setMovForm((f) => ({ ...f, [k]: e.target.value }));

  const openCreate = () => { setForm(emptyForm); setError(''); setModal('create'); };
  const openEdit   = (p) => {
    setForm({
      code: p.code, name: p.name,
      description: p.description || '',
      therapeutic_action: p.therapeutic_action || '',
      category_id: p.category_id ?? '',
      supplier_id: p.supplier_id ?? '',
      purchase_price: p.purchase_price,
      sale_price: p.sale_price,
      stock: p.stock,
      min_stock: p.min_stock,
      unit: p.unit,
    });
    setError('');
    setModal(p.id);
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      if (modal === 'create') {
        await medApi.create(form);
        notify('Medicamento creado');
      } else {
        await medApi.update(modal, form);
        notify('Medicamento actualizado');
      }
      setModal(null);
      await loadItems();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`¿Desactivar el medicamento "${name}"?`)) return;
    try {
      await medApi.remove(id);
      notify('Medicamento desactivado');
      await loadItems();
    } catch (e) { setError(e.response?.data?.error || 'Error al eliminar'); }
  };

  const openDetail = (p) => {
    setDetailMed(p);
    setDetailLotes([]);
    setDetailDistrib([]);
    setDetailLoading(true);
    Promise.all([
      lotesApi.list({ product_id: p.id }),
      medApi.distribucion(p.id),
    ])
      .then(([lotesRes, distribRes]) => {
        setDetailLotes(lotesRes.data);
        setDetailDistrib(distribRes.data);
      })
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  };

  const loteBadge = (days) => {
    const d = Number(days);
    if (d < 0)   return <span className="badge badge-red">VENCIDO</span>;
    if (d <= 7)  return <span className="badge badge-red">CRÍTICO</span>;
    if (d <= 30) return <span className="badge badge-yellow">PRÓXIMO</span>;
    return <span className="badge badge-green">OK</span>;
  };

  const openMovement = (p) => {
    setMovModal(p);
    setMovForm({ type: 'entrada', quantity: '', reason: '', reference: '', location_id: '', to_location_id: '', category_id: p.category_id ? String(p.category_id) : '' });
    setError('');
  };

  const handleMovement = async () => {
    const movedId = movModal.id;
    setSaving(true); setError('');
    try {
      await movApi.create({ ...movForm, product_id: movedId });
      notify('Movimiento registrado');
      setMovModal(null);
      await loadItems();
      // Si el detalle de lotes está abierto para este medicamento, recargar los lotes
      if (detailMed?.id === movedId) {
        setDetailLoading(true);
        Promise.all([
          lotesApi.list({ product_id: movedId }),
          medApi.distribucion(movedId),
        ])
          .then(([lotesRes, distribRes]) => {
            setDetailLotes(lotesRes.data);
            setDetailDistrib(distribRes.data);
          })
          .finally(() => setDetailLoading(false));
      }
    } catch (e) {
      setError(e.response?.data?.error || 'Error al registrar movimiento');
    } finally { setSaving(false); }
  };

  const stockBadge = (p) => {
    if (p.stock === 0 || p.stock === '0') return <span className="badge badge-red">Sin stock</span>;
    if (Number(p.stock) <= Number(p.min_stock)) return <span className="badge badge-yellow">Stock bajo</span>;
    return <span className="badge badge-green">OK</span>;
  };

  return (
    <div>
      {error   && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="table-actions">
          <div className="filters">
            <div className="search-input">
              <input className="form-control" placeholder="Buscar medicamento, código, acción..."
                value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 260 }} />
            </div>
            <select className="form-control" style={{ width: 180 }} value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}>
              <option value="">Todas las categorías</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.875rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={showLow} onChange={(e) => setShowLow(e.target.checked)} />
              Solo stock bajo
            </label>
          </div>
          {isAdmin && <button className="btn btn-primary" onClick={openCreate}>+ Nuevo medicamento</button>}
        </div>

        {loading ? <div className="spinner" /> : items.length === 0 ? (
          <div className="empty"><div className="empty-icon">💊</div><p>No hay medicamentos</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th><th>Nombre</th><th>Acción terapéutica</th>
                  <th>Categoría</th><th>Stock actual</th><th>Stock mín.</th>
                  <th>Unidad</th><th>Estado</th><th>Acciones</th>
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
                      <strong style={{
                        color: p.stock === 0 ? 'var(--danger)'
                             : Number(p.stock) <= Number(p.min_stock) ? 'var(--warning)'
                             : 'inherit'
                      }}>{p.stock}</strong>
                    </td>
                    <td style={{ color: 'var(--gray-500)' }}>{p.min_stock}</td>
                    <td style={{ color: 'var(--gray-500)' }}>{p.unit}</td>
                    <td>{stockBadge(p)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" title="Ver lotes y distribución"
                          onClick={() => openDetail(p)}>📦</button>
                        <button className="btn btn-ghost btn-sm" title="Registrar movimiento"
                          onClick={() => openMovement(p)}>↕</button>
                        {isAdmin && (
                          <>
                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>✏️</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(p.id, p.name)}>🗑️</button>
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
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          }
        >
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Código *</label>
              <input className="form-control" value={form.code} onChange={fld('code')} />
            </div>
            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input className="form-control" value={form.name} onChange={fld('name')} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Acción terapéutica</label>
            <input className="form-control" placeholder="Ej: Analgésico, Antibiótico..." value={form.therapeutic_action} onChange={fld('therapeutic_action')} />
          </div>
          <div className="form-group">
            <label className="form-label">Descripción</label>
            <textarea className="form-control" value={form.description} onChange={fld('description')} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select className="form-control" value={form.category_id} onChange={fld('category_id')}>
                <option value="">Sin categoría</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Proveedor</label>
              <select className="form-control" value={form.supplier_id} onChange={fld('supplier_id')}>
                <option value="">Sin proveedor</option>
                {proveedores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">Precio compra</label>
              <input type="number" min="0" className="form-control" value={form.purchase_price} onChange={fld('purchase_price')} />
            </div>
            <div className="form-group">
              <label className="form-label">Precio venta</label>
              <input type="number" min="0" className="form-control" value={form.sale_price} onChange={fld('sale_price')} />
            </div>
            <div className="form-group">
              <label className="form-label">Unidad</label>
              <input className="form-control" placeholder="unidad, caja, frasco..." value={form.unit} onChange={fld('unit')} />
            </div>
          </div>
          <div className="form-row">
            {modal === 'create' && (
              <div className="form-group">
                <label className="form-label">Stock inicial</label>
                <input type="number" min="0" className="form-control" value={form.stock} onChange={fld('stock')} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Stock mínimo</label>
              <input type="number" min="0" className="form-control" value={form.min_stock} onChange={fld('min_stock')} />
            </div>
          </div>
        </Modal>
      )}

      {detailMed && (
        <Modal
          title={`Lotes y stock — ${detailMed.name}`}
          onClose={() => setDetailMed(null)}
          size="modal-lg"
        >
          <div style={{ marginBottom: 16, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: '.75rem', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Stock total</span>
              <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: detailMed.stock === 0 ? 'var(--danger)' : Number(detailMed.stock) <= Number(detailMed.min_stock) ? 'var(--warning)' : 'var(--gray-800)' }}>
                {detailMed.stock} <span style={{ fontSize: '.9rem', fontWeight: 400 }}>{detailMed.unit}</span>
              </p>
            </div>
            <div>
              <span style={{ fontSize: '.75rem', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Stock mínimo</span>
              <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>{detailMed.min_stock} <span style={{ fontSize: '.9rem', fontWeight: 400 }}>{detailMed.unit}</span></p>
            </div>
            {detailMed.category_name && (
              <div>
                <span style={{ fontSize: '.75rem', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Categoría</span>
                <p style={{ margin: 0 }}>{detailMed.category_name}</p>
              </div>
            )}
          </div>

          {detailLoading ? <div className="spinner" /> : (
            <>
              {/* Distribución por ubicación (calculada desde movimientos) */}
              {detailDistrib.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontWeight: 600, marginBottom: 8, color: 'var(--gray-700)' }}>Distribución por ubicación</p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {detailDistrib.map((d) => (
                      <div key={d.location_id ?? d.location_name} style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{d.net_qty}</div>
                        <div style={{ fontSize: '.75rem', color: 'var(--gray-500)' }}>{d.location_name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailLotes.length === 0 ? (
                <div className="empty" style={{ padding: '24px 0' }}>
                  <div className="empty-icon">📦</div>
                  <p>No hay lotes registrados para este medicamento</p>
                </div>
              ) : (
                <>
              {/* Lista de lotes */}
              <p style={{ fontWeight: 600, marginBottom: 8, color: 'var(--gray-700)' }}>Lotes</p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>N° Lote</th><th>Vencimiento</th><th>Días restantes</th>
                      <th>Cantidad</th><th>Ubicación</th><th>Estado</th>
                    </tr>
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
                        <td>{loteBadge(l.days_left)}</td>
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

      {movModal && (
        <Modal
          title={`Movimiento — ${movModal.name}`}
          onClose={() => setMovModal(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setMovModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleMovement} disabled={saving}>
                {saving ? 'Registrando...' : 'Registrar'}
              </button>
            </>
          }
        >
          {error && <div className="alert alert-danger">{error}</div>}
          <p style={{ marginBottom: 16, color: 'var(--gray-500)', fontSize: '.875rem' }}>
            Stock actual: <strong>{movModal.stock}</strong> {movModal.unit}
          </p>
          <div className="form-group">
            <label className="form-label">Tipo de movimiento</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['entrada','⬆ Entrada'],['ajuste','⚙ Ajuste']].map(([t, lbl]) => (
                <button key={t} type="button"
                  className={`btn ${movForm.type === t ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setMovForm((f) => ({ ...f, type: t }))}
                  style={{ flex: 1 }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{movForm.type === 'ajuste' ? 'Nuevo stock total' : 'Cantidad'}</label>
            <input type="number" min="1" className="form-control"
              value={movForm.quantity} onChange={mfld('quantity')} />
          </div>

          {movForm.type === 'entrada' && categorias.length > 0 && (
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select className="form-control" value={movForm.category_id} onChange={mfld('category_id')}>
                <option value="">— Sin categoría —</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {ubicaciones.length > 0 && (
            <div className="form-group">
              <label className="form-label">{movForm.type === 'entrada' ? 'Depositar en' : 'Ubicación'}</label>
              <select className="form-control" value={movForm.location_id} onChange={mfld('location_id')}>
                <option value="">— Sin especificar —</option>
                {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Motivo</label>
            <input className="form-control" placeholder="Ej: Compra, Inventario, Baja..."
              value={movForm.reason} onChange={mfld('reason')} />
          </div>
          <div className="form-group">
            <label className="form-label">Referencia</label>
            <input className="form-control" placeholder="Factura, remito, etc."
              value={movForm.reference} onChange={mfld('reference')} />
          </div>
        </Modal>
      )}
    </div>
  );
}
