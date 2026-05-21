import { useState, useEffect, useCallback, useRef } from 'react';
import { useDispensas, usePersonas, useProducts, useLocations } from '../hooks/useApi';
import Modal from '../components/Modal';

const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-AR') : '—';

export default function Dispensas() {
  const dispensasApi = useDispensas();
  const personasApi  = usePersonas();
  const productsApi  = useProducts();
  const locationsApi = useLocations();

  const [dispensas, setDispensas]     = useState([]);
  const [products, setProducts]       = useState([]);
  const [locations, setLocations]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');

  // Create modal
  const [showCreate, setShowCreate]       = useState(false);
  const [saving, setSaving]               = useState(false);
  const [formError, setFormError]         = useState('');
  const [personaSearch, setPersonaSearch] = useState('');
  const [filteredPersonas, setFilteredPersonas] = useState([]);
  const [showDrop, setShowDrop]           = useState(false);
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [locationId, setLocationId]       = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [items, setItems]                 = useState([]);
  const dropRef = useRef(null);

  // Detail modal
  const [detail, setDetail]               = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(() =>
    dispensasApi.list().then((r) => setDispensas(r.data)), []);

  useEffect(() => {
    Promise.all([
      load(),
      productsApi.list(),
      locationsApi.list(),
    ]).then(([, prods, locs]) => {
      setProducts(prods.data.filter((p) => p.active));
      setLocations(locs.data);
      if (locs.data.length === 1) setLocationId(String(locs.data[0].id));
    }).catch(() => setError('Error cargando datos'))
      .finally(() => setLoading(false));
  }, []);

  // Búsqueda de personas server-side con debounce (evita cargar todas al inicio)
  useEffect(() => {
    if (personaSearch.length < 2) { setFilteredPersonas([]); return; }
    const t = setTimeout(() => {
      personasApi.list({ search: personaSearch, active_only: '1' })
        .then((r) => setFilteredPersonas((r.data || []).slice(0, 8)))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [personaSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const h = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setShowDrop(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3500); };

  const selectPersona = (p) => { setSelectedPersona(p); setPersonaSearch(''); setShowDrop(false); setFilteredPersonas([]); };
  const clearPersona  = () => { setSelectedPersona(null); setPersonaSearch(''); };

  // ─── Items ─────────────────────────────────────────────────────────────────
  const addItem    = () => setItems([...items, { product_id: '', cantidad: 1 }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const setItem    = (i, k, v) => setItems(items.map((it, idx) => idx === i ? { ...it, [k]: v } : it));

  const getProduct    = (id) => products.find((p) => p.id === parseInt(id));
  const usedIds       = new Set(items.map((it) => parseInt(it.product_id)).filter(Boolean));

  // ─── Open create ────────────────────────────────────────────────────────────
  const openCreate = () => {
    setSelectedPersona(null); setPersonaSearch(''); setObservaciones('');
    setItems([]); setFormError('');
    if (locations.length !== 1) setLocationId('');
    setShowCreate(true);
  };

  // ─── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setFormError('');
    if (!selectedPersona)       return setFormError('Seleccioná una persona');
    if (items.length === 0)     return setFormError('Agregá al menos un medicamento');
    for (const it of items) {
      if (!it.product_id)       return setFormError('Seleccioná el medicamento en todos los ítems');
      if (!it.cantidad || parseInt(it.cantidad) < 1) return setFormError('La cantidad debe ser mayor a 0');
      const p = getProduct(it.product_id);
      if (p && parseInt(it.cantidad) > p.stock)
        return setFormError(`Stock insuficiente para ${p.name} (disponible: ${p.stock})`);
    }

    setSaving(true);
    try {
      await dispensasApi.create({
        persona_id:   selectedPersona.id,
        location_id:  locationId || null,
        observaciones: observaciones || null,
        items: items.map((it) => ({
          product_id: parseInt(it.product_id),
          cantidad:   parseInt(it.cantidad),
        })),
      });
      notify('Dispensa registrada correctamente');
      setShowCreate(false);
      const [, prods] = await Promise.all([load(), productsApi.list()]);
      setProducts(prods.data.filter((p) => p.active));
    } catch (e) {
      setFormError(e.response?.data?.error || 'Error al registrar la dispensa');
    } finally { setSaving(false); }
  };

  // ─── View detail ────────────────────────────────────────────────────────────
  const openDetail = async (ref) => {
    setLoadingDetail(true);
    setDetail({ ref });
    try {
      const r = await dispensasApi.get(ref);
      setDetail(r.data);
    } catch { setDetail(null); setError('Error cargando detalle'); }
    finally { setLoadingDetail(false); }
  };

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
                  <th>Referencia</th><th>Fecha</th><th>Persona</th>
                  <th>Ubicación</th><th>Medicamentos</th><th>Operador</th><th></th>
                </tr>
              </thead>
              <tbody>
                {dispensas.map((d) => (
                  <tr key={d.reference}>
                    <td><code style={{ fontSize: '.75rem' }}>{d.reference}</code></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(d.fecha)}</td>
                    <td>
                      <strong>{d.apellido}</strong>{d.nombre ? `, ${d.nombre}` : ''}
                      <br /><span style={{ fontSize: '.75rem', color: 'var(--gray-400)' }}>Doc. {d.documento}</span>
                    </td>
                    <td>{d.location_name || <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                    <td>
                      <span className="badge badge-purple">
                        {d.total_items} ítem{d.total_items !== 1 ? 's' : ''}
                      </span>
                      <span style={{ marginLeft: 6, fontSize: '.8rem', color: 'var(--gray-400)' }}>
                        {d.total_unidades} u.
                      </span>
                    </td>
                    <td style={{ fontSize: '.85rem' }}>{d.user || '—'}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => openDetail(d.reference)}>Ver</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Create modal ─────────────────────────────────────────────────── */}
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

          {/* Persona */}
          <fieldset style={{ border: '1px solid var(--gray-200)', borderRadius: 8, padding: '12px 16px', marginBottom: 14 }}>
            <legend style={{ fontSize: '.75rem', color: 'var(--gray-500)', padding: '0 6px', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Persona
            </legend>
            {selectedPersona ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--gray-100)', borderRadius: 6, padding: '8px 12px', border: '1px solid var(--gray-200)' }}>
                <div>
                  <strong>{selectedPersona.apellido}</strong>{selectedPersona.nombre ? `, ${selectedPersona.nombre}` : ''}
                  <span style={{ marginLeft: 10, fontSize: '.8rem', color: 'var(--gray-500)' }}>
                    Doc. {selectedPersona.documento}
                  </span>
                  {selectedPersona.barrio && (
                    <span style={{ marginLeft: 10, fontSize: '.8rem', color: 'var(--gray-500)' }}>
                      {selectedPersona.barrio}
                    </span>
                  )}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={clearPersona} style={{ fontSize: '.75rem' }}>
                  Cambiar
                </button>
              </div>
            ) : (
              <div ref={dropRef} style={{ position: 'relative' }}>
                <input
                  className="form-control"
                  placeholder="Buscar por documento, apellido o nombre..."
                  value={personaSearch}
                  onChange={(e) => { setPersonaSearch(e.target.value); setShowDrop(true); }}
                  onFocus={() => setShowDrop(true)}
                  autoComplete="off"
                />
                {showDrop && filteredPersonas.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                    background: '#fff', border: '1px solid var(--gray-200)',
                    borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.15)',
                    maxHeight: 240, overflowY: 'auto',
                  }}>
                    {filteredPersonas.map((p) => (
                      <div
                        key={p.id}
                        onMouseDown={() => selectPersona(p)}
                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)', color: 'var(--gray-800)' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gray-50)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = ''}
                      >
                        <strong>{p.apellido}</strong>{p.nombre ? `, ${p.nombre}` : ''}
                        <span style={{ marginLeft: 10, fontSize: '.8rem', color: 'var(--gray-500)' }}>Doc. {p.documento}</span>
                        {p.barrio && <span style={{ marginLeft: 8, fontSize: '.75rem', color: 'var(--gray-400)' }}>{p.barrio}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {showDrop && personaSearch.length >= 2 && filteredPersonas.length === 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                    background: '#fff', border: '1px solid var(--gray-200)',
                    borderRadius: 6, padding: '10px 12px', fontSize: '.875rem', color: 'var(--gray-500)',
                  }}>
                    Sin resultados
                  </div>
                )}
              </div>
            )}
          </fieldset>

          {/* Ubicación y observaciones */}
          <div className="form-row" style={{ marginBottom: 14 }}>
            {locations.length > 0 && (
              <div className="form-group">
                <label className="form-label">Ubicación / Servicio</label>
                <select className="form-control" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                  <option value="">— Sin especificar —</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name} ({l.type})</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Observaciones</label>
              <input
                className="form-control"
                placeholder="Opcional..."
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
              />
            </div>
          </div>

          {/* Medicamentos */}
          <fieldset style={{ border: '1px solid var(--gray-200)', borderRadius: 8, padding: '12px 16px' }}>
            <legend style={{ fontSize: '.75rem', color: 'var(--gray-500)', padding: '0 6px', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Medicamentos
            </legend>
            {items.length === 0 && (
              <p style={{ color: 'var(--gray-500)', fontSize: '.875rem', marginBottom: 8 }}>
                Ningún medicamento agregado aún.
              </p>
            )}
            {items.map((item, idx) => {
              const prod  = getProduct(item.product_id);
              const isOver = prod && parseInt(item.cantidad) > prod.stock;
              return (
                <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <div style={{ flex: 3 }}>
                    <select
                      className="form-control"
                      value={item.product_id}
                      onChange={(e) => setItem(idx, 'product_id', e.target.value)}
                    >
                      <option value="">Seleccionar medicamento...</option>
                      {products
                        .filter((p) => !usedIds.has(p.id) || p.id === parseInt(item.product_id))
                        .map((p) => (
                          <option key={p.id} value={p.id} disabled={p.stock === 0}>
                            {p.name}{p.therapeutic_action ? ` — ${p.therapeutic_action}` : ''} (stock: {p.stock} {p.unit})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div style={{ width: 90 }}>
                    <input
                      type="number" className="form-control" min="1"
                      max={prod ? prod.stock : undefined}
                      value={item.cantidad}
                      onChange={(e) => setItem(idx, 'cantidad', e.target.value)}
                      style={isOver ? { borderColor: 'var(--red-500)' } : {}}
                    />
                  </div>
                  {prod && (
                    <span style={{ fontSize: '.75rem', color: isOver ? 'var(--red-400)' : 'var(--gray-400)', whiteSpace: 'nowrap' }}>
                      / {prod.stock}
                    </span>
                  )}
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeItem(idx)}>✕</button>
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

      {/* ─── Detail modal ─────────────────────────────────────────────────── */}
      {detail && (
        <Modal
          title={`Dispensa ${detail.reference ?? ''}`}
          onClose={() => setDetail(null)}
          size="modal-lg"
        >
          {loadingDetail ? <div className="spinner" /> : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', marginBottom: 16 }}>
                <div>
                  <span style={{ fontSize: '.75rem', color: 'var(--gray-400)' }}>Persona</span>
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    {detail.apellido}{detail.nombre ? `, ${detail.nombre}` : ''}
                  </p>
                  <p style={{ margin: 0, fontSize: '.8rem', color: 'var(--gray-400)' }}>Doc. {detail.documento}</p>
                </div>
                <div>
                  <span style={{ fontSize: '.75rem', color: 'var(--gray-400)' }}>Fecha</span>
                  <p style={{ margin: 0 }}>{fmtDate(detail.fecha)}</p>
                </div>
                <div>
                  <span style={{ fontSize: '.75rem', color: 'var(--gray-400)' }}>Ubicación</span>
                  <p style={{ margin: 0 }}>{detail.location_name || '—'}</p>
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
                      <th>Código</th><th>Medicamento</th><th>Acción terap.</th>
                      <th>Cantidad</th><th>Stock previo</th><th>Stock final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.items || []).map((it) => (
                      <tr key={it.id}>
                        <td><code style={{ fontSize: '.8rem' }}>{it.product_code}</code></td>
                        <td>{it.product_name}</td>
                        <td style={{ fontSize: '.8rem', color: 'var(--gray-400)' }}>
                          {it.therapeutic_action || '—'}
                        </td>
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
