import { useState, useEffect, useCallback, useRef } from 'react';
import { useDispensas, usePersonas, useMedicamentos, useUbicaciones } from '../hooks/useApi';
import { formatFechaHora } from '../utils/format';
import Modal from '../components/Modal';

export default function Dispensas() {
  const dispensas = useDispensas();
  const personas = usePersonas();
  const medicamentos = useMedicamentos();
  const ubicaciones = useUbicaciones();

  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [locs, setLocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Búsqueda/selección de persona
  const [personSearch, setPersonSearch] = useState('');
  const [personSuggestions, setPersonSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const suggestionsRef = useRef(null);

  const [locationId, setLocationId] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [lineItems, setLineItems] = useState([]);

  const [viewing, setViewing] = useState(null);
  const [viewingLoading, setViewingLoading] = useState(false);

  const load = useCallback(() => dispensas.list().then((r) => setItems(r.data)), []);

  useEffect(() => {
    Promise.allSettled([load(), medicamentos.list(), ubicaciones.list()]).then(([, p, l]) => {
      if (p.status === 'fulfilled') setProducts(p.value.data.filter((x) => x.active));
      if (l.status === 'fulfilled') {
        setLocs(l.value.data);
        if (l.value.data.length === 1) setLocationId(String(l.value.data[0].id));
      }
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (personSearch.length < 2) { setPersonSuggestions([]); return; }
    const t = setTimeout(() => {
      personas.list({ search: personSearch, active_only: '1' }).then((r) => setPersonSuggestions((r.data || []).slice(0, 8))).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [personSearch]);

  useEffect(() => {
    const handler = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3500); };

  const selectPerson = (p) => { setSelectedPerson(p); setPersonSearch(''); setShowSuggestions(false); setPersonSuggestions([]); };
  const clearPerson = () => { setSelectedPerson(null); setPersonSearch(''); };

  const addLineItem = () => setLineItems([...lineItems, { product_id: '', cantidad: 1 }]);
  const removeLineItem = (idx) => setLineItems(lineItems.filter((_, i) => i !== idx));
  const updateLineItem = (idx, field, value) => setLineItems(lineItems.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));

  const findProduct = (id) => products.find((p) => p.id === parseInt(id));
  const selectedProductIds = new Set(lineItems.map((it) => parseInt(it.product_id)).filter(Boolean));

  const openCreate = () => {
    setSelectedPerson(null);
    setPersonSearch('');
    setObservaciones('');
    setLineItems([]);
    setFormError('');
    if (locs.length !== 1) setLocationId('');
    setModal(true);
  };

  const handleSave = async () => {
    setFormError('');
    if (!selectedPerson) { setFormError('Seleccioná una persona'); return; }
    if (lineItems.length === 0) { setFormError('Agregá al menos un medicamento'); return; }
    for (const it of lineItems) {
      if (!it.product_id) { setFormError('Seleccioná el medicamento en todos los ítems'); return; }
      if (!it.cantidad || parseInt(it.cantidad) < 1) { setFormError('La cantidad debe ser mayor a 0'); return; }
      const p = findProduct(it.product_id);
      if (p && parseInt(it.cantidad) > p.stock) { setFormError(`Stock insuficiente para ${p.name} (disponible: ${p.stock})`); return; }
    }

    setSaving(true);
    try {
      await dispensas.create({
        persona_id: selectedPerson.id,
        location_id: locationId || null,
        observaciones: observaciones || null,
        items: lineItems.map((it) => ({ product_id: parseInt(it.product_id), cantidad: parseInt(it.cantidad) })),
      });
      notify('Dispensa registrada correctamente');
      setModal(false);
      const [, p] = await Promise.all([load(), medicamentos.list()]);
      setProducts(p.data.filter((x) => x.active));
    } catch (e) {
      setFormError(e.response?.data?.error || 'Error al registrar la dispensa');
    } finally {
      setSaving(false);
    }
  };

  const openView = async (ref) => {
    setViewingLoading(true);
    setViewing({ ref });
    try {
      const r = await dispensas.get(ref);
      setViewing(r.data);
    } catch {
      setViewing(null);
      setError('Error cargando detalle');
    } finally {
      setViewingLoading(false);
    }
  };

  return (
    <div>
      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="table-actions">
          <div />
          <button className="btn btn-primary" onClick={openCreate}>+ Nueva dispensa</button>
        </div>

        {loading ? (
          <div className="spinner" />
        ) : items.length === 0 ? (
          <div className="empty"><div className="empty-icon">💊</div><p>No hay dispensas registradas</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Referencia</th><th>Fecha</th><th>Persona</th><th>Ubicación</th><th>Medicamentos</th><th>Operador</th><th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((d) => (
                  <tr key={d.reference}>
                    <td><code style={{ fontSize: '.75rem' }}>{d.reference}</code></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatFechaHora(d.fecha)}</td>
                    <td>
                      <strong>{d.apellido}</strong>{d.nombre ? `, ${d.nombre}` : ''}
                      <br />
                      <span style={{ fontSize: '.75rem', color: 'var(--gray-400)' }}>Doc. {d.documento}</span>
                    </td>
                    <td>{d.location_name || <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                    <td>
                      <span className="badge badge-purple">{d.total_items} ítem{d.total_items !== 1 ? 's' : ''}</span>
                      <span style={{ marginLeft: 6, fontSize: '.8rem', color: 'var(--gray-400)' }}>{d.total_unidades} u.</span>
                    </td>
                    <td style={{ fontSize: '.85rem' }}>{d.user || '—'}</td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => openView(d.reference)}>Ver</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <Modal
          title="Nueva Dispensa"
          onClose={() => setModal(false)}
          size="modal-lg"
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Registrando...' : 'Confirmar dispensa'}</button>
            </>
          }
        >
          {formError && <div className="alert alert-danger">{formError}</div>}

          <fieldset style={{ border: '1px solid var(--gray-200)', borderRadius: 8, padding: '12px 16px', marginBottom: 14 }}>
            <legend style={{ fontSize: '.75rem', color: 'var(--gray-500)', padding: '0 6px', textTransform: 'uppercase', letterSpacing: '.05em' }}>Persona</legend>
            {selectedPerson ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--gray-100)', borderRadius: 6, padding: '8px 12px', border: '1px solid var(--gray-200)' }}>
                <div>
                  <strong>{selectedPerson.apellido}</strong>{selectedPerson.nombre ? `, ${selectedPerson.nombre}` : ''}
                  <span style={{ marginLeft: 10, fontSize: '.8rem', color: 'var(--gray-500)' }}>Doc. {selectedPerson.documento}</span>
                  {selectedPerson.barrio && <span style={{ marginLeft: 10, fontSize: '.8rem', color: 'var(--gray-500)' }}>{selectedPerson.barrio}</span>}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={clearPerson} style={{ fontSize: '.75rem' }}>Cambiar</button>
              </div>
            ) : (
              <div ref={suggestionsRef} style={{ position: 'relative' }}>
                <input
                  className="form-control"
                  placeholder="Buscar por documento, apellido o nombre..."
                  value={personSearch}
                  onChange={(e) => { setPersonSearch(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  autoComplete="off"
                />
                {showSuggestions && personSuggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.15)', maxHeight: 240, overflowY: 'auto' }}>
                    {personSuggestions.map((p) => (
                      <div
                        key={p.id}
                        onMouseDown={() => selectPerson(p)}
                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)', color: 'var(--gray-800)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--gray-50)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                      >
                        <strong>{p.apellido}</strong>{p.nombre ? `, ${p.nombre}` : ''}
                        <span style={{ marginLeft: 10, fontSize: '.8rem', color: 'var(--gray-500)' }}>Doc. {p.documento}</span>
                        {p.barrio && <span style={{ marginLeft: 8, fontSize: '.75rem', color: 'var(--gray-400)' }}>{p.barrio}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {showSuggestions && personSearch.length >= 2 && personSuggestions.length === 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 6, padding: '10px 12px', fontSize: '.875rem', color: 'var(--gray-500)' }}>
                    Sin resultados
                  </div>
                )}
              </div>
            )}
          </fieldset>

          <div className="form-row" style={{ marginBottom: 14 }}>
            {locs.length > 0 && (
              <div className="form-group">
                <label className="form-label">Ubicación / Servicio</label>
                <select className="form-control" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                  <option value="">— Sin especificar —</option>
                  {locs.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.type})</option>)}
                </select>
              </div>
            )}
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Observaciones</label>
              <input className="form-control" placeholder="Opcional..." value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
            </div>
          </div>

          <fieldset style={{ border: '1px solid var(--gray-200)', borderRadius: 8, padding: '12px 16px' }}>
            <legend style={{ fontSize: '.75rem', color: 'var(--gray-500)', padding: '0 6px', textTransform: 'uppercase', letterSpacing: '.05em' }}>Medicamentos</legend>
            {lineItems.length === 0 && <p style={{ color: 'var(--gray-500)', fontSize: '.875rem', marginBottom: 8 }}>Ningún medicamento agregado aún.</p>}
            {lineItems.map((it, idx) => {
              const p = findProduct(it.product_id);
              const exceeds = p && parseInt(it.cantidad) > p.stock;
              return (
                <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <div style={{ flex: 3 }}>
                    <select className="form-control" value={it.product_id} onChange={(e) => updateLineItem(idx, 'product_id', e.target.value)}>
                      <option value="">Seleccionar medicamento...</option>
                      {products.filter((prod) => !selectedProductIds.has(prod.id) || prod.id === parseInt(it.product_id)).map((prod) => (
                        <option key={prod.id} value={prod.id} disabled={prod.stock === 0}>
                          {prod.name}{prod.therapeutic_action ? ` — ${prod.therapeutic_action}` : ''} (stock: {prod.stock} {prod.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ width: 90 }}>
                    <input
                      type="number"
                      className="form-control"
                      min="1"
                      max={p ? p.stock : undefined}
                      value={it.cantidad}
                      onChange={(e) => updateLineItem(idx, 'cantidad', e.target.value)}
                      style={exceeds ? { borderColor: 'var(--danger)' } : {}}
                    />
                  </div>
                  {p && <span style={{ fontSize: '.75rem', color: exceeds ? 'var(--danger)' : 'var(--gray-400)', whiteSpace: 'nowrap' }}>/ {p.stock}</span>}
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeLineItem(idx)}>✕</button>
                </div>
              );
            })}
            <button className="btn btn-ghost btn-sm" onClick={addLineItem} style={{ marginTop: 4 }} disabled={products.filter((p) => p.stock > 0).length === 0}>
              + Agregar medicamento
            </button>
          </fieldset>
        </Modal>
      )}

      {viewing && (
        <Modal title={`Dispensa ${viewing.reference ?? ''}`} onClose={() => setViewing(null)} size="modal-lg">
          {viewingLoading ? <div className="spinner" /> : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', marginBottom: 16 }}>
                <div>
                  <span style={{ fontSize: '.75rem', color: 'var(--gray-400)' }}>Persona</span>
                  <p style={{ margin: 0, fontWeight: 600 }}>{viewing.apellido}{viewing.nombre ? `, ${viewing.nombre}` : ''}</p>
                  <p style={{ margin: 0, fontSize: '.8rem', color: 'var(--gray-400)' }}>Doc. {viewing.documento}</p>
                </div>
                <div>
                  <span style={{ fontSize: '.75rem', color: 'var(--gray-400)' }}>Fecha</span>
                  <p style={{ margin: 0 }}>{formatFechaHora(viewing.fecha)}</p>
                </div>
                <div>
                  <span style={{ fontSize: '.75rem', color: 'var(--gray-400)' }}>Ubicación</span>
                  <p style={{ margin: 0 }}>{viewing.location_name || '—'}</p>
                </div>
                <div>
                  <span style={{ fontSize: '.75rem', color: 'var(--gray-400)' }}>Operador</span>
                  <p style={{ margin: 0 }}>{viewing.user || '—'}</p>
                </div>
                {viewing.observaciones && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: '.75rem', color: 'var(--gray-400)' }}>Observaciones</span>
                    <p style={{ margin: 0 }}>{viewing.observaciones}</p>
                  </div>
                )}
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Código</th><th>Medicamento</th><th>Acción terap.</th><th>Cantidad</th><th>Stock previo</th><th>Stock final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewing.items || []).map((it) => (
                      <tr key={it.id}>
                        <td><code style={{ fontSize: '.8rem' }}>{it.product_code}</code></td>
                        <td>{it.product_name}</td>
                        <td style={{ fontSize: '.8rem', color: 'var(--gray-400)' }}>{it.therapeutic_action || '—'}</td>
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
