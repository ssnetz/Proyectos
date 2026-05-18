import { useState, useEffect, useCallback } from 'react';
import { useProducts, useCategories, useSuppliers, useMovements } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const emptyProduct = {
  code: '', name: '', description: '', category_id: '', supplier_id: '',
  purchase_price: '', sale_price: '', stock: '', min_stock: '5', unit: 'unidad',
};

export default function Products() {
  const productsApi   = useProducts();
  const categoriesApi = useCategories();
  const suppliersApi  = useSuppliers();
  const movementsApi  = useMovements();
  const { user }      = useAuth();
  const isAdmin       = user?.role === 'admin';

  const [products, setProducts]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');

  const [search, setSearch]         = useState('');
  const [filterCat, setFilterCat]   = useState('');
  const [showLow, setShowLow]       = useState(false);

  const [modalProduct, setModalProduct] = useState(null);
  const [modalMovement, setModalMovement] = useState(null);
  const [form, setForm]             = useState(emptyProduct);
  const [movForm, setMovForm]       = useState({ type: 'entrada', quantity: '', reason: '', reference: '' });
  const [saving, setSaving]         = useState(false);

  const loadProducts = useCallback(() => {
    const params = {};
    if (search) params.search = search;
    if (filterCat) params.category = filterCat;
    if (showLow) params.low_stock = '1';
    return productsApi.list(params).then((r) => setProducts(r.data));
  }, [search, filterCat, showLow]);

  useEffect(() => {
    Promise.all([loadProducts(), categoriesApi.list(), suppliersApi.list()])
      .then(([, cats, sups]) => {
        setCategories(cats.data);
        setSuppliers(sups.data);
      })
      .catch(() => setError('Error cargando datos'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading) loadProducts().catch(() => {});
  }, [search, filterCat, showLow]);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = () => { setForm(emptyProduct); setModalProduct('create'); };
  const openEdit   = (p) => {
    setForm({
      code: p.code, name: p.name, description: p.description || '',
      category_id: p.category_id || '', supplier_id: p.supplier_id || '',
      purchase_price: p.purchase_price, sale_price: p.sale_price,
      stock: p.stock, min_stock: p.min_stock, unit: p.unit,
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
    setMovForm({ type: 'entrada', quantity: '', reason: '', reference: '' });
  };

  const handleMovement = async () => {
    setSaving(true);
    setError('');
    try {
      await movementsApi.create({ ...movForm, product_id: modalMovement.id });
      notify('Movimiento registrado');
      setModalMovement(null);
      await loadProducts();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al registrar movimiento');
    } finally {
      setSaving(false);
    }
  };

  const stockBadge = (p) => {
    if (p.stock === 0) return <span className="badge badge-red">Sin stock</span>;
    if (p.stock <= p.min_stock) return <span className="badge badge-yellow">Stock bajo</span>;
    return <span className="badge badge-green">OK</span>;
  };

  const stockPct = (p) => {
    if (p.min_stock === 0) return 100;
    return Math.min(100, Math.round((p.stock / (p.min_stock * 2)) * 100));
  };

  const stockClass = (p) => {
    if (p.stock === 0) return 'out';
    if (p.stock <= p.min_stock) return 'low';
    return 'ok';
  };

  return (
    <div>
      {error   && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="table-actions">
          <div className="filters">
            <div className="search-input">
              <input
                className="form-control" placeholder="Buscar medicamento..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ width: 240 }}
              />
            </div>
            <select className="form-control" style={{ width: 160 }} value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
              <option value="">Todas las categorías</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.875rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={showLow} onChange={(e) => setShowLow(e.target.checked)} />
              Solo stock bajo
            </label>
          </div>
          {isAdmin && <button className="btn btn-primary" onClick={openCreate}>+ Nuevo medicamento</button>}
        </div>

        {loading ? <div className="spinner" /> : products.length === 0 ? (
          <div className="empty"><div className="empty-icon">📦</div><p>No hay medicamentos</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th><th>Nombre</th><th>Categoría</th><th>Proveedor</th>
                  <th>Precio venta</th><th>Stock</th><th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td><code style={{ fontSize: '.8rem' }}>{p.code}</code></td>
                    <td><strong>{p.name}</strong>{p.unit && <span style={{ color: 'var(--gray-400)', marginLeft: 4, fontSize: '.8rem' }}>/ {p.unit}</span>}</td>
                    <td>{p.category_name || <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                    <td>{p.supplier_name || <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                    <td>${Number(p.sale_price).toLocaleString('es-AR')}</td>
                    <td>
                      <div className="stock-bar">
                        <span style={{ fontSize: '.875rem', fontWeight: 600 }}>{p.stock}</span>
                        <div className="stock-bar-track">
                          <div className={`stock-bar-fill ${stockClass(p)}`} style={{ width: `${stockPct(p)}%` }} />
                        </div>
                        <span style={{ fontSize: '.7rem', color: 'var(--gray-400)' }}>mín. {p.min_stock}</span>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
              <label className="form-label">Precio venta *</label>
              <input type="number" className="form-control" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Unidad</label>
              <input className="form-control" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            {modalProduct === 'create' && (
              <div className="form-group">
                <label className="form-label">Stock inicial</label>
                <input type="number" className="form-control" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Stock mínimo</label>
              <input type="number" className="form-control" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
            </div>
          </div>
        </Modal>
      )}

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
          <p style={{ marginBottom: 16, color: 'var(--gray-500)', fontSize: '.875rem' }}>
            Stock actual: <strong>{modalMovement.stock}</strong> {modalMovement.unit}
          </p>
          <div className="form-group">
            <label className="form-label">Tipo de movimiento</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['entrada', 'salida', 'ajuste'].map((t) => (
                <button
                  key={t} type="button"
                  className={`btn ${movForm.type === t ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setMovForm({ ...movForm, type: t })}
                  style={{ textTransform: 'capitalize', flex: 1 }}
                >
                  {t === 'entrada' ? '⬆ Entrada' : t === 'salida' ? '⬇ Salida' : '⚙ Ajuste'}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">
              {movForm.type === 'ajuste' ? 'Nuevo stock total' : 'Cantidad'}
            </label>
            <input
              type="number" className="form-control" min="1"
              value={movForm.quantity}
              onChange={(e) => setMovForm({ ...movForm, quantity: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Motivo</label>
            <input className="form-control" placeholder="Ej: Compra proveedor, Venta, Inventario..." value={movForm.reason} onChange={(e) => setMovForm({ ...movForm, reason: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Referencia / Nro. documento</label>
            <input className="form-control" placeholder="Factura, remito, etc." value={movForm.reference} onChange={(e) => setMovForm({ ...movForm, reference: e.target.value })} />
          </div>
        </Modal>
      )}
    </div>
  );
}
