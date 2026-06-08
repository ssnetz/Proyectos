import { useState, useEffect, useRef } from 'react';
import { useFacturas, useMedicamentos, useProveedores, useUbicaciones } from '../hooks/useApi';
// Worker URL resuelto en build-time por Vite (evita problemas de MIME en XAMPP)
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// ─── PDF.js setup (lazy-load de la lib, worker URL estático) ─────────────────
let pdfjsLib = null;
async function getPdfjs() {
  if (pdfjsLib) return pdfjsLib;
  const lib = await import('pdfjs-dist');
  lib.GlobalWorkerOptions.workerSrc = workerUrl;
  pdfjsLib = lib;
  return pdfjsLib;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ─── PDF text extraction ──────────────────────────────────────────────────────
async function extractPdfText(file) {
  const lib = await getPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data: buf }).promise;
  const allLines = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p);
    const content = await page.getTextContent();

    // Agrupar por coordenada Y para reconstruir filas de tabla
    const byY = {};
    for (const item of content.items) {
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform[5] / 5) * 5;
      (byY[y] ??= []).push({ x: item.transform[4], text: item.str });
    }

    const lines = Object.entries(byY)
      .sort(([ya], [yb]) => +yb - +ya)
      .map(([, items]) => items.sort((a, b) => a.x - b.x).map(i => i.text).join('  ').trim())
      .filter(Boolean);

    if (lines.length > 0) {
      allLines.push(`--- Página ${p} ---`, ...lines);
    }
  }

  const text = allLines.join('\n');
  if (!text.trim()) throw new Error('El PDF no contiene texto extraíble. Es posible que sea una imagen escaneada.');
  return text;
}

// ─── Pattern-based item detection ────────────────────────────────────────────
function normalizeDate(str) {
  if (!str) return '';
  str = str.trim();
  // DD/MM/YYYY
  let m = str.match(/^(\d{1,2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  // MM/YYYY o MM-YYYY
  m = str.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2,'0')}-01`;
  // MM/YY
  m = str.match(/^(\d{1,2})[\/\-](\d{2})$/);
  if (m) return `20${m[2]}-${m[1].padStart(2,'0')}-01`;
  return '';
}

// Extraer todas las fechas que parezcan vencimientos (año >= actual)
function findDates(text) {
  const currentYear = new Date().getFullYear();
  const pattern = /\b(\d{1,2}[\/\-]\d{2}[\/\-]\d{4}|\d{1,2}[\/\-]\d{4}|\d{1,2}[\/\-]\d{2})\b/g;
  const found = [];
  let m;
  while ((m = pattern.exec(text)) !== null) {
    const norm = normalizeDate(m[1]);
    if (!norm) continue;
    const year = parseInt(norm.slice(0, 4), 10);
    // Solo fechas futuras o del año actual (son vencimientos)
    if (year >= currentYear) found.push({ raw: m[1], norm, idx: m.index });
  }
  return found;
}

function detectItems(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('---'));
  const results = [];
  const used = new Set();

  for (let i = 0; i < lines.length; i++) {
    // Contexto amplio: línea anterior, actual y 3 siguientes
    const ctxLines = lines.slice(Math.max(0, i - 1), i + 4);
    const ctx = ctxLines.join(' ');

    // ── 1. Buscar fecha de vencimiento con etiqueta ──
    const labeledExpiry =
      ctx.match(/(?:vto\.?|venc(?:imiento)?\.?|f\.?\s*vto\.?|exp\.?)[\s:]*(\d{1,2}[\/\-]\d{2}[\/\-]\d{4}|\d{1,2}[\/\-]\d{4}|\d{1,2}[\/\-]\d{2})/i);

    // ── 2. Cualquier fecha futura en el contexto ──
    const allDatesInCtx = findDates(ctx);

    const expiryRaw = labeledExpiry?.[1] || allDatesInCtx[0]?.raw;
    if (!expiryRaw) continue;

    const expDate = normalizeDate(expiryRaw);
    if (!expDate) continue;

    // ── 3. Número de lote ──
    const lotMatch =
      ctx.match(/(?:lote|lot\.?|n[°º]?\s*lote|nro\.?\s*lote)[\s.:]*([A-Z0-9][A-Z0-9\-\.\/]{1,25})/i) ||
      ctx.match(/\b([A-Z]{1,4}[0-9]{3,12}[A-Z0-9]*)\b/) ||
      ctx.match(/\b([0-9]{5,15})\b/);

    // ── 4. Cantidad (número razonable que no sea el año) ──
    const allNums = (ctx.match(/\b\d{1,6}\b/g) || [])
      .map(Number)
      .filter(n => n >= 1 && n <= 99999 && n < 1900);
    const qty = allNums[0] || 1;

    // ── 5. Nombre sugerido del producto (línea más informativa del contexto) ──
    const nameLine = ctxLines
      .filter(l => l.length > 5 && l.length < 150 && !/^\d/.test(l.trim()))
      .sort((a, b) => b.length - a.length)[0] || lines[i];

    const key = `${expDate}|${lotMatch?.[1] || ''}`;
    if (used.has(key)) continue;
    used.add(key);

    results.push({
      suggested_name: nameLine,
      lot_number:     lotMatch?.[1] || '',
      expiry_date:    expDate,
      quantity:       qty,
      product_id:     '',
    });
  }

  return results;
}

// ─── Component ────────────────────────────────────────────────────────────────
const EMPTY_ITEM = { product_id: '', product_search: '', lot_number: '', expiry_date: '', quantity: 1, location_id: '' };

export default function Facturas() {
  const facApi  = useFacturas();
  const medApi  = useMedicamentos();
  const provApi = useProveedores();
  const locApi  = useUbicaciones();

  const [facturas,    setFacturas]    = useState([]);
  const [suppliers,   setSuppliers]   = useState([]);
  const [locations,   setLocations]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showCreate,  setShowCreate]  = useState(false);
  const [detailId,    setDetailId]    = useState(null);
  const [detail,      setDetail]      = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  // PDF state
  const [pdfFile,     setPdfFile]     = useState(null);
  const [pdfText,     setPdfText]     = useState('');
  const [pdfError,    setPdfError]    = useState('');
  const [pdfLoading,  setPdfLoading]  = useState(false);
  const [showText,    setShowText]    = useState(true);
  const [dragOver,    setDragOver]    = useState(false);
  const fileInputRef = useRef();

  // Form state
  const [form, setForm] = useState({
    invoice_number: '',
    supplier_id:    '',
    invoice_date:   new Date().toISOString().slice(0,10),
    location_id:    '',
    notes:          '',
    items:          [{ ...EMPTY_ITEM }],
  });

  // Product search state per row
  const [searches,    setSearches]    = useState(['']);
  const [suggestions, setSuggestions] = useState([null]);
  const searchTimers = useRef([]);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [f, s, l] = await Promise.all([
        facApi.list(),
        provApi.list(),
        locApi.list(),
      ]);
      setFacturas(f.data);
      setSuppliers(s.data);
      setLocations(l.data);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function openDetail(id) {
    setDetailId(id);
    const res = await facApi.get(id);
    setDetail(res.data);
  }

  function openCreate() {
    setForm({
      invoice_number: '',
      supplier_id:    '',
      invoice_date:   new Date().toISOString().slice(0,10),
      location_id:    '',
      notes:          '',
      items:          [{ ...EMPTY_ITEM }],
    });
    setSearches(['']);
    setSuggestions([null]);
    setPdfFile(null);
    setPdfText('');
    setPdfError('');
    setShowText(true);
    setError('');
    setShowCreate(true);
  }

  // ── PDF handling ────────────────────────────────────────────────────────────
  async function handlePdfFile(file) {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setPdfError('El archivo seleccionado no es un PDF.');
      return;
    }
    setPdfFile(file);
    setPdfLoading(true);
    setPdfText('');
    setPdfError('');
    try {
      const text = await extractPdfText(file);
      setPdfText(text);
      setShowText(true);
    } catch (e) {
      setPdfError(e.message || 'Error al procesar el PDF.');
    }
    setPdfLoading(false);
  }

  function handleFileDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handlePdfFile(file);
  }

  function applyDetected() {
    const detected = detectItems(pdfText);
    if (detected.length === 0) {
      alert('No se detectaron ítems con lote/vencimiento en el PDF.\nRevisá el texto extraído y cargá los ítems manualmente.');
      return;
    }
    const newItems = detected.map(d => ({
      product_id:     '',
      product_search: d.suggested_name,
      lot_number:     d.lot_number,
      expiry_date:    d.expiry_date,
      quantity:       d.quantity,
      location_id:    '',
    }));
    setForm(f => ({ ...f, items: newItems }));
    setSearches(detected.map(d => d.suggested_name));
    setSuggestions(detected.map(() => null));
    // Trigger product search for each
    detected.forEach((d, idx) => {
      if (d.suggested_name.length >= 3) searchProduct(d.suggested_name, idx, newItems);
    });
  }

  // ── Product search per row ──────────────────────────────────────────────────
  function searchProduct(query, idx, currentItems) {
    clearTimeout(searchTimers.current[idx]);
    setSearches(s => { const n=[...s]; n[idx]=query; return n; });
    if (query.length < 2) {
      setSuggestions(s => { const n=[...s]; n[idx]=null; return n; });
      return;
    }
    searchTimers.current[idx] = setTimeout(async () => {
      try {
        const res = await medApi.list({ search: query, limit: 8 });
        setSuggestions(s => { const n=[...s]; n[idx]=res.data; return n; });
      } catch { /* ignore */ }
    }, 300);
  }

  function selectProduct(idx, product) {
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], product_id: product.id, product_search: product.name };
      return { ...f, items };
    });
    setSearches(s => { const n=[...s]; n[idx]=product.name; return n; });
    setSuggestions(s => { const n=[...s]; n[idx]=null; return n; });
  }

  // ── Items table ─────────────────────────────────────────────────────────────
  function addItem() {
    setForm(f => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }));
    setSearches(s => [...s, '']);
    setSuggestions(s => [...s, null]);
  }

  function removeItem(idx) {
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
    setSearches(s => s.filter((_, i) => i !== idx));
    setSuggestions(s => s.filter((_, i) => i !== idx));
  }

  function updateItem(idx, field, value) {
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    setError('');
    const incomplete = form.items.some(it => !it.product_id || !it.quantity);
    if (incomplete) { setError('Completá el producto y cantidad de cada ítem.'); return; }
    if (!form.invoice_number.trim()) { setError('Ingresá el número de factura.'); return; }

    setSaving(true);
    try {
      const payload = {
        invoice_number: form.invoice_number.trim(),
        supplier_id:    form.supplier_id   || null,
        invoice_date:   form.invoice_date,
        location_id:    form.location_id   || null,
        notes:          form.notes         || null,
        items: form.items.map(it => ({
          product_id:  it.product_id,
          lot_number:  it.lot_number,
          expiry_date: it.expiry_date || null,
          quantity:    parseInt(it.quantity, 10),
          location_id: it.location_id || null,
        })),
      };
      await facApi.create(payload);
      setShowCreate(false);
      loadAll();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta factura? Se revertirá el stock de todos sus lotes.')) return;
    try {
      await facApi.remove(id);
      setDetailId(null);
      setDetail(null);
      loadAll();
    } catch (e) {
      alert(e.response?.data?.error || 'Error al eliminar');
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) return <div className="spinner" style={{ marginTop: 60 }} />;

  return (
    <div>
      {/* ── List ── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Facturas de Compra</h2>
          <button className="btn btn-primary" onClick={openCreate}>+ Nueva Factura</button>
        </div>

        {facturas.length === 0 ? (
          <p style={{ padding: '2rem', color: 'var(--gray-400)', textAlign: 'center' }}>
            No hay facturas registradas.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>N° Factura</th>
                <th>Proveedor</th>
                <th>Fecha</th>
                <th style={{ textAlign: 'center' }}>Lotes</th>
                <th style={{ textAlign: 'center' }}>Unidades</th>
                <th>Registrado por</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {facturas.map(f => (
                <tr key={f.id}>
                  <td><strong>{f.invoice_number}</strong></td>
                  <td>{f.supplier_name || <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                  <td>{fmtDate(f.invoice_date)}</td>
                  <td style={{ textAlign: 'center' }}>{f.total_lotes}</td>
                  <td style={{ textAlign: 'center' }}>{f.total_unidades}</td>
                  <td style={{ fontSize: '.85rem', color: 'var(--gray-400)' }}>{f.user}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => openDetail(f.id)}>
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Detail modal ── */}
      {detailId && (
        <div className="modal-overlay" onClick={() => { setDetailId(null); setDetail(null); }}>
          <div className="modal" style={{ maxWidth: 800 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                Factura {detail?.invoice_number || '…'}
              </h3>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setDetailId(null); setDetail(null); }}>✕</button>
            </div>
            <div className="modal-body">
              {!detail ? (
                <div className="spinner" />
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <div><span style={{ color: 'var(--gray-400)', fontSize: '.85rem' }}>Proveedor</span><br /><strong>{detail.supplier_name || '—'}</strong></div>
                    <div><span style={{ color: 'var(--gray-400)', fontSize: '.85rem' }}>Fecha</span><br /><strong>{fmtDate(detail.invoice_date)}</strong></div>
                    <div><span style={{ color: 'var(--gray-400)', fontSize: '.85rem' }}>Registrado por</span><br /><strong>{detail.user}</strong></div>
                  </div>
                  {detail.notes && <p style={{ color: 'var(--gray-400)', marginBottom: '1rem' }}>{detail.notes}</p>}

                  <table className="table">
                    <thead>
                      <tr>
                        <th>Medicamento</th>
                        <th>Código</th>
                        <th>Lote</th>
                        <th>Vencimiento</th>
                        <th style={{ textAlign: 'center' }}>Cantidad</th>
                        <th>Ubicación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lotes?.map(l => (
                        <tr key={l.id}>
                          <td>{l.product_name}</td>
                          <td style={{ fontSize: '.85rem', color: 'var(--gray-400)' }}>{l.product_code}</td>
                          <td>{l.lot_number || '—'}</td>
                          <td>{fmtDate(l.expiry_date)}</td>
                          <td style={{ textAlign: 'center' }}>{l.quantity} {l.unit}</td>
                          <td style={{ fontSize: '.85rem' }}>{l.location_name || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleDelete(detailId)}
              >
                Eliminar y revertir stock
              </button>
              <button className="btn btn-ghost" onClick={() => { setDetailId(null); setDetail(null); }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create modal ── */}
      {showCreate && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '95vw', width: 1100, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3 className="modal-title">Nueva Factura de Compra</h3>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowCreate(false)}>✕</button>
            </div>

            <div className="modal-body" style={{ flex: 1, overflow: 'auto', display: 'flex', gap: '1.5rem', padding: '1rem 1.5rem' }}>

              {/* ── LEFT: PDF panel ── */}
              <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                <p style={{ fontWeight: 600, marginBottom: 0 }}>PDF de la factura</p>

                {/* Drop zone */}
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--gray-600)'}`,
                    borderRadius: 8,
                    padding: '1.5rem 1rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: dragOver ? 'var(--gray-800)' : 'transparent',
                    transition: 'all .2s',
                    color: 'var(--gray-400)',
                    fontSize: '.9rem',
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    style={{ display: 'none' }}
                    onChange={e => handlePdfFile(e.target.files?.[0])}
                  />
                  {pdfFile ? (
                    <>
                      <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>📄</div>
                      <div style={{ color: 'var(--gray-200)', fontWeight: 600, wordBreak: 'break-all' }}>{pdfFile.name}</div>
                      <div style={{ fontSize: '.8rem', marginTop: '.25rem' }}>Hacé clic para cambiar</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '2.5rem', marginBottom: '.5rem' }}>📂</div>
                      <div>Arrastrá el PDF aquí<br />o hacé clic para seleccionar</div>
                    </>
                  )}
                </div>

                {pdfLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', color: 'var(--gray-400)' }}>
                    <div className="spinner" style={{ width: 18, height: 18 }} /> Leyendo PDF…
                  </div>
                )}

                {pdfError && !pdfLoading && (
                  <div style={{ background: '#450a0a', border: '1px solid #b91c1c', borderRadius: 6, padding: '.75rem', color: '#fca5a5', fontSize: '.85rem' }}>
                    <strong>Error:</strong> {pdfError}
                    {pdfError.includes('imagen') && (
                      <div style={{ marginTop: '.4rem', color: '#fca5a5' }}>
                        Los PDFs escaneados no son compatibles con la extracción de texto. Cargá los ítems manualmente.
                      </div>
                    )}
                  </div>
                )}

                {pdfText && !pdfLoading && (
                  <>
                    <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button className="btn btn-primary btn-sm" onClick={applyDetected} style={{ flex: 1 }}>
                        ✨ Detectar ítems automáticamente
                      </button>
                    </div>
                    <div style={{ fontSize: '.8rem', color: 'var(--gray-400)' }}>
                      {pdfText.split('\n').filter(l => l && !l.startsWith('---')).length} líneas extraídas
                    </div>
                    <div>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ width: '100%', justifyContent: 'space-between', marginBottom: showText ? '.25rem' : 0 }}
                        onClick={() => setShowText(v => !v)}
                      >
                        Texto extraído {showText ? '▲ ocultar' : '▼ ver'}
                      </button>
                      {showText && (
                        <textarea
                          readOnly
                          value={pdfText}
                          style={{
                            width: '100%', height: 280, fontFamily: 'monospace', fontSize: '.72rem',
                            background: 'var(--gray-900)', border: '1px solid var(--gray-700)',
                            borderRadius: 6, padding: '.5rem', color: 'var(--gray-300)',
                            resize: 'vertical', boxSizing: 'border-box', display: 'block',
                          }}
                        />
                      )}
                    </div>
                    <p style={{ fontSize: '.78rem', color: 'var(--gray-500)', margin: 0 }}>
                      La detección automática es orientativa. Revisá y corregí los ítems antes de guardar.
                    </p>
                  </>
                )}
              </div>

              {/* ── RIGHT: Form ── */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* Header fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '.75rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">N° Factura *</label>
                    <input
                      className="form-input"
                      placeholder="Ej: 0001-00012345"
                      value={form.invoice_number}
                      onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Fecha</label>
                    <input
                      type="date"
                      className="form-input"
                      value={form.invoice_date}
                      onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Proveedor</label>
                    <select
                      className="form-input"
                      value={form.supplier_id}
                      onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}
                    >
                      <option value="">— Sin especificar —</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Ubicación destino (default)</label>
                    <select
                      className="form-input"
                      value={form.location_id}
                      onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))}
                    >
                      <option value="">— Sin ubicación —</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0, gridColumn: '2 / 4' }}>
                    <label className="form-label">Observaciones</label>
                    <input
                      className="form-input"
                      placeholder="Notas opcionales"
                      value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Items table */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
                    <p style={{ fontWeight: 600, margin: 0 }}>Medicamentos ({form.items.length})</p>
                    <button className="btn btn-ghost btn-sm" onClick={addItem}>+ Agregar fila</button>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ fontSize: '.85rem' }}>
                      <thead>
                        <tr>
                          <th style={{ minWidth: 200 }}>Medicamento *</th>
                          <th style={{ minWidth: 120 }}>N° Lote</th>
                          <th style={{ minWidth: 130 }}>Vencimiento</th>
                          <th style={{ minWidth: 80 }}>Cantidad *</th>
                          <th style={{ minWidth: 140 }}>Ubicación</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.items.map((item, idx) => (
                          <ItemRow
                            key={idx}
                            idx={idx}
                            item={item}
                            search={searches[idx] || ''}
                            suggs={suggestions[idx]}
                            locations={locations}
                            onSearchChange={(q) => {
                              updateItem(idx, 'product_search', q);
                              updateItem(idx, 'product_id', '');
                              searchProduct(q, idx, form.items);
                            }}
                            onSelectProduct={(p) => selectProduct(idx, p)}
                            onCloseSugg={() => setSuggestions(s => { const n=[...s]; n[idx]=null; return n; })}
                            onUpdate={(field, val) => updateItem(idx, field, val)}
                            onRemove={() => removeItem(idx)}
                            canRemove={form.items.length > 1}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {error && (
                  <div style={{ background: 'var(--red-900,#450a0a)', border: '1px solid var(--red-700,#b91c1c)', borderRadius: 6, padding: '.75rem', color: '#fca5a5' }}>
                    {error}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar factura'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ItemRow component ────────────────────────────────────────────────────────
function ItemRow({ idx, item, search, suggs, locations, onSearchChange, onSelectProduct, onCloseSugg, onUpdate, onRemove, canRemove }) {
  const wrapRef = useRef();

  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) onCloseSugg();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <tr>
      {/* Product search */}
      <td ref={wrapRef} style={{ position: 'relative' }}>
        <input
          className="form-input"
          style={{ fontSize: '.85rem' }}
          placeholder="Buscar medicamento…"
          value={item.product_id ? (item.product_search || search) : search}
          onChange={e => onSearchChange(e.target.value)}
          onFocus={() => search.length >= 2 && !item.product_id && onSearchChange(search)}
        />
        {item.product_id && (
          <div style={{ fontSize: '.75rem', color: 'var(--primary)', marginTop: 2 }}>✓ seleccionado</div>
        )}
        {suggs && suggs.length > 0 && !item.product_id && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
            background: 'var(--gray-800)', border: '1px solid var(--gray-600)',
            borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,.4)', maxHeight: 200, overflowY: 'auto',
          }}>
            {suggs.map(p => (
              <div
                key={p.id}
                onMouseDown={() => onSelectProduct(p)}
                style={{ padding: '.5rem .75rem', cursor: 'pointer', fontSize: '.85rem', borderBottom: '1px solid var(--gray-700)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-700)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                <span style={{ fontWeight: 600 }}>{p.name}</span>
                <span style={{ color: 'var(--gray-400)', marginLeft: '.5rem' }}>{p.code}</span>
                <span style={{ color: 'var(--gray-500)', marginLeft: '.5rem', fontSize: '.8rem' }}>Stock: {p.stock}</span>
              </div>
            ))}
          </div>
        )}
        {suggs && suggs.length === 0 && !item.product_id && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
            background: 'var(--gray-800)', border: '1px solid var(--gray-600)',
            borderRadius: 6, padding: '.5rem .75rem', fontSize: '.85rem', color: 'var(--gray-400)',
          }}>
            Sin resultados
          </div>
        )}
      </td>

      {/* Lot number */}
      <td>
        <input
          className="form-input"
          style={{ fontSize: '.85rem' }}
          placeholder="Nº Lote"
          value={item.lot_number}
          onChange={e => onUpdate('lot_number', e.target.value)}
        />
      </td>

      {/* Expiry date */}
      <td>
        <input
          type="date"
          className="form-input"
          style={{ fontSize: '.85rem' }}
          value={item.expiry_date}
          onChange={e => onUpdate('expiry_date', e.target.value)}
        />
      </td>

      {/* Quantity */}
      <td>
        <input
          type="number"
          className="form-input"
          style={{ fontSize: '.85rem' }}
          min={1}
          value={item.quantity}
          onChange={e => onUpdate('quantity', e.target.value)}
        />
      </td>

      {/* Location override */}
      <td>
        <select
          className="form-input"
          style={{ fontSize: '.85rem' }}
          value={item.location_id}
          onChange={e => onUpdate('location_id', e.target.value)}
        >
          <option value="">Default</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </td>

      {/* Remove */}
      <td>
        {canRemove && (
          <button
            className="btn btn-ghost btn-sm btn-icon"
            style={{ color: 'var(--red-400,#f87171)' }}
            onClick={onRemove}
            title="Eliminar fila"
          >
            ✕
          </button>
        )}
      </td>
    </tr>
  );
}
