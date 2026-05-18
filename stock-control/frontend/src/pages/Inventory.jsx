import { useState, useEffect, useRef } from 'react';
import { useInventory, useLocations, useCategories } from '../hooks/useApi';

export default function Inventory() {
  const inventoryApi  = useInventory();
  const locationsApi  = useLocations();
  const categoriesApi = useCategories();

  const [products,    setProducts]    = useState([]);
  const [locations,   setLocations]   = useState([]);
  const [categories,  setCategories]  = useState([]);
  const [quantities,  setQuantities]  = useState({});   // { productId: qty }
  const [dirty,       setDirty]       = useState({});   // { productId: true }

  const [locationId,  setLocationId]  = useState('1');
  const [filterCat,   setFilterCat]   = useState('');
  const [search,      setSearch]      = useState('');

  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');

  const inputRefs = useRef({});

  const loadProducts = (locId, cat, srch) => {
    const params = { location_id: locId };
    if (cat)  params.category = cat;
    if (srch) params.search   = srch;
    return inventoryApi.list(params).then((r) => {
      setProducts(r.data);
      // Inicializar quantities con los valores actuales
      const init = {};
      r.data.forEach((p) => { init[p.id] = p.quantity; });
      setQuantities(init);
      setDirty({});
    });
  };

  useEffect(() => {
    Promise.all([
      loadProducts('1', '', ''),
      locationsApi.list(),
      categoriesApi.list(),
    ])
      .then(([, locs, cats]) => {
        setLocations(locs.data);
        setCategories(cats.data);
      })
      .catch(() => setError('Error cargando datos'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading) {
      setLoading(true);
      loadProducts(locationId, filterCat, search).finally(() => setLoading(false));
    }
  }, [locationId, filterCat]);

  // Búsqueda con debounce local (solo filtra visualmente)
  const filtered = search
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.code.toLowerCase().includes(search.toLowerCase())
      )
    : products;

  const handleQty = (productId, value) => {
    const n = value === '' ? '' : Math.max(0, parseInt(value) || 0);
    setQuantities((prev) => ({ ...prev, [productId]: n }));
    setDirty((prev) => ({ ...prev, [productId]: true }));
  };

  // Tecla Enter → siguiente fila
  const handleKeyDown = (e, productId) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const ids  = filtered.map((p) => p.id);
    const idx  = ids.indexOf(productId);
    const next = ids[idx + 1];
    if (next && inputRefs.current[next]) {
      inputRefs.current[next].focus();
      inputRefs.current[next].select();
    }
  };

  const dirtyCount = Object.keys(dirty).length;

  const handleSave = async () => {
    if (dirtyCount === 0) return;
    setSaving(true);
    setError('');
    try {
      const items = Object.entries(dirty)
        .filter(([id]) => quantities[id] !== '')
        .map(([id]) => ({ product_id: parseInt(id), quantity: quantities[id] || 0 }));

      const res = await inventoryApi.save({ location_id: parseInt(locationId), items });
      setSuccess(res.data.message);
      setDirty({});
      setTimeout(() => setSuccess(''), 4000);
      // Recargar para reflejar estado actualizado
      await loadProducts(locationId, filterCat, search);
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const init = {};
    products.forEach((p) => { init[p.id] = p.quantity; });
    setQuantities(init);
    setDirty({});
  };

  // Agrupado por categoría
  const byCategory = filtered.reduce((acc, p) => {
    const cat = p.category_name || 'Sin categoría';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  const selectedLocation = locations.find((l) => l.id === parseInt(locationId));

  return (
    <div>
      {error   && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* ── Controles ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0, flex: '0 0 220px' }}>
            <label className="form-label" style={{ marginBottom: 4 }}>Ubicación</label>
            <select
              className="form-control"
              value={locationId}
              onChange={(e) => { setLocationId(e.target.value); setDirty({}); }}
            >
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, flex: '0 0 200px' }}>
            <label className="form-label" style={{ marginBottom: 4 }}>Categoría</label>
            <select
              className="form-control"
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
            >
              <option value="">Todas</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, flex: '1 1 200px' }}>
            <label className="form-label" style={{ marginBottom: 4 }}>Buscar</label>
            <input
              className="form-control"
              placeholder="Nombre o código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
            {dirtyCount > 0 && (
              <>
                <button className="btn btn-ghost" onClick={handleReset} disabled={saving}>
                  Descartar ({dirtyCount})
                </button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando...' : `Guardar ${dirtyCount} cambio${dirtyCount !== 1 ? 's' : ''}`}
                </button>
              </>
            )}
          </div>
        </div>
        <p style={{ marginTop: 12, marginBottom: 0, fontSize: '.8rem', color: 'var(--gray-400)' }}>
          💡 Ingresá la cantidad actual de cada ítem en <strong>{selectedLocation?.name ?? '—'}</strong>.
          Usá <kbd>Enter</kbd> para moverte entre filas. Solo se guardan los que modificás.
        </p>
      </div>

      {/* ── Tabla editable ── */}
      {loading ? <div className="spinner" /> : filtered.length === 0 ? (
        <div className="empty"><div className="empty-icon">💊</div><p>Sin resultados</p></div>
      ) : (
        Object.entries(byCategory).map(([cat, items]) => (
          <div key={cat} className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <span className="card-title">{cat}</span>
              <span style={{ fontSize: '.8rem', color: 'var(--gray-400)' }}>
                {items.length} ítems
              </span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>Código</th>
                    <th>Nombre</th>
                    <th style={{ width: 70 }}>Unidad</th>
                    <th style={{ width: 90, textAlign: 'right' }}>Mínimo</th>
                    <th style={{ width: 130, textAlign: 'right' }}>Cantidad actual</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => {
                    const qty     = quantities[p.id] ?? p.quantity;
                    const changed = !!dirty[p.id];
                    const low     = typeof qty === 'number' && qty <= p.min_stock;
                    return (
                      <tr
                        key={p.id}
                        style={{
                          background: changed ? 'rgba(37,99,235,.06)' : undefined,
                          borderLeft: changed ? '3px solid var(--primary)' : '3px solid transparent',
                        }}
                      >
                        <td>
                          <code style={{ fontSize: '.75rem' }}>{p.code}</code>
                        </td>
                        <td>
                          {p.name}
                          {changed && (
                            <span style={{
                              marginLeft: 8, fontSize: '.7rem',
                              background: 'var(--primary)', color: '#fff',
                              borderRadius: 4, padding: '1px 6px',
                            }}>
                              modificado
                            </span>
                          )}
                        </td>
                        <td style={{ color: 'var(--gray-500)', fontSize: '.85rem' }}>{p.unit}</td>
                        <td style={{ textAlign: 'right', color: 'var(--gray-500)', fontSize: '.85rem' }}>
                          {p.min_stock}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            ref={(el) => { inputRefs.current[p.id] = el; }}
                            type="number"
                            min="0"
                            className="form-control"
                            style={{
                              width: 100, textAlign: 'right', marginLeft: 'auto',
                              borderColor: low && qty > 0 ? 'var(--warning)' :
                                           qty === 0   ? 'var(--gray-700)' : undefined,
                            }}
                            value={qty === '' ? '' : qty}
                            onChange={(e) => handleQty(p.id, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => handleKeyDown(e, p.id)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {/* Botón flotante si hay muchos cambios */}
      {dirtyCount > 5 && (
        <div style={{
          position: 'sticky', bottom: 24, display: 'flex', justifyContent: 'flex-end',
          pointerEvents: 'none',
        }}>
          <button
            className="btn btn-primary"
            style={{ pointerEvents: 'all', boxShadow: '0 4px 16px rgba(0,0,0,.4)' }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Guardando...' : `💾 Guardar ${dirtyCount} cambios`}
          </button>
        </div>
      )}
    </div>
  );
}
