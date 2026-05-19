import { useState, useEffect } from 'react';
import { useProducts, useLocations, useCategories, useLots } from '../hooks/useApi';
import Modal from '../components/Modal';

const emptyForm = { lot_number: '', expiration_date: '', quantity: '', location_id: '' };

export default function Lots() {
  const productsApi   = useProducts();
  const locationsApi  = useLocations();
  const categoriesApi = useCategories();
  const lotsApi       = useLots();

  const [products,   setProducts]   = useState([]);
  const [locations,  setLocations]  = useState([]);
  const [categories, setCategories] = useState([]);
  const [lotsMap,    setLotsMap]    = useState({});
  const [expanded,   setExpanded]   = useState(null);

  const [search,    setSearch]    = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');

  const [modal,  setModal]  = useState(null); // product object
  const [form,   setForm]   = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      productsApi.list({}),
      locationsApi.list(),
      categoriesApi.list(),
    ])
      .then(([prods, locs, cats]) => {
        setProducts(prods.data);
        setLocations(locs.data);
        setCategories(cats.data);
      })
      .catch(() => setError('Error cargando datos'))
      .finally(() => setLoading(false));
  }, []);

  const loadLots = (productId) =>
    lotsApi.list({ product_id: productId })
      .then((r) => setLotsMap((prev) => ({ ...prev, [productId]: r.data })));

  const toggleExpanded = (productId) => {
    const next = expanded === productId ? null : productId;
    setExpanded(next);
    if (next && !lotsMap[next]) loadLots(next);
  };

  const openModal = (product) => {
    setForm({ ...emptyForm, location_id: locations[0]?.id?.toString() || '1' });
    setModal(product);
    setError('');
  };

  const handleSave = async () => {
    if (!form.quantity || parseInt(form.quantity) <= 0) {
      setError('La cantidad debe ser mayor a 0');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await lotsApi.create({
        product_id:      modal.id,
        location_id:     parseInt(form.location_id),
        lot_number:      form.lot_number || null,
        expiration_date: form.expiration_date || null,
        quantity:        parseInt(form.quantity),
      });
      setSuccess(`Lote cargado para ${modal.name}`);
      setTimeout(() => setSuccess(''), 4000);
      setModal(null);
      // Refrescar lotes si estaba expandido
      if (expanded === modal.id) loadLots(modal.id);
      // Refrescar productos para actualizar stock
      productsApi.list({}).then((r) => setProducts(r.data));
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const filtered = products.filter((p) => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || String(p.category_id) === String(filterCat);
    return matchSearch && matchCat;
  });

  const byCategory = filtered.reduce((acc, p) => {
    const cat = p.category_name || 'Sin categoría';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  const lotColor = (days) => {
    if (days === null) return 'var(--gray-400)';
    if (days < 0)   return 'var(--danger)';
    if (days <= 30) return 'var(--danger)';
    if (days <= 90) return 'var(--warning)';
    return 'var(--success)';
  };

  const lotLabel = (days) => {
    if (days === null) return '—';
    if (days < 0)   return 'VENCIDO';
    if (days === 0) return 'Vence hoy';
    return `${days}d`;
  };

  return (
    <div>
      {error   && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0, flex: '1 1 220px' }}>
            <label className="form-label" style={{ marginBottom: 4 }}>Buscar</label>
            <input
              className="form-control"
              placeholder="Nombre o código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ margin: 0, flex: '0 0 200px' }}>
            <label className="form-label" style={{ marginBottom: 4 }}>Categoría</label>
            <select className="form-control" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
              <option value="">Todas</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <p style={{ marginTop: 12, marginBottom: 0, fontSize: '.8rem', color: 'var(--gray-400)' }}>
          💡 Usá esta pantalla para registrar lotes y fechas de vencimiento de los medicamentos ya cargados.
        </p>
      </div>

      {/* Tabla por categoría */}
      {loading ? <div className="spinner" /> : filtered.length === 0 ? (
        <div className="empty"><div className="empty-icon">💊</div><p>Sin resultados</p></div>
      ) : (
        Object.entries(byCategory).map(([cat, items]) => (
          <div key={cat} className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <span className="card-title">{cat}</span>
              <span style={{ fontSize: '.8rem', color: 'var(--gray-400)' }}>{items.length} ítems</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>Código</th>
                    <th>Medicamento</th>
                    <th style={{ width: 120 }}>Stock total</th>
                    <th style={{ width: 80 }}>Lotes</th>
                    <th style={{ width: 160 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => {
                    const lots    = lotsMap[p.id] ?? [];
                    const isOpen  = expanded === p.id;
                    const hasLots = isOpen && lots.length > 0;
                    return (
                      <>
                        <tr key={p.id}>
                          <td><code style={{ fontSize: '.75rem' }}>{p.code}</code></td>
                          <td>
                            <strong>{p.name}</strong>
                            {p.therapeutic_action && (
                              <div style={{ fontSize: '.72rem', color: 'var(--gray-400)', marginTop: 2 }}>
                                {p.therapeutic_action}
                              </div>
                            )}
                          </td>
                          <td style={{ fontWeight: 600 }}>{p.stock_total ?? p.stock ?? 0} {p.unit}</td>
                          <td>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: '.7rem' }}
                              onClick={() => toggleExpanded(p.id)}
                            >
                              {isOpen ? '▲ Ocultar' : `▼ Ver${lots.length ? ` (${lots.length})` : ''}`}
                            </button>
                          </td>
                          <td>
                            <button className="btn btn-primary btn-sm" onClick={() => openModal(p)}>
                              + Agregar lote
                            </button>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr key={`${p.id}-lots`}>
                            <td colSpan={5} style={{ background: 'var(--gray-900)', padding: '10px 16px' }}>
                              {!lotsMap[p.id] ? (
                                <div className="spinner" style={{ width: 20, height: 20 }} />
                              ) : lots.length === 0 ? (
                                <span style={{ fontSize: '.8rem', color: 'var(--gray-500)' }}>
                                  Sin lotes registrados
                                </span>
                              ) : (
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
                                    {lots.map((lot) => {
                                      const days = lot.days_until_expiry !== null ? parseInt(lot.days_until_expiry) : null;
                                      const color = lotColor(days);
                                      return (
                                        <tr key={lot.id} style={{ borderTop: '1px solid var(--gray-800)' }}>
                                          <td style={{ padding: '3px 8px', color: 'var(--gray-200)' }}>
                                            {lot.lot_number || <span style={{ color: 'var(--gray-600)' }}>Sin nro.</span>}
                                          </td>
                                          <td style={{ padding: '3px 8px', fontWeight: 600, color }}>
                                            {lot.expiration_date
                                              ? new Date(lot.expiration_date + 'T00:00:00').toLocaleDateString('es-AR')
                                              : <span style={{ color: 'var(--gray-600)' }}>—</span>}
                                          </td>
                                          <td style={{ padding: '3px 8px', color: 'var(--gray-400)' }}>{lot.location_name}</td>
                                          <td style={{ padding: '3px 8px', textAlign: 'right', color: 'var(--gray-200)' }}>{lot.quantity}</td>
                                          <td style={{ padding: '3px 8px', color, fontWeight: days !== null && days <= 90 ? 600 : 400 }}>
                                            {lotLabel(days)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {/* Modal agregar lote */}
      {modal && (
        <Modal
          title={`Agregar lote: ${modal.name}`}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Registrar lote'}
              </button>
            </>
          }
        >
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nro. de lote <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(opcional)</span></label>
              <input
                className="form-control"
                placeholder="Ej: LT-2024-001"
                value={form.lot_number}
                onChange={(e) => setForm({ ...form, lot_number: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha de vencimiento <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(opcional)</span></label>
              <input
                type="date"
                className="form-control"
                value={form.expiration_date}
                onChange={(e) => setForm({ ...form, expiration_date: e.target.value })}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Cantidad *</label>
              <input
                type="number"
                min="1"
                className="form-control"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Dependencia *</label>
              <select
                className="form-control"
                value={form.location_id}
                onChange={(e) => setForm({ ...form, location_id: e.target.value })}
              >
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
