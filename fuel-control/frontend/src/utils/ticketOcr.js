// Lectura automática de tickets de carga de combustible desde una foto
// sacada con el celular: se corre OCR en el navegador con tesseract.js
// (sin subir la imagen a ningún servidor) y el texto reconocido se parsea
// con heurísticas de expresiones regulares para sugerir los campos del
// formulario de carga (vehículo, tipo de combustible, litros, precio,
// fecha, estación, N° de ticket). El OCR de tickets térmicos es ruidoso:
// estas heurísticas son un punto de partida, el usuario siempre revisa y
// puede corregir cada campo antes de guardar.

// ─── Preprocesado de imagen (mejora la lectura del OCR) ────────────────────
//
// Reescala a un ancho razonable y convierte a escala de grises con un
// contraste simple, que en la práctica mejora bastante el reconocimiento
// de tickets térmicos fotografiados con el celular.
export async function preprocessImage(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });

  const MAX_W = 1600;
  const scale = img.width > MAX_W ? MAX_W / img.width : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.3 + 128));
    d[i] = d[i + 1] = d[i + 2] = contrast;
  }
  ctx.putImageData(imgData, 0, 0);

  return { canvas, previewUrl: dataUrl };
}

// ─── OCR con tesseract.js ───────────────────────────────────────────────────

export async function ocrTicketImage(canvas, onProgress) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('spa', 1, {
    workerPath: new URL('tesseract.js/dist/worker.min.js', import.meta.url).href,
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) onProgress(Math.round(m.progress * 100));
    },
  });
  try {
    const { data: { text } } = await worker.recognize(canvas);
    return text;
  } finally {
    await worker.terminate();
  }
}

// ─── Utilidades numéricas ───────────────────────────────────────────────────

function toNumber(str) {
  if (!str) return null;
  let s = str.trim();
  const hasComma = s.includes(',');
  const dotCount = (s.match(/\./g) || []).length;
  if (hasComma) {
    // Formato con coma decimal: "12.345,67" (punto = miles) o "75,87"
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (dotCount > 1) {
    // Varios puntos sin coma: todos son separadores de miles ("1.234.567")
    s = s.replace(/\./g, '');
  }
  // Un solo punto sin coma ya es un decimal normal ("2439.000" = 2439,
  // como lo imprimen algunos sistemas de facturación con ceros de más)
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

// ─── Fecha / hora ────────────────────────────────────────────────────────

function parseFechaHora(text) {
  // Los remitos/facturas suelen traer OTRAS fechas antes que la de la
  // operación (ej. "Inicio de Actividades: 01/06/2004" del encabezado
  // fiscal del proveedor). Por eso no tomamos la primera fecha que
  // aparece en el texto: preferimos la que está pegada a la etiqueta
  // "FECHA", y solo si no hay ninguna así caemos a la primera como plan B.
  const dateRe = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/g;
  let match;
  let first = null;
  let labeled = null;
  while ((match = dateRe.exec(text)) !== null) {
    if (!first) first = match;
    const before = text.slice(Math.max(0, match.index - 25), match.index).toUpperCase();
    if (/FECHA\s*[:\-]?\s*$/.test(before)) { labeled = match; break; }
  }
  const dateMatch = labeled || first;
  const timeMatch = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);

  let iso = '';
  if (dateMatch) {
    let [, d, m, y] = dateMatch;
    if (y.length === 2) y = `20${y}`;
    d = d.padStart(2, '0');
    m = m.padStart(2, '0');
    if (Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
      iso = `${y}-${m}-${d}`;
    }
  }
  if (!iso) return '';

  const hh = timeMatch ? timeMatch[1].padStart(2, '0') : '12';
  const mm = timeMatch ? timeMatch[2] : '00';
  return `${iso}T${hh}:${mm}`;
}

// ─── Patente ─────────────────────────────────────────────────────────────

function normalizePlate(p) {
  return (p || '').toUpperCase().replace(/[\s\-]/g, '');
}

function findPlate(text, vehicles) {
  const upper = text.toUpperCase();
  const candidates = [
    ...upper.matchAll(/\b[A-Z]{2}\s?-?\s?\d{3}\s?-?\s?[A-Z]{2}\b/g), // Mercosur: AA999AA
    ...upper.matchAll(/\b[A-Z]{3}\s?-?\s?\d{3}\b/g),                  // formato viejo: AAA999
  ].map((m) => normalizePlate(m[0]));

  const byPlate = new Map(vehicles.map((v) => [normalizePlate(v.plate), v]));
  for (const c of candidates) {
    if (byPlate.has(c)) return { vehicle: byPlate.get(c), plateGuess: c };
  }
  return { vehicle: null, plateGuess: candidates[0] || '' };
}

// ─── Litros ──────────────────────────────────────────────────────────────

function findLiters(text) {
  const patterns = [
    /(\d+[.,]\d{1,3})\s*LTS?\.?\b/i,
    /\bLTS?\.?\s*[:\-]?\s*(\d+[.,]\d{1,3})/i,
    /\bLITROS?\s*[:\-]?\s*(\d+[.,]\d{1,3})/i,
    /(\d+[.,]\d{1,3})\s*LITROS?\b/i,
    // Remitos de combustible sin la palabra "litros": "Cant:75.87 PU:..."
    /\bCANT\.?(?:IDAD)?\s*[:\-]?\s*(\d+[.,]\d{1,3})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = toNumber(m[1]);
      if (n && n > 0 && n < 2000) return n;
    }
  }
  return null;
}

// ─── Precio por litro ────────────────────────────────────────────────────

function findPricePerLiter(text) {
  const patterns = [
    /P(?:RECIO)?\.?\s*(?:UNIT(?:ARIO)?|X?\s*LITRO|\/\s*L)\.?\s*[:\-]?\s*\$?\s*(\d+[.,]\d{2,4})/i,
    /\$\s*(\d+[.,]\d{2,4})\s*\/\s*L\b/i,
    // Remitos de combustible: "Prec.Unit: 2439.0000" / "PU:2439.000"
    /\bPREC\.?\s*UNIT\.?\s*[:\-]?\s*\$?\s*(\d+[.,]\d{2,4})/i,
    /\bPU\s*[:\-]?\s*(\d+[.,]\d{2,4})\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = toNumber(m[1]);
      if (n && n > 0 && n < 10000) return n;
    }
  }
  return null;
}

// ─── Importe total ───────────────────────────────────────────────────────

function findTotal(text) {
  const matches = [...text.matchAll(/\bTOTAL\b\s*[:\-]?\s*\$?\s*(\d[\d.,]*\d|\d)/gi)];
  const values = matches.map((m) => toNumber(m[1])).filter((n) => n && n > 0 && n < 100000000);
  if (!values.length) return null;
  return Math.max(...values);
}

// ─── Tipo de combustible ─────────────────────────────────────────────────

function findFuelType(text, fuelTypes) {
  const upper = text.toUpperCase();
  const sorted = [...fuelTypes].sort((a, b) => b.name.length - a.name.length);
  for (const t of sorted) {
    if (upper.includes(t.name.toUpperCase())) return t.name;
  }
  // Sinónimos frecuentes en tickets que no coinciden textualmente con el nombre cargado
  const synonyms = [
    { re: /INFINIA\s*DIESEL/i, match: (t) => /INFINIA.*DIESEL/i.test(t.name) },
    { re: /\bINF\.?\s*DIE\.?\b/i, match: (t) => /INFINIA.*DIESEL/i.test(t.name) }, // "INF DIE" abreviado
    { re: /\bGNC\b/i, match: (t) => /GNC/i.test(t.name) },
    { re: /\bDIESEL\s*500\b|\bGASOIL\b/i, match: (t) => /DIESEL\s*500/i.test(t.name) },
    { re: /\bINFINIA\b/i, match: (t) => /^INFINIA$/i.test(t.name.trim()) },
    { re: /\bSUPER\b/i, match: (t) => /SUPER/i.test(t.name) },
  ];
  for (const s of synonyms) {
    if (s.re.test(upper)) {
      const found = fuelTypes.find(s.match);
      if (found) return found.name;
    }
  }
  return '';
}

// ─── Estación / proveedor ────────────────────────────────────────────────

function findStation(text, suppliers) {
  const upper = text.toUpperCase();
  for (const s of suppliers) {
    if (upper.includes(s.name.toUpperCase())) return s.name;
  }
  return '';
}

// ─── N° de ticket ────────────────────────────────────────────────────────

function findTicketNumber(text) {
  const patterns = [
    /TICKET\s*N?[°ºO]?\.?\s*[:\-]?\s*([\d][\d\-]{3,})/i,
    /COMPROBANTE\s*N?[°ºO]?\.?\s*[:\-]?\s*([\d][\d\-]{3,})/i,
    /REMITO\s*(?:"?X"?)?\s*N?[°ºO]?\.?\s*[:\-]?\s*([\d][\d\-]{3,})/i,
    /N[°ºO]\.?\s*[:\-]?\s*(\d{4,}-\d{4,})/,
    // Sin etiqueta reconocible: el formato NNNNN-NNNNNNNN de remito/factura
    // es lo bastante distintivo (no lo confunde con fechas ni precios).
    /\b(\d{4,6}-\d{6,10})\b/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1].trim();
  }
  return '';
}

// ─── Parser principal ────────────────────────────────────────────────────

export function parseTicket(text, { vehicles = [], fuelTypes = [], suppliers = [] } = {}) {
  const { vehicle, plateGuess } = findPlate(text, vehicles);
  const total = findTotal(text);
  const liters = findLiters(text);
  let pricePerLiter = findPricePerLiter(text);
  if (!pricePerLiter && total && liters) pricePerLiter = Math.round((total / liters) * 10000) / 10000;

  return {
    vehicle_id: vehicle ? vehicle.id : '',
    plate_guess: plateGuess,
    fuel_type: findFuelType(text, fuelTypes),
    liters,
    price_per_liter: pricePerLiter,
    total,
    fueled_at: parseFechaHora(text),
    station: findStation(text, suppliers),
    ticket_number: findTicketNumber(text),
    raw_text: text,
  };
}
