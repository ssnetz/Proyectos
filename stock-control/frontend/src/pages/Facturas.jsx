import { useState, useEffect, useRef } from 'react';
import { useFacturas, useMedicamentos, useProveedores, useUbicaciones } from '../hooks/useApi';
// Worker URLs resueltos en build-time por Vite
import pdfWorkerUrl  from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import tessWorkerUrl from 'tesseract.js/dist/worker.min.js?url';

// ─── PDF.js setup ─────────────────────────────────────────────────────────────
let pdfjsLib = null;
async function getPdfjs() {
  if (pdfjsLib) return pdfjsLib;
  const lib = await import('pdfjs-dist');
  lib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  pdfjsLib = lib;
  return pdfjsLib;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ─── PDF text extraction + page rendering ────────────────────────────────────
async function processPdf(file) {
  const lib = await getPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data: buf }).promise;

  const allLines   = [];
  const pageImages = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);

    const scale    = 1.5;
    const viewport = page.getViewport({ scale });
    const canvas   = document.createElement('canvas');
    canvas.width   = viewport.width;
    canvas.height  = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    pageImages.push(canvas.toDataURL('image/jpeg', 0.85));

    const content = await page.getTextContent();
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
    if (lines.length > 0) allLines.push(`--- Página ${p} ---`, ...lines);
  }

  return { text: allLines.join('\n'), images: pageImages };
}

// ─── OCR con Tesseract.js ─────────────────────────────────────────────────────
async function runOcr(images, onProgress) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('spa', 1, {
    workerPath: tessWorkerUrl,
    logger: m => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });
  const texts = [];
  for (let i = 0; i < images.length; i++) {
    onProgress && onProgress(0);
    const { data: { text } } = await worker.recognize(images[i]);
    texts.push(text);
  }
  await worker.terminate();
  return texts.join('\n--- Página ---\n');
}

// ─── Utilidades de fecha ──────────────────────────────────────────────────────
function normalizeDate(str) {
  if (!str) return '';
  str = str.trim();
  let m = str.match(/^(\d{1,2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  m = str.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2,'0')}-01`;
  m = str.match(/^(\d{1,2})[\/\-](\d{2})$/);
  if (m) return `20${m[2]}-${m[1].padStart(2,'0')}-01`;
  return '';
}

function findDates(text) {
  const currentYear = new Date().getFullYear();
  const pattern = /\b(\d{1,2}[\/\-]\d{2}[\/\-]\d{4}|\d{1,2}[\/\-]\d{4}|\d{1,2}[\/\-]\d{2})\b/g;
  const found = [];
  let m;
  while ((m = pattern.exec(text)) !== null) {
    const norm = normalizeDate(m[1]);
    if (!norm) continue;
    const year = parseInt(norm.slice(0, 4), 10);
    if (year >= currentYear) found.push({ raw: m[1], norm, idx: m.index });
  }
  return found;
}

// ─── Parser específico para remitos Trade Farma ───────────────────────────────
// Formato OCR real (Tesseract sobre escaneo CamScanner):
//   CODIGO [junk] CANTIDAD DESCRIPCION MARCA LOTE DD/MM/YYYY
//
// "junk" entre código y cantidad varía mucho por artefactos OCR:
//   «==   «$   »=   ==   <=   ...   .-.   ,   $   «  (vacío con solo espacio)
//
// Solución: regex único que acepta 1-12 caracteres no-dígito entre código y cantidad.
function detectItemsFromRemito(text) {
  const results = [];
  const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Línea de producto: [0-4 chars basura] + [5-7 dígitos] + [char no-dígito]
  // Cubre también "002215, 300" donde hay coma pegada al código.
  const PROD_RE = /^.{0,4}\d{5,7}[^0-9]/;

  // Unir líneas de continuación
  const lines = [];
  for (const line of rawLines) {
    if (line.startsWith('---')) continue;
    if (PROD_RE.test(line)) {
      lines.push(line);
    } else if (lines.length > 0) {
      lines[lines.length - 1] += ' ' + line;
    }
  }

  for (const line of lines) {
    // Captura todo en una sola pasada:
    // [basura 0-4] CÓDIGO(5-7 dig) [separador 1-12 no-dig] CANTIDAD(1-5 dig) [espacio] RESTO
    const rowMatch = line.match(/^.{0,4}(\d{5,7})[^0-9]{1,12}(\d{1,5})\s+(.*)/);
    if (!rowMatch) continue;

    const productCode = rowMatch[1];
    const quantity    = parseInt(rowMatch[2], 10);
    if (quantity <= 0 || quantity > 99999) continue;

    const rest = rowMatch[3];

    // Fecha al final: DD/MM/YYYY
    const dateMatch = rest.match(/(\d{1,2}\/\d{2}\/\d{4})\s*$/);
    if (!dateMatch) continue;

    const expiryDate = normalizeDate(dateMatch[1]);
    const beforeDate = rest.slice(0, dateMatch.index).trimEnd();

    // Lote: último token alfanumérico antes de la fecha
    const lotMatch = beforeDate.match(/\s+([A-Z0-9]{2,20})\s*$/);
    if (!lotMatch) continue;

    const lot       = lotMatch[1];
    const beforeLot = beforeDate.slice(0, lotMatch.index).trimEnd();

    // Limpiar símbolos finales sobrantes ej: "KLONAL —" → "KLONAL"
    const cleanedBL = beforeLot.replace(/[^A-Za-z0-9]+$/, '').trimEnd();

    // Marca: última(s) palabra(s) ALL-CAPS. Si ≤ 3 chars incluir la anterior.
    const lastWordMatch = cleanedBL.match(/([A-Z]{2,})\s*$/);
    let marca    = '';
    let descText = cleanedBL;

    if (lastWordMatch) {
      const word   = lastWordMatch[1];
      const endIdx = cleanedBL.length - lastWordMatch[0].length;
      if (word.length <= 3) {
        const prev = cleanedBL.slice(0, endIdx).match(/([A-Z]{2,})\s*$/);
        if (prev) {
          marca    = prev[1] + ' ' + word;
          descText = cleanedBL.slice(0, endIdx - prev[0].length).trimEnd();
        } else {
          marca    = word;
          descText = cleanedBL.slice(0, endIdx).trimEnd();
        }
      } else {
        marca    = word;
        descText = cleanedBL.slice(0, endIdx).trimEnd();
      }
    }

    if (!descText && !marca) continue;

    results.push({
      product_code:   productCode,
      suggested_name: descText || rest,
      marca,
      lot_number:     lot,
      expiry_date:    expiryDate,
      quantity,
      product_id:     '',
    });
  }

  return results;
}

// Extrae número de remito y fecha del encabezado
// Cubre: "REMITO N° 0001-00029491", "REMITO N* 0001 - 00029491"
function extractRemitoHeader(text) {
  const info = {};
  const numMatch = text.match(/REMITO\s+N[°º*#]?[:\s]*([\d][\d\s\-\.]+\d)/i);
  if (numMatch) {
    const parts = numMatch[1].match(/\d+/g);
    info.invoice_number = parts ? parts.join('-') : numMatch[1].trim();
  }
  // Primera fecha DD/MM/YYYY del documento (suele ser la fecha de emisión)
  const firstDate = text.match(/(\d{1,2}\/\d{2}\/\d{4})/);
  if (firstDate) info.invoice_date = normalizeDate(firstDate[1]);
  return info;
}

// ─── Parser genérico (fallback para PDFs sin estructura de remito) ────────────
function detectItems(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('---'));
  const results = [];
  const used = new Set();

  for (let i = 0; i < lines.length; i++) {
    const ctxLines = lines.slice(Math.max(0, i - 1), i + 4);
    const ctx = ctxLines.join(' ');

    const labeledExpiry =
      ctx.match(/(?:vto\.?|venc(?:imiento)?\.?|f\.?\s*vto\.?|exp\.?)[\s:]*(\d{1,2}[\/\-]\d{2}[\/\-]\d{4}|\d{1,2}[\/\-]\d{4}|\d{1,2}[\/\-]\d{2})/i);
    const allDatesInCtx = findDates(ctx);
    const expiryRaw = labeledExpiry?.[1] || allDatesInCtx[0]?.raw;
    if (!expiryRaw) continue;

    const expDate = normalizeDate(expiryRaw);
    if (!expDate) continue;

    const lotMatch =
      ctx.match(/(?:lote|lot\.?|n[°º]?\s*lote|nro\.?\s*lote)[\s.:]*([A-Z0-9][A-Z0-9\-\.\/]{1,25})/i) ||
      ctx.match(/\b([A-Z]{1,4}[0-9]{3,12}[A-Z0-9]*)\b/) ||
      ctx.match(/\b([0-9]{5,15})\b/);

    const allNums = (ctx.match(/\b\d{1,6}\b/g) || [])
      .map(Number)
      .filter(n => n >= 1 && n <= 99999 && n < 1900);
    const qty = allNums[0] || 1;

    const nameLine = ctxLines
      .filter(l => l.length > 5 && l.length < 150 && !/^\d/.test(l.trim()))
      .sort((a, b) => b.length - a.length)[0] || lines[i];

    const key = `${expDate}|${lotMatch?.[1] || ''}`;
    if (used.has(key)) continue;
    used.add(key);

    results.push({
      product_code:   '',
      suggested_name: nameLine,
      marca:          '',
      lot_number:     lotMatch?.[1] || '',
      expiry_date:    expDate,
      quantity:       qty,
      product_id:     '',
    });
  }

  return results;
}

// ─── Component ────────────────────────────────────────────────────────────────
const EMPTY_ITEM = {
  product_id: '', product_search: '', product_code: '', product_description: '',
  marca: '', lot_number: '', expiry_date: '', quantity: 1, location_id: '',
};

export default function Facturas() {
  const facApi  = useFacturas();
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
  const [pdfImages,   setPdfImages]   = useState([]);
  const [pdfError,    setPdfError]    = useState('');
  const [pdfLoading,  setPdfLoading]  = useState(false);
  const [ocrLoading,  setOcrLoading]  = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [showText,    setShowText]    = useState(false);
  const [dragOver,    setDragOver]    = useState(false);
  const fileInputRef = useRef();

  const [form, setForm] = useState({
    invoice_number: '',
    supplier_id:    '',
    invoice_date:   new Date().toISOString().slice(0,10),
    location_id:    '',
    notes:          '',
    items:          [{ ...EMPTY_ITEM }],
  });

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [f, s, l] = await Promise.all([facApi.list(), provApi.list(), locApi.list()]);
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
    setPdfFile(null); setPdfText(''); setPdfImages([]); setPdfError('');
    setOcrLoading(false); setOcrProgress(0); setShowText(false); setError('');
    setShowCreate(true);
  }

  async function handleOcr() {
    if (!pdfImages.length) return;
    setOcrLoading(true); setOcrProgress(0); setPdfError('');
    try {
      const text = await runOcr(pdfImages, setOcrProgress);
      if (text.trim()) {
        setPdfText(text);
        setShowText(false);
        applyDetectedFromText(text);
      } else {
        setPdfError('El OCR no pudo extraer texto. La imagen puede ser de baja calidad.');
      }
    } catch (e) {
      setPdfError('Error en OCR: ' + e.message);
    }
    setOcrLoading(false); setOcrProgress(0);
  }

  async function handlePdfFile(file) {
    if (!file) return;
    if (file.type !== 'application/pdf') { setPdfError('El archivo no es un PDF.'); return; }
    setPdfFile(file); setPdfLoading(true); setPdfText(''); setPdfImages([]); setPdfError('');
    try {
      const { text, images } = await processPdf(file);
      setPdfImages(images);
      if (text.trim()) {
        setPdfText(text);
        applyDetectedFromText(text);
      }
    } catch (e) {
      setPdfError(e.message || 'Error al procesar el PDF.');
    }
    setPdfLoading(false);
  }

  function handleFileDrop(e) {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handlePdfFile(file);
  }

  function applyDetectedFromText(text) {
    const remitoItems = detectItemsFromRemito(text);
    const detected    = remitoItems.length > 0 ? remitoItems : detectItems(text);

    if (detected.length === 0) return;   // sin ítems: no tocar la tabla

    const newItems = detected.map(d => ({
      ...EMPTY_ITEM,
      product_code:        d.product_code   || '',
      product_search:      '',                      // vacío: usuario busca el medicamento
      product_description: d.suggested_name || '',  // descripción del remito
      marca:               d.marca          || '',
      lot_number:          d.lot_number     || '',
      expiry_date:         d.expiry_date    || '',
      quantity:            d.quantity       || 1,
    }));

    if (remitoItems.length > 0) {
      const header = extractRemitoHeader(text);
      setForm(f => ({
        ...f,
        invoice_number: header.invoice_number || f.invoice_number,
        invoice_date:   header.invoice_date   || f.invoice_date,
        items:          newItems,
      }));
    } else {
      setForm(f => ({ ...f, items: newItems }));
    }
  }

  // Botón manual: re-detectar usando el texto ya extraído
  function applyDetected() {
    if (!pdfText) return;
    const remitoItems = detectItemsFromRemito(pdfText);
    const detected    = remitoItems.length > 0 ? remitoItems : detectItems(pdfText);
    if (detected.length === 0) {
      alert('No se detectaron ítems en el PDF.\nRevisá el texto extraído y cargá los ítems manualmente.');
      return;
    }
    applyDetectedFromText(pdfText);
  }

  function addItem()      { setForm(f => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] })); }
  function removeItem(i)  { setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) })); }
  function updateItem(i, field, value) {
    setForm(f => {
      const items = [...f.items];
      items[i] = { ...items[i], [field]: value };
      return { ...f, items };
    });
  }

  async function handleSave() {
    setError('');
    if (!form.invoice_number.trim()) { setError('Ingresá el número de factura.'); return; }
    if (form.items.some(it => !it.product_id || !it.quantity)) {
      setError('Completá el producto y cantidad de cada ítem.'); return;
    }
    setSaving(true);
    try {
      await facApi.create({
        invoice_number: form.invoice_number.trim(),
        supplier_id:    form.supplier_id   || null,
        invoice_date:   form.invoice_date,
        location_id:    form.location_id   || null,
        notes:          form.notes         || null,
        items: form.items.map(it => ({
          product_id:  it.product_id,
          lot_number:  it.lot_number,
          marca:       it.marca,
          expiry_date: it.expiry_date || null,
          quantity:    parseInt(it.quantity, 10),
          location_id: it.location_id || null,
        })),
      });
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
      setDetailId(null); setDetail(null); loadAll();
    } catch (e) {
      alert(e.response?.data?.error || 'Error al eliminar');
    }
  }

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
                <th>N° Factura</th><th>Proveedor</th><th>Fecha</th>
                <th style={{ textAlign: 'center' }}>Lotes</th>
                <th style={{ textAlign: 'center' }}>Unidades</th>
                <th>Registrado por</th><th></th>
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
                  <td><button className="btn btn-ghost btn-sm" onClick={() => openDetail(f.id)}>Ver detalle</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Detail modal ── */}
      {detailId && (
        <div className="modal-overlay" onClick={() => { setDetailId(null); setDetail(null); }}>
          <div className="modal" style={{ maxWidth: 900 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Factura {detail?.invoice_number || '…'}</h3>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setDetailId(null); setDetail(null); }}>✕</button>
            </div>
            <div className="modal-body">
              {!detail ? <div className="spinner" /> : (
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
                        <th>Código</th><th>Descripción</th><th>Marca</th>
                        <th>Lote</th><th>Vencimiento</th>
                        <th style={{ textAlign: 'center' }}>Cantidad</th><th>Ubicación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lotes?.map(l => (
                        <tr key={l.id}>
                          <td style={{ fontSize: '.85rem', color: 'var(--gray-400)' }}>{l.product_code}</td>
                          <td>
                            <strong>{l.product_name}</strong>
                            {l.product_description && <div style={{ fontSize: '.78rem', color: 'var(--gray-500)' }}>{l.product_description}</div>}
                          </td>
                          <td>{l.marca || <span style={{ color: 'var(--gray-500)' }}>—</span>}</td>
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
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(detailId)}>
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
          <div className="modal" style={{ maxWidth: '98vw', width: 1280, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3 className="modal-title">Nueva Factura de Compra</h3>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowCreate(false)}>✕</button>
            </div>

            <div className="modal-body" style={{ flex: 1, overflow: 'auto', display: 'flex', gap: '1.5rem', padding: '1rem 1.5rem' }}>

              {/* ── LEFT: PDF panel ── */}
              <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                <p style={{ fontWeight: 600, marginBottom: 0 }}>PDF de la factura</p>

                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--gray-600)'}`,
                    borderRadius: 8,
                    padding: pdfImages.length ? '.6rem 1rem' : '1.5rem 1rem',
                    textAlign: 'center', cursor: 'pointer',
                    background: dragOver ? 'var(--gray-800)' : 'transparent',
                    transition: 'all .2s', color: 'var(--gray-400)', fontSize: '.85rem',
                  }}
                >
                  <input ref={fileInputRef} type="file" accept="application/pdf" style={{ display: 'none' }}
                    onChange={e => handlePdfFile(e.target.files?.[0])} />
                  {pdfFile ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', justifyContent: 'center' }}>
                      <span>📄</span>
                      <span style={{ color: 'var(--gray-200)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{pdfFile.name}</span>
                      <span style={{ fontSize: '.75rem', flexShrink: 0 }}>· cambiar</span>
                    </div>
                  ) : (
                    <><div style={{ fontSize: '2rem', marginBottom: '.4rem' }}>📂</div><div>Arrastrá el PDF aquí<br />o hacé clic para seleccionar</div></>
                  )}
                </div>

                {pdfLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', color: 'var(--gray-400)' }}>
                    <div className="spinner" style={{ width: 16, height: 16 }} /> Procesando PDF…
                  </div>
                )}
                {pdfError && !pdfLoading && (
                  <div style={{ background: '#450a0a', border: '1px solid #b91c1c', borderRadius: 6, padding: '.6rem', color: '#fca5a5', fontSize: '.82rem' }}>
                    {pdfError}
                  </div>
                )}

                {pdfImages.length > 0 && !pdfLoading && (
                  <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--gray-700)', borderRadius: 8, background: 'var(--gray-900)', display: 'flex', flexDirection: 'column', gap: 4, padding: 4, maxHeight: 380 }}>
                    {pdfImages.map((src, i) => (
                      <div key={i}>
                        {pdfImages.length > 1 && <div style={{ fontSize: '.7rem', color: 'var(--gray-500)', textAlign: 'center', padding: '2px 0' }}>Página {i + 1}</div>}
                        <img src={src} alt={`Página ${i + 1}`} style={{ width: '100%', display: 'block', borderRadius: 4 }} />
                      </div>
                    ))}
                  </div>
                )}

                {pdfText && !pdfLoading && (
                  <div>
                    <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => setShowText(v => !v)}>
                      Texto extraído ({pdfText.split('\n').filter(l => l && !l.startsWith('---')).length} líneas) {showText ? '▲' : '▼'}
                    </button>
                    {showText && (
                      <textarea readOnly value={pdfText} style={{ width: '100%', height: 180, fontFamily: 'monospace', fontSize: '.7rem', background: 'var(--gray-900)', border: '1px solid var(--gray-700)', borderRadius: 6, padding: '.5rem', color: 'var(--gray-300)', resize: 'vertical', boxSizing: 'border-box', display: 'block', marginTop: '.25rem' }} />
                    )}
                  </div>
                )}

                {pdfImages.length > 0 && !pdfText && !pdfLoading && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                    <button className="btn btn-primary btn-sm" onClick={handleOcr} disabled={ocrLoading}>
                      {ocrLoading ? `🔄 Leyendo… ${ocrProgress}%` : '🔍 Leer texto con OCR'}
                    </button>
                    {ocrLoading && (
                      <div style={{ background: 'var(--gray-700)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 99, background: 'var(--primary)', width: `${ocrProgress}%`, transition: 'width .3s' }} />
                      </div>
                    )}
                    {!ocrLoading && <p style={{ fontSize: '.78rem', color: 'var(--gray-500)', margin: 0 }}>Reconoce texto en la imagen del PDF.<br />Requiere internet la primera vez (~4 MB).</p>}
                  </div>
                )}
              </div>

              {/* ── RIGHT: Form ── */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* Header fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '.75rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">N° Factura / Remito *</label>
                    <input className="form-input" placeholder="Ej: 0001-00029491"
                      value={form.invoice_number}
                      onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Fecha</label>
                    <input type="date" className="form-input" value={form.invoice_date}
                      onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Proveedor</label>
                    <select className="form-input" value={form.supplier_id}
                      onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
                      <option value="">— Sin especificar —</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Ubicación destino (default)</label>
                    <select className="form-input" value={form.location_id}
                      onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))}>
                      <option value="">— Sin ubicación —</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0, gridColumn: '2 / 4' }}>
                    <label className="form-label">Observaciones</label>
                    <input className="form-input" placeholder="Notas opcionales" value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>

                {/* Items table */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
                    <p style={{ fontWeight: 600, margin: 0 }}>Ítems ({form.items.length})</p>
                    <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                      {pdfText && (
                        <button className="btn btn-ghost btn-sm" onClick={applyDetected} title="Volver a detectar ítems del PDF">
                          ↺ Re-detectar del PDF
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={addItem}>+ Agregar fila</button>
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ fontSize: '.85rem' }}>
                      <thead>
                        <tr>
                          <th style={{ minWidth: 220 }}>Medicamento *</th>
                          <th style={{ minWidth: 90 }}>Código</th>
                          <th style={{ minWidth: 180 }}>Descripción</th>
                          <th style={{ minWidth: 130 }}>Marca</th>
                          <th style={{ minWidth: 120 }}>N° Lote</th>
                          <th style={{ minWidth: 130 }}>Vencimiento</th>
                          <th style={{ minWidth: 80 }}>Cantidad *</th>
                          <th style={{ minWidth: 130 }}>Ubicación</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.items.map((item, idx) => (
                          <ItemRow
                            key={idx}
                            item={item}
                            locations={locations}
                            onSelectProduct={p => {
                              setForm(f => {
                                const items = [...f.items];
                                items[idx] = {
                                  ...items[idx],
                                  product_id:          p.id,
                                  product_search:      p.name,
                                  product_code:        p.code        || '',
                                  product_description: p.description || '',
                                };
                                return { ...f, items };
                              });
                            }}
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

// ─── ItemRow: búsqueda de medicamentos autónoma por fila ─────────────────────
function ItemRow({ item, locations, onSelectProduct, onUpdate, onRemove, canRemove }) {
  const medApi   = useMedicamentos();
  const [query,  setQuery] = useState(item.product_search || '');
  const [suggs,  setSuggs] = useState(null);
  const timerRef = useRef();
  const wrapRef  = useRef();

  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setSuggs(null);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function doSearch(q) {
    clearTimeout(timerRef.current);
    if (q.length < 2) { setSuggs(null); return; }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await medApi.list({ search: q, limit: 8 });
        setSuggs(res.data);
      } catch { setSuggs([]); }
    }, 300);
  }

  function handleChange(q) {
    setQuery(q);
    onUpdate('product_id', '');
    onUpdate('product_search', q);
    onUpdate('product_code', '');
    onUpdate('product_description', '');
    doSearch(q);
  }

  function handleSelect(p) {
    setQuery(p.name);
    setSuggs(null);
    onSelectProduct(p);
  }

  return (
    <tr>
      {/* Medicamento */}
      <td ref={wrapRef} style={{ position: 'relative' }}>
        <input className="form-input" style={{ fontSize: '.85rem' }} placeholder="Buscar medicamento…"
          value={query}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => { if (query.length >= 2 && !item.product_id) doSearch(query); }} />
        {item.product_id && <div style={{ fontSize: '.75rem', color: 'var(--primary)', marginTop: 2 }}>✓ seleccionado</div>}
        {suggs && suggs.length > 0 && !item.product_id && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.18)', maxHeight: 220, overflowY: 'auto' }}>
            {suggs.map(p => (
              <div key={p.id} onMouseDown={() => handleSelect(p)}
                style={{ padding: '.5rem .75rem', cursor: 'pointer', fontSize: '.85rem', borderBottom: '1px solid #e2e8f0', color: '#1e293b' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{p.name}</span>
                <span style={{ color: '#64748b', marginLeft: '.5rem' }}>{p.code}</span>
                <span style={{ color: '#94a3b8', marginLeft: '.5rem', fontSize: '.8rem' }}>Stock: {p.stock}</span>
              </div>
            ))}
          </div>
        )}
        {suggs && suggs.length === 0 && !item.product_id && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, padding: '.5rem .75rem', fontSize: '.85rem', color: '#64748b' }}>
            Sin resultados
          </div>
        )}
      </td>

      {/* Código (read-only) */}
      <td>
        <input className="form-input" style={{ fontSize: '.85rem', color: 'var(--gray-400)', background: 'var(--gray-800)' }}
          readOnly value={item.product_code} placeholder="—" tabIndex={-1} />
      </td>

      {/* Descripción */}
      <td>
        <input className="form-input" style={{ fontSize: '.85rem' }} placeholder="Descripción"
          value={item.product_description}
          onChange={e => onUpdate('product_description', e.target.value)} />
      </td>

      {/* Marca */}
      <td>
        <input className="form-input" style={{ fontSize: '.85rem' }} placeholder="Marca / Lab."
          value={item.marca}
          onChange={e => onUpdate('marca', e.target.value)} />
      </td>

      {/* Lote */}
      <td>
        <input className="form-input" style={{ fontSize: '.85rem' }} placeholder="Nº Lote"
          value={item.lot_number}
          onChange={e => onUpdate('lot_number', e.target.value)} />
      </td>

      {/* Vencimiento */}
      <td>
        <input type="date" className="form-input" style={{ fontSize: '.85rem' }}
          value={item.expiry_date}
          onChange={e => onUpdate('expiry_date', e.target.value)} />
      </td>

      {/* Cantidad */}
      <td>
        <input type="number" className="form-input" style={{ fontSize: '.85rem' }} min={1}
          value={item.quantity}
          onChange={e => onUpdate('quantity', e.target.value)} />
      </td>

      {/* Ubicación */}
      <td>
        <select className="form-input" style={{ fontSize: '.85rem' }}
          value={item.location_id}
          onChange={e => onUpdate('location_id', e.target.value)}>
          <option value="">Default</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </td>

      {/* Eliminar */}
      <td>
        {canRemove && (
          <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--red-400,#f87171)' }}
            onClick={onRemove} title="Eliminar fila">✕</button>
        )}
      </td>
    </tr>
  );
}
