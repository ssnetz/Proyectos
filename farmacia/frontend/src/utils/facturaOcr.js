// Lectura automática de facturas/remitos de proveedores en la página de
// Facturas de Compra: el usuario sube un PDF (o lo arrastra), se extrae su
// texto embebido con pdfjs-dist, y si el PDF no tiene texto seleccionable
// (por ejemplo un escaneo tipo CamScanner) se puede correr OCR sobre las
// páginas renderizadas como imagen con tesseract.js. El texto resultante se
// parsea con un par de heurísticas basadas en expresiones regulares para
// sugerir automáticamente los ítems (código, lote, vencimiento, cantidad)
// del formulario de factura nueva.
//
// Esta lógica fue reconstruida leyendo el bundle minificado de producción
// (no hay tests para ella todavía) — las regexes en particular conviene
// probarlas con remitos reales antes de confiar ciegamente en el resultado.

const EMPTY_ITEM = {
  product_id: '',
  product_search: '',
  product_code: '',
  product_description: '',
  marca: '',
  lot_number: '',
  expiry_date: '',
  quantity: 1,
  location_id: '',
};

export function emptyFacturaItem() {
  return { ...EMPTY_ITEM };
}

// ─── PDF: carga perezosa de pdfjs-dist + extracción de texto/imágenes ──────

let pdfjsLibCache = null;

async function loadPdfjs() {
  if (pdfjsLibCache) return pdfjsLibCache;
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
  pdfjsLibCache = pdfjsLib;
  return pdfjsLibCache;
}

// Devuelve { text, images }: el texto embebido reconstruido línea por línea
// (agrupando fragmentos por fila y ordenándolos por X) y una imagen JPEG
// (data URL) por página, para poder mostrar preview y, si hace falta,
// mandarlas a OCR.
export async function extractTextFromPdf(file) {
  const pdfjsLib = await loadPdfjs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const textLines = [];
  const images = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    images.push(canvas.toDataURL('image/jpeg', 0.85));

    const content = await page.getTextContent();
    const rows = {};
    for (const item of content.items) {
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform[5] / 5) * 5;
      (rows[y] ??= []).push({ x: item.transform[4], text: item.str });
    }
    const pageLines = Object.entries(rows)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([, items]) => items.sort((a, b) => a.x - b.x).map((i) => i.text).join('  ').trim())
      .filter(Boolean);

    if (pageLines.length > 0) textLines.push(`--- Página ${pageNum} ---`, ...pageLines);
  }

  return { text: textLines.join('\n'), images };
}

// ─── OCR con tesseract.js (para PDFs sin texto embebido / escaneos) ────────

export async function ocrImages(images, onProgress) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('spa', 1, {
    workerPath: new URL('tesseract.js/dist/worker.min.js', import.meta.url).href,
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) onProgress(Math.round(m.progress * 100));
    },
  });

  const pageTexts = [];
  for (let i = 0; i < images.length; i++) {
    onProgress?.(0);
    const {
      data: { text },
    } = await worker.recognize(images[i]);
    pageTexts.push(text);
  }
  await worker.terminate();
  return pageTexts.join('\n--- Página ---\n');
}

// ─── Parseo de texto a fecha ISO (YYYY-MM-DD) ───────────────────────────────

// Acepta DD/MM/YYYY, DD/MM (año actual asumido por el llamador) o MM/YY.
export function parseFecha(str) {
  if (!str) return '';
  str = str.trim();
  let m = str.match(/^(\d{1,2})[/-](\d{2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = str.match(/^(\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, '0')}-01`;
  m = str.match(/^(\d{1,2})[/-](\d{2})$/);
  if (m) return `20${m[2]}-${m[1].padStart(2, '0')}-01`;
  return '';
}

// ─── Encabezado de la factura (N° de remito y fecha) ────────────────────────

export function parseInvoiceHeader(text) {
  const header = {};
  const numberMatch = text.match(/REMITO\s+N[°º*#]?[:\s]*([\d][\d\s\-.]+\d)/i);
  if (numberMatch) {
    const digits = numberMatch[1].match(/\d+/g);
    header.invoice_number = digits ? digits.join('-') : numberMatch[1].trim();
  }
  const dateMatch = text.match(/(\d{1,2}\/\d{2}\/\d{4})/);
  if (dateMatch) header.invoice_date = parseFecha(dateMatch[1]);
  return header;
}

// ─── Parser principal: líneas de ítems con formato tabular reconocible ─────
//
// Espera líneas (ya unidas si un ítem quedó partido en varias por el PDF)
// con la forma aproximada:
//   <código 5-7 dígitos>  <cantidad>  <descripción...> <MARCA> <LOTE> <DD/MM/YYYY>
// Es la heurística "primaria"; si no encuentra nada, la página cae a
// parseItemsFuzzy como respaldo.
export function parseItemsFromInvoiceLines(text) {
  const items = [];
  const rawLines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const startsWithCode = /^.{0,4}\d{5,7}[^0-9]/;

  // Une líneas de continuación (las que no arrancan con un código de
  // producto) a la línea de ítem anterior — el texto extraído del PDF
  // parte a veces una fila en dos líneas.
  const lines = [];
  for (const line of rawLines) {
    if (line.startsWith('---')) continue;
    if (startsWithCode.test(line)) {
      lines.push(line);
    } else if (lines.length > 0) {
      lines[lines.length - 1] += ' ' + line;
    }
  }

  for (const line of lines) {
    const head = line.match(/^.{0,4}(\d{5,7})[^0-9]{1,12}(\d{1,5})\s+(.*)/);
    if (!head) continue;
    const code = head[1];
    const qty = parseInt(head[2], 10);
    if (qty <= 0 || qty > 99999) continue;

    const rest = head[3];
    const dateMatch = rest.match(/(\d{1,2}\/\d{2}\/\d{4})\s*$/);
    if (!dateMatch) continue;
    const expiryDate = parseFecha(dateMatch[1]);

    const beforeDate = rest.slice(0, dateMatch.index).trimEnd();
    const lotMatch = beforeDate.match(/\s+([A-Z0-9]{2,20})\s*$/);
    if (!lotMatch) continue;
    const lotNumber = lotMatch[1];

    const beforeLot = beforeDate
      .slice(0, lotMatch.index)
      .trimEnd()
      .replace(/[^A-Za-z0-9]+$/, '')
      .trimEnd();
    const trailingWord = beforeLot.match(/([A-Z]{2,})\s*$/);

    // La marca queda al final de la descripción, en mayúsculas. Si la
    // última palabra es muy corta (sigla de 2-3 letras), probamos si hay
    // otra palabra en mayúsculas justo antes para armar la marca con las
    // dos (ej. "LAB XYZ") en vez de quedarnos solo con la sigla.
    let marca = '';
    let name = beforeLot;
    if (trailingWord) {
      const word = trailingWord[1];
      const cut = beforeLot.length - trailingWord[0].length;
      if (word.length <= 3) {
        const prevWord = beforeLot.slice(0, cut).match(/([A-Z]{2,})\s*$/);
        if (prevWord) {
          marca = prevWord[1] + ' ' + word;
          name = beforeLot.slice(0, cut - prevWord[0].length).trimEnd();
        } else {
          marca = word;
          name = beforeLot.slice(0, cut).trimEnd();
        }
      } else {
        marca = word;
        name = beforeLot.slice(0, cut).trimEnd();
      }
    }

    if (!name && !marca) continue;
    items.push({
      product_code: code,
      suggested_name: name || rest,
      marca,
      lot_number: lotNumber,
      expiry_date: expiryDate,
      quantity: qty,
      product_id: '',
    });
  }
  return items;
}

// ─── Búsqueda de fechas futuras (candidatas a vencimiento) en un texto ─────

function findFutureDates(text) {
  const currentYear = new Date().getFullYear();
  const dateRe = /\b(\d{1,2}[/-]\d{2}[/-]\d{4}|\d{1,2}[/-]\d{4}|\d{1,2}[/-]\d{2})\b/g;
  const found = [];
  let m;
  while ((m = dateRe.exec(text)) !== null) {
    const norm = parseFecha(m[1]);
    if (!norm) continue;
    if (parseInt(norm.slice(0, 4), 10) >= currentYear) {
      found.push({ raw: m[1], norm, idx: m.index });
    }
  }
  return found;
}

// ─── Parser de respaldo: heurística más laxa por "ventanas" de líneas ──────
//
// Se usa cuando parseItemsFromInvoiceLines no encontró nada (remitos con un
// formato menos tabular). Para cada línea, mira una ventana de líneas
// vecinas buscando una fecha de vencimiento (etiquetada con "vto"/"venc"/etc,
// o simplemente una fecha futura), un número de lote reconocible y una
// cantidad razonable, y arma un ítem con la línea más "descriptiva" de la
// ventana como nombre sugerido.
export function parseItemsFuzzy(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('---'));
  const items = [];
  const seen = new Set();

  for (let i = 0; i < lines.length; i++) {
    const windowLines = lines.slice(Math.max(0, i - 1), i + 4);
    const windowText = windowLines.join(' ');

    const labeledDate = windowText.match(
      /(?:vto\.?|venc(?:imiento)?\.?|f\.?\s*vto\.?|exp\.?)[\s:]*(\d{1,2}[/-]\d{2}[/-]\d{4}|\d{1,2}[/-]\d{4}|\d{1,2}[/-]\d{2})/i
    );
    const futureDates = findFutureDates(windowText);
    const dateRaw = labeledDate?.[1] || futureDates[0]?.raw;
    if (!dateRaw) continue;

    const expiryDate = parseFecha(dateRaw);
    if (!expiryDate) continue;

    const lotMatch =
      windowText.match(/(?:lote|lot\.?|n[°º]?\s*lote|nro\.?\s*lote)[\s.:]*([A-Z0-9][A-Z0-9\-./]{1,25})/i) ||
      windowText.match(/\b([A-Z]{1,4}[0-9]{3,12}[A-Z0-9]*)\b/) ||
      windowText.match(/\b([0-9]{5,15})\b/);

    const quantity =
      (windowText.match(/\b\d{1,6}\b/g) || [])
        .map(Number)
        .filter((v) => v >= 1 && v <= 99999 && v < 1900)[0] || 1;

    const suggestedName =
      windowLines
        .filter((l) => l.length > 5 && l.length < 150 && !/^\d/.test(l.trim()))
        .sort((a, b) => b.length - a.length)[0] || lines[i];

    const dedupeKey = `${expiryDate}|${lotMatch?.[1] || ''}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    items.push({
      suggested_name: suggestedName,
      lot_number: lotMatch?.[1] || '',
      expiry_date: expiryDate,
      quantity,
      product_id: '',
    });
  }
  return items;
}
