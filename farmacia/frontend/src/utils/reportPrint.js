// El botón "PDF" de Reportes no usa una librería de generación de PDF: arma
// un documento HTML standalone con estilos de impresión, lo abre en una
// pestaña nueva y dispara window.print() (el usuario lo guarda como PDF
// desde el diálogo de impresión del navegador). Así se ve en la app en vivo
// hoy — se reproduce tal cual, incluyendo el <img> del logo que apunta a una
// ruta que ya no existe (/stock-control/assets/..., un nombre de proyecto
// anterior); el onerror lo oculta silenciosamente así que no se nota en uso
// normal, pero queda documentado acá por si se quiere corregir en el futuro.

const REPORT_COLUMNS = {
  stock: ['Código', 'Medicamento', 'Acción terapéutica', 'Categoría', 'Stock', 'Stock mín.', 'Unidad', '$ Compra', 'Valor stock'],
  vencimientos: ['Medicamento', 'N° Lote', 'Vencimiento', 'Cantidad', 'Ubicación', 'Días restantes'],
  dispensas: ['Referencia', 'Fecha', 'Paciente', 'Documento', 'Ítems', 'Unidades', 'Operador', 'Observaciones'],
  movimientos: ['Fecha', 'Medicamento', 'Tipo', 'Cantidad', 'Stock ant.', 'Stock nuevo', 'Motivo', 'Operador'],
};

function fmtDateTime(value) {
  return value ? new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

function fmtDate(value) {
  return value ? new Date(value + 'T00:00:00').toLocaleDateString('es-AR') : '—';
}

function rowToCells(type, row) {
  if (type === 'stock') {
    return [
      row.code, row.name, row.therapeutic_action || '—', row.category_name || '—',
      row.stock, row.min_stock, row.unit,
      `$${Number(row.purchase_price).toLocaleString('es-AR')}`,
      `$${Number(row.stock_value).toLocaleString('es-AR')}`,
    ];
  }
  if (type === 'vencimientos') {
    return [
      row.product_name, row.lot_number, fmtDate(row.expiry_date),
      `${row.quantity} ${row.unit}`, row.location_name || '—',
      Number(row.days_left) < 0 ? `Vencido hace ${Math.abs(Number(row.days_left))} días` : `${row.days_left} días`,
    ];
  }
  if (type === 'dispensas') {
    return [
      row.reference, fmtDateTime(row.fecha), `${row.apellido}, ${row.nombre}`, row.documento,
      row.total_items, row.total_unidades, row.operador || '—', row.observaciones || '—',
    ];
  }
  if (type === 'movimientos') {
    return [
      fmtDateTime(row.created_at), row.product_name, row.type, row.quantity,
      row.previous_stock, row.new_stock, row.reason || '—', row.user || '—',
    ];
  }
  return [];
}

export function printReporte(rows, type, title, subtitle) {
  if (!rows || rows.length === 0) return;

  const columns = REPORT_COLUMNS[type] || [];
  const bodyRows = rows.map((row) => rowToCells(type, row));

  const theadHtml = columns.map((c) => `<th>${c}</th>`).join('');
  const tbodyHtml = bodyRows
    .map((cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
    .join('');

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>Reporte ${title}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:10px;margin:16px}
  .header{display:flex;align-items:center;gap:14px;border-bottom:2px solid #1e3a5f;padding-bottom:10px;margin-bottom:10px}
  .header img{height:52px;width:auto}
  .header-text{flex:1}
  .header-muni{font-size:11px;font-weight:700;color:#1e3a5f;line-height:1.3;text-transform:uppercase;letter-spacing:.03em}
  .header-dep{font-size:9px;color:#555;margin-top:2px}
  .header-right{text-align:right;font-size:9px;color:#1e3a5f;font-weight:600;line-height:1.5}
  h2{font-size:13px;margin:6px 0 2px;color:#1e3a5f}
  .sub{color:#666;font-size:9px;margin-bottom:10px}
  table{width:100%;border-collapse:collapse}
  th{background:#1e3a5f;color:#fff;padding:5px 7px;text-align:left;border:1px solid #1e3a5f;font-size:9px}
  td{padding:4px 7px;border:1px solid #ddd;vertical-align:top}
  tr:nth-child(even){background:#f0f4f9}
  @page{margin:15mm}
</style></head><body>
<div class="header">
  <img src="/stock-control/assets/logo-cosquin.png" onerror="this.style.display='none'" alt="" />
  <div class="header-text">
    <div class="header-muni">Municipalidad de la Ciudad de Cosquín</div>
    <div class="header-dep">Secretaría de Salud — Farmacia Municipal</div>
  </div>
  <div class="header-right">Intendente<br/><strong>Dr. Raúl Cardinali</strong></div>
</div>
<h2>Reporte ${title}</h2>
<p class="sub">${subtitle || ''} &nbsp;·&nbsp; Generado: ${new Date().toLocaleString('es-AR')} &nbsp;·&nbsp; ${rows.length} registros</p>
<table><thead><tr>${theadHtml}</tr></thead><tbody>${tbodyHtml}</tbody></table>
</body></html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}
