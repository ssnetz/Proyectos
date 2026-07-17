import { useState, useEffect, useRef } from 'react';
import { useFacturas, useMedicamentos, useProveedores, useUbicaciones } from '../hooks/useApi';
import { formatFechaISO } from '../utils/format';
import {
  emptyFacturaItem,
  extractTextFromPdf,
  ocrImages,
  parseInvoiceHeader,
  parseItemsFromInvoiceLines,
  parseItemsFuzzy,
} from '../utils/facturaOcr';

const emptyForm = () => ({
  invoice_number: '',
  supplier_id: '',
  invoice_date: new Date().toISOString().slice(0, 10),
  location_id: '',
  notes: '',
  items: [emptyFacturaItem()],
});

// Intenta el parser "tabular" primero (líneas con formato reconocible de
// código+cantidad+descripción+lote+vencimiento); si no encuentra nada, cae
// al parser más laxo por ventanas de líneas.
function detectItems(text) {
  const strict = parseItemsFromInvoiceLines(text);
  return strict.length > 0 ? strict : parseItemsFuzzy(text);
}

export default function Facturas() {
  const facturas = useFacturas();
  const medicamentos = useMedicamentos();
  const proveedores = useProveedores();
  const ubicaciones = useUbicaciones();

  const [items, setItems] = useState([]);
  const [supps, setSupps] = useState([]);
  const [locs, setLocs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [createModal, setCreateModal] = useState(false);
  const [viewingId, setViewingId] = useState(null);
  const [viewingFactura, setViewingFactura] = useState(null);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Estado del PDF / OCR
  const [pdfFile, setPdfFile] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [pageImages, setPageImages] = useState([]);
  const [ocrError, setOcrError] = useState('');
  const [processingPdf, setProcessingPdf] = useState(false);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [showExtractedText, setShowExtractedText] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [suggestOcr, setSuggestOcr] = useState(false); // "PDF con texto no compatible, probá OCR"
  const fileInputRef = useRef();

  const [form, setForm] = useState(emptyForm());

  // Sugerencias de medicamento por fila (una entrada por índice de ítem)
  const [suggestionsByRow, setSuggestionsByRow] = useState([null]);
  const debounceRefs = useRef([]);

  const load = () => facturas.list().then((r) => setItems(r.data));

  useEffect(() => {
    setLoading(true);
    Promise.all([load(), proveedores.list(), ubicaciones.list()])
      .then(([, s, l]) => { setSupps(s.data); setLocs(l.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openDetail = async (id) => {
    setViewingId(id);
    const r = await facturas.get(id);
    setViewingFactura(r.data);
  };

  const closeDetail = () => { setViewingId(null); setViewingFactura(null); };

  const openCreate = () => {
    setForm(emptyForm());
    setFormError('');
    setPdfFile(null);
    setExtractedText('');
    setPageImages([]);
    setOcrError('');
    setShowExtractedText(false);
    setOcrProgress(0);
    setDragOver(false);
    setSuggestOcr(false);
    setSuggestionsByRow([null]);
    setCreateModal(true);
  };

  // Aplica los ítems detectados en el texto (extraído del PDF u OCR) al
  // formulario, y si vinieron del parser "tabular" (más confiable) también
  // intenta completar N° de factura y fecha desde el encabezado.
  const applyDetectedItems = (text) => {
    const strict = parseItemsFromInvoiceLines(text);
    const detected = strict.length > 0 ? strict : parseItemsFuzzy(text);
    if (detected.length === 0) return;

    const newItems = detected.map((d) => ({
      ...emptyFacturaItem(),
      product_code: d.product_code || '',
      product_search: '',
      product_description: d.suggested_name || '',
      marca: d.marca || '',
      lot_number: d.lot_number || '',
      expiry_date: d.expiry_date || '',
      quantity: d.quantity || 1,
    }));

    if (strict.length > 0) {
      const header = parseInvoiceHeader(text);
      setForm((f) => ({
        ...f,
        invoice_number: header.invoice_number || f.invoice_number,
        invoice_date: header.invoice_date || f.invoice_date,
        items: newItems,
      }));
    } else {
      setForm((f) => ({ ...f, items: newItems }));
    }
    setSuggestionsByRow(newItems.map(() => null));
  };

  const runOcr = async () => {
    if (!pageImages.length) return;
    setOcrRunning(true);
    setOcrProgress(0);
    setOcrError('');
    setSuggestOcr(false);
    try {
      const text = await ocrImages(pageImages, setOcrProgress);
      if (text.trim()) {
        setExtractedText(text);
        setShowExtractedText(false);
        applyDetectedItems(text);
      } else {
        setOcrError('El OCR no pudo extraer texto. La imagen puede ser de baja calidad.');
      }
    } catch (e) {
      setOcrError('Error en OCR: ' + e.message);
    }
    setOcrRunning(false);
    setOcrProgress(0);
  };

  const handlePdfUpload = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') { setOcrError('El archivo no es un PDF.'); return; }
    setPdfFile(file);
    setProcessingPdf(true);
    setExtractedText('');
    setPageImages([]);
    setOcrError('');
    setSuggestOcr(false);
    try {
      const { text, images } = await extractTextFromPdf(file);
      setPageImages(images);
      if (text.trim()) {
        setExtractedText(text);
        if (parseItemsFromInvoiceLines(text).length > 0) {
          applyDetectedItems(text);
        } else {
          // Hay texto embebido pero no matchea el formato tabular esperado
          // (típico de PDFs "impresos" desde apps de escaneo tipo
          // CamScanner, donde el texto es una sola capa OCR de baja
          // calidad): sugerimos correr OCR sobre las imágenes en su lugar.
          setSuggestOcr(true);
        }
      }
    } catch (err) {
      setOcrError(err.message || 'Error al procesar el PDF.');
    }
    setProcessingPdf(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handlePdfUpload(file);
  };

  const scheduleProductSearch = (query, idx) => {
    clearTimeout(debounceRefs.current[idx]);
    if (query.length < 2) {
      setSuggestionsByRow((s) => { const next = [...s]; next[idx] = null; return next; });
      return;
    }
    debounceRefs.current[idx] = setTimeout(async () => {
      try {
        const r = await medicamentos.list({ search: query, limit: 8 });
        setSuggestionsByRow((s) => { const next = [...s]; next[idx] = r.data; return next; });
      } catch { /* ignore */ }
    }, 300);
  };

  const selectProductForItem = (idx, product) => {
    setForm((f) => {
      const nextItems = [...f.items];
      nextItems[idx] = { ...nextItems[idx], product_id: product.id, product_search: product.name };
      return { ...f, items: nextItems };
    });
    setSuggestionsByRow((s) => { const next = [...s]; next[idx] = null; return next; });
  };

  const addItem = () => {
    setForm((f) => ({ ...f, items: [...f.items, emptyFacturaItem()] }));
    setSuggestionsByRow((s) => [...s, null]);
  };

  const removeItem = (idx) => {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
    setSuggestionsByRow((s) => s.filter((_, i) => i !== idx));
  };

  const updateItem = (idx, field, value) => {
    setForm((f) => {
      const nextItems = [...f.items];
      nextItems[idx] = { ...nextItems[idx], [field]: value };
      return { ...f, items: nextItems };
    });
  };

  const handleSubmit = async () => {
    setFormError('');
    if (form.items.some((it) => !it.product_id || !it.quantity)) {
      setFormError('Completá el producto y cantidad de cada ítem.');
      return;
    }
    if (!form.invoice_number.trim()) {
      setFormError('Ingresá el número de factura.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        invoice_number: form.invoice_number.trim(),
        supplier_id: form.supplier_id || null,
        invoice_date: form.invoice_date,
        location_id: form.location_id || null,
        notes: form.notes || null,
        items: form.items.map((it) => ({
          product_id: it.product_id,
          lot_number: it.lot_number,
          marca: it.marca || null,
          expiry_date: it.expiry_date || null,
          quantity: parseInt(it.quantity, 10),
          location_id: it.location_id || null,
        })),
      };
      await facturas.create(payload);
      setCreateModal(false);
      await load();
    } catch (e) {
      setFormError(e.response?.data?.error || 'Error al guardar');
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta factura? Se revertirá el stock de todos sus lotes.')) return;
    try {
      await facturas.remove(id);
      closeDetail();
      await load();
    } catch (e) {
      alert(e.response?.data?.error || 'Error al eliminar');
    }
  };

  if (loading) return <div className="spinner" style={{ marginTop: 60 }} />;

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Facturas de Compra</h2>
          <button className="btn btn-primary" onClick={openCreate}>+ Nueva Factura</button>
        </div>
        {items.length === 0 ? (
          <p style={{ padding: '2rem', color: 'var(--gray-400)', textAlign: 'center' }}>No hay facturas registradas.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>N° Factura</th><th>Proveedor</th><th>Fecha</th>
                <th style={{ textAlign: 'center' }}>Lotes</th><th style={{ textAlign: 'center' }}>Unidades</th>
                <th>Registrado por</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f.id}>
                  <td><strong>{f.invoice_number}</strong></td>
                  <td>{f.supplier_name || <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                  <td>{formatFechaISO(f.invoice_date)}</td>
                  <td style={{ textAlign: 'center' }}>{f.total_lotes}</td>
                  <td style={{ textAlign: 'center' }}>{f.total_unidades}</td>
                  <td style={{ fontSize: '.85rem', color: 'var(--gray-400)' }}>{f.user}</td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => openDetail(f.id)}>Ver detalle</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {viewingId && (
        <div className="modal-overlay" onClick={closeDetail}>
          <div className="modal" style={{ maxWidth: 800 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Factura {viewingFactura?.invoice_number || '…'}</h3>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={closeDetail}>✕</button>
            </div>
            <div className="modal-body">
              {viewingFactura ? (
                <>
                  <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <span style={{ color: 'var(--gray-400)', fontSize: '.85rem' }}>Proveedor</span><br />
                      <strong>{viewingFactura.supplier_name || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--gray-400)', fontSize: '.85rem' }}>Fecha</span><br />
                      <strong>{formatFechaISO(viewingFactura.invoice_date)}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--gray-400)', fontSize: '.85rem' }}>Registrado por</span><br />
                      <strong>{viewingFactura.user}</strong>
                    </div>
                  </div>
                  {viewingFactura.notes && <p style={{ color: 'var(--gray-400)', marginBottom: '1rem' }}>{viewingFactura.notes}</p>}
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Medicamento</th><th>Código</th><th>Marca</th><th>Lote</th><th>Vencimiento</th>
                        <th style={{ textAlign: 'center' }}>Cantidad</th><th>Ubicación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingFactura.lotes?.map((l) => (
                        <tr key={l.id}>
                          <td>{l.product_name}</td>
                          <td style={{ fontSize: '.85rem', color: 'var(--gray-400)' }}>{l.product_code || '—'}</td>
                          <td style={{ fontSize: '.85rem' }}>{l.marca || '—'}</td>
                          <td>{l.lot_number || '—'}</td>
                          <td>{formatFechaISO(l.expiry_date)}</td>
                          <td style={{ textAlign: 'center' }}>{l.quantity} {l.unit}</td>
                          <td style={{ fontSize: '.85rem' }}>{l.location_name || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <div className="spinner" />
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(viewingId)}>Eliminar y revertir stock</button>
              <button className="btn btn-ghost" onClick={closeDetail}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {createModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '95vw', width: 1200, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3 className="modal-title">Nueva Factura de Compra</h3>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setCreateModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ flex: 1, overflow: 'auto', display: 'flex', gap: '1.5rem', padding: '1rem 1.5rem' }}>
              {/* ─── Columna izquierda: subir PDF / OCR ─────────────────── */}
              <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                <p style={{ fontWeight: 600, marginBottom: 0 }}>PDF del remito / factura</p>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--gray-600)'}`,
                    borderRadius: 8,
                    padding: pageImages.length ? '.6rem 1rem' : '1.5rem 1rem',
                    textAlign: 'center', cursor: 'pointer',
                    background: dragOver ? 'var(--gray-800)' : 'transparent',
                    transition: 'all .2s', color: 'var(--gray-400)', fontSize: '.85rem',
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    style={{ display: 'none' }}
                    onChange={(e) => handlePdfUpload(e.target.files?.[0])}
                  />
                  {pdfFile ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', justifyContent: 'center' }}>
                      <span>📄</span>
                      <span style={{ color: 'var(--gray-200)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{pdfFile.name}</span>
                      <span style={{ fontSize: '.75rem', flexShrink: 0 }}>· cambiar</span>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: '2rem', marginBottom: '.4rem' }}>📂</div>
                      <div>Arrastrá el PDF aquí<br />o hacé clic para seleccionar</div>
                    </>
                  )}
                </div>

                {processingPdf && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', color: 'var(--gray-400)' }}>
                    <div className="spinner" style={{ width: 16, height: 16 }} /> Procesando PDF…
                  </div>
                )}

                {ocrError && !processingPdf && (
                  <div style={{ background: '#450a0a', border: '1px solid #b91c1c', borderRadius: 6, padding: '.6rem', color: '#fca5a5', fontSize: '.82rem' }}>
                    {ocrError}
                  </div>
                )}

                {pageImages.length > 0 && !processingPdf && (
                  <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--gray-700)', borderRadius: 8, background: 'var(--gray-900)', display: 'flex', flexDirection: 'column', gap: 4, padding: 4, maxHeight: 360 }}>
                    {pageImages.map((src, idx) => (
                      <div key={idx}>
                        {pageImages.length > 1 && (
                          <div style={{ fontSize: '.7rem', color: 'var(--gray-500)', textAlign: 'center', padding: '2px 0' }}>Página {idx + 1}</div>
                        )}
                        <img src={src} alt={`Página ${idx + 1}`} style={{ width: '100%', display: 'block', borderRadius: 4 }} />
                      </div>
                    ))}
                  </div>
                )}

                {pageImages.length > 0 && !processingPdf && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                    {suggestOcr && !ocrRunning && (
                      <div style={{ background: 'rgba(234,179,8,.12)', border: '1px solid rgba(234,179,8,.4)', borderRadius: 6, padding: '.5rem .75rem', fontSize: '.8rem', color: '#fbbf24' }}>
                        ⚠️ PDF con texto embebido no compatible (CamScanner).<br />
                        <strong>Usá OCR para detectar ítems correctamente.</strong>
                      </div>
                    )}
                    <button className="btn btn-primary btn-sm" onClick={runOcr} disabled={ocrRunning}>
                      {ocrRunning ? `🔄 Leyendo… ${ocrProgress}%` : suggestOcr ? '🔍 Leer con OCR (recomendado)' : extractedText ? '🔍 Releer con OCR' : '🔍 Leer texto con OCR'}
                    </button>
                    {ocrRunning && (
                      <div style={{ background: 'var(--gray-700)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 99, background: 'var(--primary)', width: `${ocrProgress}%`, transition: 'width .3s' }} />
                      </div>
                    )}
                  </div>
                )}

                {extractedText && !processingPdf && (
                  <div>
                    <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => setShowExtractedText((v) => !v)}>
                      Texto extraído ({extractedText.split('\n').filter((l) => l && !l.startsWith('---')).length} líneas) {showExtractedText ? '▲' : '▼'}
                    </button>
                    {showExtractedText && (
                      <textarea
                        readOnly
                        value={extractedText}
                        style={{ width: '100%', height: 180, fontFamily: 'monospace', fontSize: '.7rem', background: 'var(--gray-900)', border: '1px solid var(--gray-700)', borderRadius: 6, padding: '.5rem', color: 'var(--gray-300)', resize: 'vertical', boxSizing: 'border-box', display: 'block', marginTop: '.25rem' }}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* ─── Columna derecha: formulario ────────────────────────── */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '.75rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">N° Factura *</label>
                    <input className="form-control" placeholder="Ej: 0001-00012345" value={form.invoice_number} onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Fecha</label>
                    <input type="date" className="form-control" value={form.invoice_date} onChange={(e) => setForm((f) => ({ ...f, invoice_date: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Proveedor</label>
                    <select className="form-control" value={form.supplier_id} onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}>
                      <option value="">— Sin especificar —</option>
                      {supps.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Ubicación destino (default)</label>
                    <select className="form-control" value={form.location_id} onChange={(e) => setForm((f) => ({ ...f, location_id: e.target.value }))}>
                      <option value="">— Sin ubicación —</option>
                      {locs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0, gridColumn: '2 / 4' }}>
                    <label className="form-label">Observaciones</label>
                    <input className="form-control" placeholder="Notas opcionales" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
                    <p style={{ fontWeight: 600, margin: 0 }}>Medicamentos ({form.items.length})</p>
                    <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                      {extractedText && <button className="btn btn-ghost btn-sm" onClick={() => applyDetectedItems(extractedText)}>↺ Re-detectar del PDF</button>}
                      <button className="btn btn-ghost btn-sm" onClick={addItem}>+ Agregar fila</button>
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ fontSize: '.82rem' }}>
                      <thead>
                        <tr>
                          <th style={{ minWidth: 180 }}>Medicamento *</th>
                          <th style={{ minWidth: 80 }}>Código</th>
                          <th style={{ minWidth: 160 }}>Descripción</th>
                          <th style={{ minWidth: 90 }}>Marca</th>
                          <th style={{ minWidth: 110 }}>N° Lote</th>
                          <th style={{ minWidth: 120 }}>Vencimiento</th>
                          <th style={{ minWidth: 70 }}>Cantidad *</th>
                          <th style={{ minWidth: 120 }}>Ubicación</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.items.map((item, idx) => (
                          <FacturaItemRow
                            key={idx}
                            idx={idx}
                            item={item}
                            suggestions={suggestionsByRow[idx]}
                            locations={locs}
                            onSearchChange={(value) => { updateItem(idx, 'product_search', value); updateItem(idx, 'product_id', ''); scheduleProductSearch(value, idx); }}
                            onSelectProduct={(p) => selectProductForItem(idx, p)}
                            onCloseSuggestions={() => setSuggestionsByRow((s) => { const next = [...s]; next[idx] = null; return next; })}
                            onUpdate={(field, value) => updateItem(idx, field, value)}
                            onRemove={() => removeItem(idx)}
                            canRemove={form.items.length > 1}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {formError && (
                  <div style={{ background: '#450a0a', border: '1px solid #b91c1c', borderRadius: 6, padding: '.75rem', color: '#fca5a5' }}>{formError}</div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setCreateModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Guardando…' : 'Guardar factura'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Fila de ítem con autocompletado de medicamento por nombre/código.
function FacturaItemRow({ idx, item, suggestions, locations, onSearchChange, onSelectProduct, onCloseSuggestions, onUpdate, onRemove, canRemove }) {
  const cellRef = useRef();

  useEffect(() => {
    function handler(e) {
      if (cellRef.current && !cellRef.current.contains(e.target)) onCloseSuggestions();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <tr>
      <td ref={cellRef} style={{ position: 'relative' }}>
        <input
          className="form-control"
          style={{ fontSize: '.82rem' }}
          placeholder="Buscar medicamento…"
          value={item.product_search}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => item.product_search.length >= 2 && !item.product_id && onSearchChange(item.product_search)}
        />
        {item.product_id && <div style={{ fontSize: '.72rem', color: 'var(--primary)', marginTop: 2 }}>✓ seleccionado</div>}
        {suggestions && suggestions.length > 0 && !item.product_id && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.18)', maxHeight: 220, overflowY: 'auto' }}>
            {suggestions.map((p) => (
              <div
                key={p.id}
                onMouseDown={() => onSelectProduct(p)}
                style={{ padding: '.5rem .75rem', cursor: 'pointer', fontSize: '.82rem', borderBottom: '1px solid #e2e8f0', color: '#1e293b' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
              >
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{p.name}</span>
                <span style={{ color: '#64748b', marginLeft: '.5rem' }}>{p.code}</span>
                <span style={{ color: '#94a3b8', marginLeft: '.5rem', fontSize: '.78rem' }}>Stock: {p.stock}</span>
              </div>
            ))}
          </div>
        )}
        {suggestions && suggestions.length === 0 && !item.product_id && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, padding: '.5rem .75rem', fontSize: '.82rem', color: '#64748b' }}>
            Sin resultados
          </div>
        )}
      </td>
      <td><input className="form-control" style={{ fontSize: '.82rem' }} placeholder="Código" value={item.product_code} onChange={(e) => onUpdate('product_code', e.target.value)} /></td>
      <td><input className="form-control" style={{ fontSize: '.82rem' }} placeholder="Descripción del remito" value={item.product_description} onChange={(e) => onUpdate('product_description', e.target.value)} /></td>
      <td><input className="form-control" style={{ fontSize: '.82rem' }} placeholder="Marca" value={item.marca} onChange={(e) => onUpdate('marca', e.target.value)} /></td>
      <td><input className="form-control" style={{ fontSize: '.82rem' }} placeholder="Nº Lote" value={item.lot_number} onChange={(e) => onUpdate('lot_number', e.target.value)} /></td>
      <td><input type="date" className="form-control" style={{ fontSize: '.82rem' }} value={item.expiry_date} onChange={(e) => onUpdate('expiry_date', e.target.value)} /></td>
      <td><input type="number" className="form-control" style={{ fontSize: '.82rem' }} min={1} value={item.quantity} onChange={(e) => onUpdate('quantity', e.target.value)} /></td>
      <td>
        <select className="form-control" style={{ fontSize: '.82rem' }} value={item.location_id} onChange={(e) => onUpdate('location_id', e.target.value)}>
          <option value="">Default</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </td>
      <td>{canRemove && <button className="btn btn-ghost btn-sm btn-icon" style={{ color: '#f87171' }} onClick={onRemove} title="Eliminar fila">✕</button>}</td>
    </tr>
  );
}
