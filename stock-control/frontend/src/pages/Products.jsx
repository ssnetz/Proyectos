import { useState, useEffect, useCallback } from 'react';
import { useProducts, useCategories, useSuppliers, useMovements, useLocations, useLots } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const emptyProduct = {
  code: '', name: '', description: '', category_id: '', supplier_id: '',
  purchase_price: '', sale_price: '', stock: '', min_stock: '5', unit: 'comp',
  location_id: '1',
};

const emptyMov = {
  type: 'entrada', quantity: '', reason: '', reference: '',
  location_id: '', to_location_id: '',
  lot_number: '', expiration_date: '',
};

export default function Products() {
  const productsApi   = useProducts();
  const categoriesApi = useCategories();
  const suppliersApi  = useSuppliers();
  const movementsApi  = useMovements();
  const locationsApi  = useLocations();
  const lotsApi       = useLots();
  const { user }      = useAuth();
  const isAdmin       = user?.role === 'admin';

  const [products,   setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers,  setSuppliers]  = useState([]);
  const [locations,  setLocations]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState('');

  const [search,     setSearch]     = useState('');
  const [filterCat,  setFilterCat]  = useState('');
  const [filterLoc,  setFilterLoc]  = useState('');
  const [showLow,    setShowLow]    = useState(false);
  const [expanded,   setExpanded]   = useState(null);
  const [lotsMap,    setLotsMap]    = useState({});

  const [modalProduct,  setModalProduct]  = useState(null);
  const [modalMovement, setModalMovement] = useState(null);
  const [form,    setForm]    = useState(emptyProduct);
  const [movForm, setMovForm] = useState(emptyMov);
  const [saving,  setSaving]  = useState(false);

  const loadProducts = useCallback(() => {
    const params = {};
    if (search)    params.search      = search;
    if (filterCat) params.category    = filterCat;
    if (filterLoc) params.location_id = filterLoc;
    if (showLow)   params.low_stock   = '1';
    return productsApi.list(params).then((r) => setProducts(r.data));
  }, [search, filterCat, filterLoc, showLow]);

  useEffect(() => {
    Promise.all([
      loadProducts(),
      categoriesApi.list(),
      suppliersApi.list(),
      locationsApi.list(),
    ])
      .then(([, cats, sups, locs]) => {
        setCategories(cats.data);
        setSuppliers(sups.data);
        setLocations(locs.data);
      })
      .catch(() => setError('Error cargando datos'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading) loadProducts().catch(() => {});
  }, [search, filterCat, filterLoc, showLow]);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = () => {
    setForm({ ...emptyProduct, location_id: locations[0]?.id?.toString() || '1' });
    setModalProduct('create');
  };
  const openEdit = (p) => {
    setForm({
      code: p.code, name: p.name, description: p.description || '',
      category_id: p.category_id || '', supplier_id: p.supplier_id || '',
      purchase_price: p.purchase_price, sale_price: p.sale_price,
      stock: p.stock_total ?? p.stock, min_stock: p.min_stock, unit: p.unit,
      location_id: '1',
    });
    setModalProduct(p.id);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (modalProduct === 'create') {
        await productsApi.create(form);
        notify('Medicamento creado correctamente');
      } else {
        await productsApi.update(modalProduct, form);
        notify('Medicamento actualizado');
      }
      setModalProduct(null);
      await loadProducts();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este medicamento?')) return;
    try {
      await productsApi.remove(id);
      notify('Medicamento eliminado');
      await loadProducts();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al eliminar');
    }
  };

  const openMovement = (p) => {
    setModalMovement(p);
    setMovForm({ ...emptyMov, location_id: locations[0]?.id?.toString() || '1' });
  };

  const toggleExpanded = (productId) => {
    const next = expanded === productId ? null : productId;
    setExpanded(next);
    if (next && !lotsMap[next]) {
      lotsApi.list({ product_id: next })
        .then((r) => setLotsMap((prev) => ({ ...prev, [next]: r.data })))
        .catch(() => {});
    }
  };

  const handleMovement = async () => {
    setSaving(true);
    setError('');
    try {
      const productId = modalMovement.id;
      await movementsApi.create({ ...movForm, product_id: productId });
      notify('Movimiento registrado');
      setModalMovement(null);
      await loadProducts();
      // Refrescar lotes si ese producto está expandido
      if (expanded === productId) {
        lotsApi.list({ product_id: productId })
          .then((r) => setLotsMap((prev) => ({ ...prev, [productId]: r.data })))
          .catch(() => {});
      }
    } catch (e) {
      setError(e.response?.data?.error || 'Error al registrar movimiento');
    } finally {
      setSaving(false);
    }
  };

  const stockTotal = (p) => p.stock_total ?? p.stock ?? 0;

  const stockBadge = (p) => {
    const s = stockTotal(p);
    if (s === 0) return <span className="badge badge-red">Sin stock</span>;
    if (s <= p.min_stock) return <span className="badge badge-yellow">Stock bajo</span>;
    return <span className="badge badge-green">OK</span>;
  };

  const stockPct = (p) => {
    if (p.min_stock === 0) return 100;
    return Math.min(100, Math.round((stockTotal(p) / (p.min_stock * 2)) * 100));
  };

  const stockClass = (p) => {
    const s = stockTotal(p);
    if (s === 0) return 'out';
    if (s <= p.min_stock) return 'low';
    return 'ok';
  };

  const locLabel = (type) =>
    ({ farmacia: '🏥 Farmacia', guardia: '🚨 Guardia', dispensario: '🏘 Dispensario' }[type] ?? type);

  return (
    <div>
      {error   && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="table-actions">
          <div className="filters">
            <div className="search-input">
              <input
                className="form-control" placeholder="Buscar medicamento o código..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ width: 240 }}
              />
            </div>
            <select className="form-control" style={{ width: 160 }} value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
              <option value="">Todas las categorías</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="form-control" style={{ width: 180 }} value={filterLoc} onChange={(e) => setFilterLoc(e.target.value)}>
              <option value="">Todas las dependencias</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.875rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={showLow} onChange={(e) => setShowLow(e.target.checked)} />
              Solo stock bajo
            </label>
          </div>
          {isAdmin && <button className="btn btn-primary" onClick={openCreate}>+ Nuevo medicamento</button>}
        </div>

        {loading ? <div className="spinner" /> : products.length === 0 ? (
          <div className="empty"><div className="empty-icon">💊</div><p>No hay medicamentos</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Medicamento</th>
                  <th>Categoría</th>
                  <th>{filterLoc ? 'Stock (dependencia)' : 'Stock total'}</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <>
                    <tr key={p.id}>
                      <td><code style={{ fontSize: '.8rem' }}>{p.code}</code></td>
                      <td>
                        <strong>{p.name}</strong>
                        {p.unit && <span style={{ color: 'var(--gray-400)', marginLeft: 4, fontSize: '.8rem' }}>/ {p.unit}</span>}
                      </td>
                      <td>{p.category_name || <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                      <td>
                        <div className="stock-bar">
                          <span style={{ fontSize: '.875rem', fontWeight: 600 }}>{stockTotal(p)}</span>
                          <div className="stock-bar-track">
                            <div className={`stock-bar-fill ${stockClass(p)}`} style={{ width: `${stockPct(p)}%` }} />
                          </div>
                          <span style={{ fontSize: '.7rem', color: 'var(--gray-400)' }}>mín. {p.min_stock}</span>
                          {!filterLoc && (
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: '.7rem', padding: '1px 6px' }}
                              title="Ver lotes y dependencias"
                              onClick={() => toggleExpanded(p.id)}
                            >
                              {expanded === p.id ? '▲' : '▼'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td>{stockBadge(p)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" title="Movimiento" onClick={() => openMovement(p)}>↕</button>
                          {isAdmin && <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>✏️</button>}
                          {isAdmin && <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(p.id)}>🗑️</button>}
                        </div>
                      </td>
                    </tr>
                    {expanded === p.id && (
                      <tr key={`${p.id}-detail`}>
                        <td colSpan={6} style={{ background: 'var(--gray-900)', padding: '10px 16px' }}>
                          {/* Stock por ubicación */}
                          {p.stock_locations?.length > 0 && (
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                              {p.stock_locations.map((sl) => (
                                <div key={sl.location_id} style={{
                                  display: 'flex', alignItems: 'center', gap: 6,
                                  padding: '3px 10px', borderRadius: 6,
                                  background: 'var(--gray-800)', fontSize: '.8rem'
                                }}>
                                  <span>{locLabel(sl.location_type)}</span>
                                  <strong style={{ color: sl.quantity <= sl.min_stock ? 'var(--warning)' : 'var(--success)' }}>
                                    {sl.quantity}
                                  </strong>
                                  <span style={{ color: 'var(--gray-500)' }}>{sl.location_name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Lotes */}
                          {lotsMap[p.id]?.length > 0 && (
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', fontSize: '.78rem', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ color: 'var(--gray-400)' }}>
                                    <th style={{ textAlign: 'left', padding: '2px 8px', fontWeight: 600 }}>Lote</th>
                                    <th style={{ textAlign: 'left', padding: '2px 8px', fontWeight: 600 }}>Vencimiento</th>
                                    <th style={{ textAlign: 'left', padding: '2px 8px', fontWeight: 600 }}>Dependencia</th>
                                    <th style={{ textAlign: 'right', padding: '2px 8px', fontWeight: 600 }}>Cant.</th>
                                    <th style={{ textAlign: 'left', padding: '2px 8px', fontWeight: 600 }}>Estado</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {lotsMap[p.id].map((lot) => {
                                    const days = lot.days_until_expiry !== null ? parseInt(lot.days_until_expiry) : null;
                                    const lotColor = days === null ? 'var(--gray-400)'
                                      : days < 0   ? 'var(--danger)'
                                      : days <= 30 ? 'var(--danger)'
                                      : days <= 90 ? 'var(--warning)'
                                      : 'var(--success)';
                                    const lotLabel = days === null ? '—'
                                      : days < 0   ? 'VENCIDO'
                                      : days === 0 ? 'Vence hoy'
                                      : days <= 30 ? `${days}d ⚠️`
                                      : days <= 90 ? `${days}d`
                                      : `${days}d`;
                                    return (
                                      <tr key={lot.id} style={{ borderTop: '1px solid var(--gray-800)' }}>
                                        <td style={{ padding: '3px 8px', color: 'var(--gray-200)' }}>
                                          {lot.lot_number || <span style={{ color: 'var(--gray-600)' }}>Sin lote</span>}
                                        </td>
                                        <td style={{ padding: '3px 8px', fontWeight: 600, color: lotColor }}>
                                          {lot.expiration_date
                                            ? new Date(lot.expiration_date + 'T00:00:00').toLocaleDateString('es-AR')
                                            : <span style={{ color: 'var(--gray-600)' }}>—</span>}
                                        </td>
                                        <td style={{ padding: '3px 8px', color: 'var(--gray-400)' }}>{lot.location_name}</td>
                                        <td style={{ padding: '3px 8px', textAlign: 'right', color: 'var(--gray-200)' }}>{lot.quantity}</td>
                                        <td style={{ padding: '3px 8px', color: lotColor, fontWeight: days !== null && days <= 90 ? 600 : 400 }}>
                                          {lotLabel}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {lotsMap[p.id]?.length === 0 && (
                            <span style={{ fontSize: '.78rem', color: 'var(--gray-600)' }}>Sin lotes registrados</span>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal crear/editar medicamento */}
      {modalProduct !== null && (
        <Modal
          title={modalProduct === 'create' ? 'Nuevo medicamento' : 'Editar medicamento'}
          onClose={() => setModalProduct(null)}
          size="modal-lg"
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setModalProduct(null)}>Cancelar</button>
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
              <input className="form-control" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
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
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Proveedor</label>
              <select className="form-control" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                <option value="">Sin proveedor</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">Precio compra</label>
              <input type="number" className="form-control" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Precio venta</label>
              <input type="number" className="form-control" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Unidad</label>
              <input className="form-control" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="comp, ml, g..." />
            </div>
          </div>
          <div className="form-row">
            {modalProduct === 'create' && (
              <>
                <div className="form-group">
                  <label className="form-label">Stock inicial</label>
                  <input type="number" className="form-control" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Dependencia inicial</label>
                  <select className="form-control" value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })}>
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              </>
            )}
            <div className="form-group">
              <label className="form-label">Stock mínimo</label>
              <input type="number" className="form-control" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de movimiento */}
      {modalMovement && (
        <Modal
          title={`Movimiento: ${modalMovement.name}`}
          onClose={() => setModalMovement(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setModalMovement(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleMovement} disabled={saving}>
                {saving ? 'Registrando...' : 'Registrar'}
              </button>
            </>
          }
        >
          {error && <div className="alert alert-danger">{error}</div>}
          <p style={{ marginBottom: 12, color: 'var(--gray-500)', fontSize: '.875rem' }}>
            Stock total consolidado: <strong>{stockTotal(modalMovement)}</strong> {modalMovement.unit}
          </p>

          {/* Lote y vencimiento — siempre visible */}
          <div className="form-row" style={{ background: 'var(--primary-light)', padding: '10px 12px', borderRadius: 8, border: '1px solid #bfdbfe', marginBottom: 16 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Nro. de lote <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(opcional)</span></label>
              <input
                className="form-control"
                placeholder="Ej: LT-2024-001"
                value={movForm.lot_number}
                onChange={(e) => setMovForm({ ...movForm, lot_number: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Fecha de vencimiento <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(opcional)</span></label>
              <input
                type="date"
                className="form-control"
                value={movForm.expiration_date}
                onChange={(e) => setMovForm({ ...movForm, expiration_date: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Tipo de movimiento</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { key: 'entrada',       label: '⬆ Entrada' },
                { key: 'salida',        label: '⬇ Salida' },
                { key: 'transferencia', label: '↔ Transferencia' },
                { key: 'ajuste',        label: '⚙ Ajuste' },
              ].map(({ key, label }) => (
                <button
                  key={key} type="button"
                  className={`btn ${movForm.type === key ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setMovForm({ ...movForm, type: key })}
                  style={{ flex: 1, minWidth: 100 }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                {movForm.type === 'transferencia' ? 'Origen' : 'Dependencia'}
              </label>
              <select
                className="form-control"
                value={movForm.location_id}
                onChange={(e) => setMovForm({ ...movForm, location_id: e.target.value })}
              >
                <option value="">— Seleccionar —</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              {movForm.location_id && modalMovement.stock_locations && (
                <small style={{ color: 'var(--gray-400)' }}>
                  Stock en esta dependencia: {
                    modalMovement.stock_locations.find(
                      (sl) => sl.location_id === parseInt(movForm.location_id)
                    )?.quantity ?? 0
                  } {modalMovement.unit}
                </small>
              )}
            </div>

            {movForm.type === 'transferencia' && (
              <div className="form-group">
                <label className="form-label">Destino</label>
                <select
                  className="form-control"
                  value={movForm.to_location_id}
                  onChange={(e) => setMovForm({ ...movForm, to_location_id: e.target.value })}
                >
                  <option value="">— Seleccionar —</option>
                  {locations
                    .filter((l) => l.id !== parseInt(movForm.location_id))
                    .map((l) => <option key={l.id} value={l.id}>{l.name}</option>)
                  }
                </select>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">
              {movForm.type === 'ajuste' ? 'Nuevo stock total en dependencia' : 'Cantidad'}
            </label>
            <input
              type="number" className="form-control" min="1"
              value={movForm.quantity}
              onChange={(e) => setMovForm({ ...movForm, quantity: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Motivo</label>
            <input
              className="form-control"
              placeholder="Ej: Compra, Dispensación, Inventario..."
              value={movForm.reason}
              onChange={(e) => setMovForm({ ...movForm, reason: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Referencia / Nro. documento</label>
            <input
              className="form-control"
              placeholder="Remito, factura, receta, etc."
              value={movForm.reference}
              onChange={(e) => setMovForm({ ...movForm, reference: e.target.value })}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
