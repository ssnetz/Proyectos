import { useState, useEffect, Fragment } from 'react';
import axios from 'axios';

const REPORT_TYPES = [
  {
    id: 'fuel_by_vehicle',
    icon: '⛽',
    label: 'Cargas por Vehículo',
    desc: 'Litros, costo y cantidad de cargas agrupados por vehículo',
  },
  {
    id: 'km_ranking',
    icon: '📍',
    label: 'Ranking de Kilometraje',
    desc: 'Vehículos ordenados por kilómetros recorridos según GPS',
  },
  {
    id: 'efficiency',
    icon: '📊',
    label: 'Eficiencia de Flota',
    desc: 'Km/litro real vs teórico y costo por kilómetro',
  },
  {
    id: 'monthly_summary',
    icon: '📅',
    label: 'Resumen Mensual',
    desc: 'Litros y costo agrupados por mes con comparativo',
  },
  {
    id: 'monthly_comparison',
    icon: '📈',
    label: 'Comparativa Mensual',
    desc: 'Compara cada mes contra el anterior y resalta aumentos en rojo',
  },
  {
    id: 'by_fuel_type',
    icon: '🛢️',
    label: 'Por Tipo de Combustible',
    desc: 'Distribución de consumo entre Diesel, Nafta y GNC',
  },
  {
    id: 'by_supplier',
    icon: '🏪',
    label: 'Por Proveedor',
    desc: 'Litros y costo por proveedor / estación de carga',
  },
  {
    id: 'km_desde_carga',
    icon: '🔍',
    label: 'Km desde Última Carga',
    desc: 'Fecha y litros de la última carga, y km GPS acumulados desde entonces día por día',
  },
];

const MONTHS_ES = {
  January:'Enero',February:'Febrero',March:'Marzo',April:'Abril',
  May:'Mayo',June:'Junio',July:'Julio',August:'Agosto',
  September:'Septiembre',October:'Octubre',November:'Noviembre',December:'Diciembre',
};

function fmt(n, dec = 0) {
  if (n == null || n === '') return '—';
  const num = parseFloat(n);
  if (isNaN(num)) return '—';
  return num.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtPeso(n) {
  if (n == null || n === '') return '—';
  return '$' + fmt(n, 0);
}

// Formatea una variación (delta) mes a mes: signo, valor absoluto y unidad/moneda
function formatDelta(delta, decimals, unit, money) {
  const sign = delta > 0 ? '+' : delta < 0 ? '-' : '';
  const abs  = Math.abs(delta);
  return money ? `${sign}$${fmt(abs, decimals)}` : `${sign}${fmt(abs, decimals)}${unit}`;
}
function deltaHtml(delta, pct, decimals = 1, unit = '', money = false) {
  if (delta === null || delta === undefined || pct === null || pct === undefined) return '<span class="delta-flat">—</span>';
  const cls   = delta > 0 ? 'delta-up' : delta < 0 ? 'delta-down' : 'delta-flat';
  const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '■';
  const pctStr = `${pct > 0 ? '+' : ''}${fmt(pct, 1)}%`;
  return `<span class="${cls}">${arrow} ${formatDelta(delta, decimals, unit, money)} (${pctStr})</span>`;
}

/* ── Print helpers ─────────────────────────────────── */
const PRINT_CSS = `
  @import url('');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #1c2333; background: #fff; }
  .rpt-header { background: #1a4fa0; color: #fff; padding: 16px 24px; display: flex; justify-content: space-between; align-items: flex-end; }
  .rpt-header h1 { font-size: 18px; font-weight: 700; }
  .rpt-header .sub { font-size: 10px; opacity: .8; margin-top: 3px; }
  .rpt-header .meta { text-align: right; font-size: 10px; opacity: .85; }
  .rpt-summary { display: flex; gap: 0; border-bottom: 2px solid #1a4fa0; }
  .rpt-stat { flex: 1; padding: 10px 16px; border-right: 1px solid #dde2ea; }
  .rpt-stat:last-child { border-right: none; }
  .rpt-stat .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: .05em; color: #8a93a6; }
  .rpt-stat .val { font-size: 18px; font-weight: 700; color: #1a4fa0; margin-top: 2px; }
  .rpt-body { padding: 16px 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10.5px; }
  thead th { background: #e8eef8; padding: 6px 8px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #5a6478; border-bottom: 2px solid #1a4fa0; }
  th.num, td.num { text-align: right; }
  tbody tr:nth-child(even) td { background: #f7f8fa; }
  tbody td { padding: 5px 8px; border-bottom: 1px solid #eaecf0; }
  tfoot td { padding: 6px 8px; font-weight: 700; background: #e8eef8; border-top: 2px solid #1a4fa0; color: #1a4fa0; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 9px; font-weight: 700; }
  .badge-blue { background: #1a4fa0; color: #fff; }
  .badge-green { background: #16a34a; color: #fff; }
  .badge-amber { background: #d97706; color: #fff; }
  .badge-red   { background: #dc2626; color: #fff; }
  .delta-up   { color: #dc2626; font-weight: 700; }
  .delta-down { color: #16a34a; font-weight: 700; }
  .delta-flat { color: #8a93a6; }
  .rpt-footer { margin-top: 24px; font-size: 9px; color: #8a93a6; border-top: 1px solid #dde2ea; padding-top: 8px; display: flex; justify-content: space-between; }
  .rpt-logo { height: 48px; width: auto; margin-right: 14px; vertical-align: middle; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-30deg); opacity: 0.04; pointer-events: none; z-index: 0; }
  .watermark img { width: 380px; }
  @media print { @page { margin: 12mm; size: A4 landscape; } }
`;

function openPrintWindow(html) {
  const w = window.open('', '_blank', 'width=1100,height=800');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${PRINT_CSS}</style></head><body><div class="watermark"><img src="/fuel-control/logo.png" alt=""/></div>${html}</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 600);
}

function fmtDate(d) {
  if (!d) return null;
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function buildHeader(reportLabel, from, to, stats, minDate, maxDate) {
  const f = fmtDate(from) || fmtDate(minDate);
  const t = fmtDate(to)   || fmtDate(maxDate);
  let dateRange;
  if (f && t)   dateRange = `Período: ${f} al ${t}`;
  else if (f)   dateRange = `Desde el ${f}`;
  else if (t)   dateRange = `Hasta el ${t}`;
  else          dateRange = 'Período: sin datos';
  const statsHtml = stats.map(s => `<div class="rpt-stat"><div class="lbl">${s.label}</div><div class="val">${s.value}</div></div>`).join('');
  const now = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return `
    <div class="rpt-header">
      <div style="display:flex;align-items:center;">
        <img src="/fuel-control/logo.png" alt="Logo" class="rpt-logo" />
        <div>
          <h1>${reportLabel}</h1>
          <div class="sub">Municipalidad de Cosquín &nbsp;·&nbsp; <strong>${dateRange}</strong></div>
        </div>
      </div>
      <div class="meta">Generado: ${now}<br>Sistema de Control de Combustible</div>
    </div>
    <div class="rpt-summary">${statsHtml}</div>
    <div class="rpt-body">`;
}

function buildFooter() {
  return `</div><div class="rpt-footer"><span>Municipalidad de Cosquín — Sistema de Control de Combustible</span><span>© ${new Date().getFullYear()} SSNetz</span></div>`;
}

/* ── Print builders por tipo ───────────────────────── */
// Calcula min y max fecha de un array usando un campo date string
function minMax(data, field) {
  const dates = data.map(r => r[field]).filter(Boolean).sort();
  return { minDate: dates[0]?.slice(0,10) || null, maxDate: dates[dates.length-1]?.slice(0,10) || null };
}

function printFuelByVehicle(data, from, to, minDate, maxDate) {
  const totLit  = data.reduce((a, r) => a + +r.total_litros, 0);
  const totCost = data.reduce((a, r) => a + +(r.total_costo || 0), 0);
  const totCar  = data.reduce((a, r) => a + +r.num_cargas, 0);
  const rows = data.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${r.name}</strong></td>
      <td>${r.plate}</td>
      <td>${r.numeros_ticket || '—'}</td>
      <td>${r.tipos_combustible || '—'}</td>
      <td class="num">${fmt(r.num_cargas)}</td>
      <td class="num">${fmt(r.total_litros, 2)} L</td>
      <td class="num">${fmt(r.prom_litros, 2)} L</td>
      <td class="num">${fmtPeso(r.total_costo)}</td>
      <td class="num">${r.prom_precio ? '$' + fmt(r.prom_precio, 0) + '/L' : '—'}</td>
    </tr>`).join('');
  const html = buildHeader('Cargas de Combustible por Vehículo', from, to, [
    { label: 'Vehículos', value: data.length },
    { label: 'Total cargas', value: fmt(totCar) },
    { label: 'Total litros', value: fmt(totLit, 2) + ' L' },
    { label: 'Costo total', value: fmtPeso(totCost) },
  ], minDate, maxDate) + `
    <table>
      <thead><tr><th>#</th><th>Vehículo</th><th>Patente</th><th>N° de Ticket</th><th>Combustible</th><th class="num">Cargas</th><th class="num">Total Litros</th><th class="num">Prom/Carga</th><th class="num">Costo Total</th><th class="num">Precio/L</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="5">TOTAL</td><td class="num">${fmt(totCar)}</td><td class="num">${fmt(totLit, 2)} L</td><td class="num">—</td><td class="num">${fmtPeso(totCost)}</td><td></td></tr></tfoot>
    </table>` + buildFooter();
  openPrintWindow(html);
}

function printKmRanking(data, from, to, minDate, maxDate) {
  const totKm = data.reduce((a, r) => a + +r.total_km, 0);
  const rows = data.map((r, i) => `
    <tr>
      <td><strong>#${i + 1}</strong></td>
      <td><strong>${r.name}</strong></td>
      <td>${r.plate}</td>
      <td><span class="badge badge-blue">${r.type}</span></td>
      <td class="num">${fmt(r.total_km, 1)} km</td>
      <td class="num">${fmt(r.prom_km_dia, 1)} km</td>
      <td class="num">${fmt(r.max_km_dia, 1)} km</td>
      <td class="num">${r.vel_prom ? fmt(r.vel_prom, 1) + ' km/h' : '—'}</td>
      <td class="num">${r.vel_max ? fmt(r.vel_max, 0) + ' km/h' : '—'}</td>
      <td class="num">${fmt(r.dias_con_gps)}</td>
    </tr>`).join('');
  const html = buildHeader('Ranking de Kilometraje por Vehículo', from, to, [
    { label: 'Vehículos', value: data.length },
    { label: 'Total km recorridos', value: fmt(totKm, 0) + ' km' },
    { label: 'Prom. por vehículo', value: fmt(totKm / (data.length || 1), 0) + ' km' },
  ], minDate, maxDate) + `
    <table>
      <thead><tr><th>Pos.</th><th>Vehículo</th><th>Patente</th><th>Tipo</th><th class="num">Total Km</th><th class="num">Prom/Día</th><th class="num">Máx/Día</th><th class="num">Vel. Prom</th><th class="num">Vel. Máx</th><th class="num">Días GPS</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="4">TOTAL</td><td class="num">${fmt(totKm, 1)} km</td><td colspan="5"></td></tr></tfoot>
    </table>` + buildFooter();
  openPrintWindow(html);
}

function printEfficiency(data, from, to, minDate, maxDate) {
  const rows = data.map(r => {
    const diff = r.km_l_real && r.km_l_teorico ? (r.km_l_real - r.km_l_teorico).toFixed(2) : null;
    const badge = !diff ? '' : +diff >= 0
      ? `<span class="badge badge-green">+${diff}</span>`
      : `<span class="badge badge-red">${diff}</span>`;
    return `<tr>
      <td><strong>${r.name}</strong></td>
      <td>${r.plate}</td>
      <td class="num">${r.km_l_teorico ? fmt(r.km_l_teorico, 2) : '—'}</td>
      <td class="num">${r.km_l_real ? fmt(r.km_l_real, 2) : '—'} ${badge}</td>
      <td class="num">${fmt(r.total_km, 0)} km</td>
      <td class="num">${fmt(r.total_litros, 2)} L</td>
      <td class="num">${r.costo_x_km ? '$' + fmt(r.costo_x_km, 0) + '/km' : '—'}</td>
    </tr>`;
  }).join('');
  const html = buildHeader('Eficiencia de Flota — Km/Litro Real vs Teórico', from, to, [
    { label: 'Vehículos analizados', value: data.length },
  ], minDate, maxDate) + `
    <table>
      <thead><tr><th>Vehículo</th><th>Patente</th><th class="num">Km/L Teórico</th><th class="num">Km/L Real</th><th class="num">Total Km</th><th class="num">Total Litros</th><th class="num">Costo/Km</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>` + buildFooter();
  openPrintWindow(html);
}

function printMonthlySummary(data, from, to, minDate, maxDate) {
  const totLit  = data.reduce((a, r) => a + +r.total_litros, 0);
  const totCost = data.reduce((a, r) => a + +(r.total_costo || 0), 0);
  const totKm   = data.reduce((a, r) => a + +(r.total_km || 0), 0);
  const rows = data.map(r => {
    const [mName, yr] = r.mes_label.split(' ');
    const label = (MONTHS_ES[mName] || mName) + ' ' + yr;
    const detalle = (r.desglose_combustible || []).map(d =>
      `<strong>${d.fuel_type}</strong>: ${fmt(d.total_litros, 2)} L${d.prom_precio ? ' ($' + fmt(d.prom_precio, 0) + '/L)' : ''} — ${fmtPeso(d.total_costo)}`
    ).join('&nbsp;&nbsp;|&nbsp;&nbsp;');
    return `<tr>
      <td><strong>${label}</strong></td>
      <td class="num">${fmt(r.num_cargas)}</td>
      <td class="num">${fmt(r.vehiculos)}</td>
      <td class="num">${fmt(r.total_litros, 2)} L</td>
      <td class="num">${r.total_km ? fmt(r.total_km, 0) + ' km' : '—'}</td>
      <td class="num">${fmtPeso(r.total_costo)}</td>
      <td class="num">${r.prom_precio ? '$' + fmt(r.prom_precio, 0) + '/L' : '—'}</td>
    </tr>` + (detalle ? `<tr><td colspan="7" style="padding:2px 8px 8px 20px;font-size:9px;color:#5a6478;">${detalle}</td></tr>` : '');
  }).join('');
  const html = buildHeader('Resumen Mensual de Combustible', from, to, [
    { label: 'Meses', value: data.length },
    { label: 'Total litros', value: fmt(totLit, 2) + ' L' },
    { label: 'Total km', value: fmt(totKm, 0) + ' km' },
    { label: 'Costo total', value: fmtPeso(totCost) },
  ], minDate, maxDate) + `
    <table>
      <thead><tr><th>Mes</th><th class="num">Cargas</th><th class="num">Vehículos</th><th class="num">Total Litros</th><th class="num">Total Km</th><th class="num">Costo Total</th><th class="num">Precio Prom/L</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td>TOTAL</td><td class="num">${fmt(data.reduce((a,r)=>a+ +r.num_cargas,0))}</td><td></td><td class="num">${fmt(totLit, 2)} L</td><td class="num">${fmt(totKm,0)} km</td><td class="num">${fmtPeso(totCost)}</td><td></td></tr></tfoot>
    </table>` + buildFooter();
  openPrintWindow(html);
}

function printMonthlyComparison(data, from, to, minDate, maxDate) {
  const totLit  = data.reduce((a, r) => a + +r.total_litros, 0);
  const totCost = data.reduce((a, r) => a + +(r.total_costo || 0), 0);
  const totKm   = data.reduce((a, r) => a + +(r.total_km || 0), 0);
  const monthLabel = r => { const [m, y] = r.mes_label.split(' '); return (MONTHS_ES[m] || m) + ' ' + y; };
  const rows = data.map(r => `
    <tr>
      <td><strong>${monthLabel(r)}</strong></td>
      <td class="num">${fmt(r.total_litros, 2)} L</td>
      <td class="num">${fmtPeso(r.total_costo)}</td>
      <td class="num">${r.prom_precio ? '$' + fmt(r.prom_precio, 0) + '/L' : '—'}</td>
      <td class="num">${r.total_km ? fmt(r.total_km, 0) + ' km' : '—'}${(r.total_km_delta !== null && r.total_km_delta !== undefined) ? `<br>${deltaHtml(r.total_km_delta, r.total_km_pct, 0, ' km')}` : ''}</td>
    </tr>`).join('');
  const detailRows = data.map(r => {
    const vehDetalle = (r.detalle_vehiculos || []).map(d => {
      const cls = d.costo_delta > 0 ? 'delta-up' : d.costo_delta < 0 ? 'delta-down' : 'delta-flat';
      return `<span class="${cls}"><strong>${d.name}</strong> (${d.plate}): ${formatDelta(d.litros_delta, 1, ' L', false)} — ${formatDelta(d.costo_delta, 0, '', true)} — ${formatDelta(d.km_delta, 0, ' km', false)}</span>`;
    }).join('&nbsp;&nbsp;|&nbsp;&nbsp;');
    return `<tr>
      <td><strong>${monthLabel(r)}</strong></td>
      <td class="num">${deltaHtml(r.total_litros_delta, r.total_litros_pct, 1, ' L')}</td>
      <td class="num">${deltaHtml(r.total_costo_delta, r.total_costo_pct, 0, '', true)}</td>
      <td class="num">${deltaHtml(r.prom_precio_delta, r.prom_precio_pct, 0, '', true)}</td>
      <td class="num">${deltaHtml(r.total_km_delta, r.total_km_pct, 0, ' km')}</td>
    </tr>` + (vehDetalle ? `<tr><td colspan="5" style="padding:2px 8px 8px 20px;font-size:9px;">${vehDetalle}</td></tr>` : '');
  }).join('');
  const html = buildHeader('Comparativa Mensual de Combustible', from, to, [
    { label: 'Meses', value: data.length },
    { label: 'Total litros', value: fmt(totLit, 2) + ' L' },
    { label: 'Total km', value: fmt(totKm, 0) + ' km' },
    { label: 'Costo total', value: fmtPeso(totCost) },
  ], minDate, maxDate) + `
    <table>
      <thead><tr><th>Mes</th><th class="num">Total Litros</th><th class="num">Costo Total</th><th class="num">Precio Prom/L</th><th class="num">Total Km</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <h2 style="margin-top:20px;font-size:12px;font-weight:700;color:#1a4fa0;text-transform:uppercase;letter-spacing:.05em;">Variación respecto al mes anterior</h2>
    <table>
      <thead><tr><th>Mes</th><th class="num">Litros</th><th class="num">Costo</th><th class="num">Precio Prom/L</th><th class="num">Km</th></tr></thead>
      <tbody>${detailRows}</tbody>
    </table>` + buildFooter();
  openPrintWindow(html);
}

function printByFuelType(data, from, to, minDate, maxDate) {
  const totLit = data.reduce((a, r) => a + +r.total_litros, 0);
  const rows = data.map(r => `
    <tr>
      <td><strong>${r.fuel_type}</strong></td>
      <td class="num">${fmt(r.num_cargas)}</td>
      <td class="num">${fmt(r.vehiculos)}</td>
      <td class="num">${fmt(r.total_litros, 2)} L</td>
      <td class="num">${fmt((r.total_litros / totLit) * 100, 1)}%</td>
      <td class="num">${fmtPeso(r.total_costo)}</td>
      <td class="num">${r.prom_precio ? '$' + fmt(r.prom_precio, 0) + '/L' : '—'}</td>
    </tr>`).join('');
  const html = buildHeader('Consumo por Tipo de Combustible', from, to, [
    { label: 'Tipos', value: data.length },
    { label: 'Total litros', value: fmt(totLit, 2) + ' L' },
    { label: 'Costo total', value: fmtPeso(data.reduce((a,r)=>a+ +(r.total_costo||0),0)) },
  ], minDate, maxDate) + `
    <table>
      <thead><tr><th>Tipo</th><th class="num">Cargas</th><th class="num">Vehículos</th><th class="num">Total Litros</th><th class="num">% del Total</th><th class="num">Costo Total</th><th class="num">Precio Prom/L</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>` + buildFooter();
  openPrintWindow(html);
}

function printBySupplier(data, from, to, minDate, maxDate) {
  const totLit = data.reduce((a, r) => a + +r.total_litros, 0);
  const rows = data.map(r => `
    <tr>
      <td><strong>${r.proveedor}</strong></td>
      <td class="num">${fmt(r.num_cargas)}</td>
      <td class="num">${fmt(r.vehiculos)}</td>
      <td class="num">${fmt(r.total_litros, 2)} L</td>
      <td class="num">${fmt((r.total_litros / totLit) * 100, 1)}%</td>
      <td class="num">${fmtPeso(r.total_costo)}</td>
    </tr>`).join('');
  const html = buildHeader('Cargas por Proveedor', from, to, [
    { label: 'Proveedores', value: data.length },
    { label: 'Total litros', value: fmt(totLit, 2) + ' L' },
    { label: 'Costo total', value: fmtPeso(data.reduce((a,r)=>a+ +(r.total_costo||0),0)) },
  ], minDate, maxDate) + `
    <table>
      <thead><tr><th>Proveedor</th><th class="num">Cargas</th><th class="num">Vehículos</th><th class="num">Total Litros</th><th class="num">% del Total</th><th class="num">Costo Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>` + buildFooter();
  openPrintWindow(html);
}

function printKmDesdeCarga(data, from, to, minDate, maxDate) {
  const totKm = data.reduce((a, r) => a + +r.total_km, 0);
  const rows = data.map(r => {
    const detalle = (r.dias_detalle || []).map(d => `${fmtDate(d.fecha)}: ${fmt(d.km, 1)} km`).join(' | ');
    return `<tr>
      <td><strong>${r.name}</strong></td>
      <td>${r.plate}</td>
      <td>${r.ultima_carga ? fmtDate(r.ultima_carga) : 'Sin cargas'}</td>
      <td class="num">${r.ultimos_litros != null ? fmt(r.ultimos_litros, 2) + ' L' : '—'}</td>
      <td class="num">${fmt(r.total_km, 1)} km</td>
      <td class="num">${fmt(r.dias_gps)}</td>
    </tr>` + (detalle ? `<tr><td colspan="6" style="padding:2px 8px 8px 20px;font-size:9px;color:#5a6478;">${detalle}</td></tr>` : '');
  }).join('');
  const html = buildHeader('Km desde Última Carga (Auditoría GPS)', from, to, [
    { label: 'Vehículos', value: data.length },
    { label: 'Total km pendientes', value: fmt(totKm, 1) + ' km' },
  ], minDate, maxDate) + `
    <table>
      <thead><tr><th>Vehículo</th><th>Patente</th><th>Última Carga</th><th class="num">Litros</th><th class="num">Km desde Entonces</th><th class="num">Días GPS</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>` + buildFooter();
  openPrintWindow(html);
}

const PRINT_FNS = {
  fuel_by_vehicle: printFuelByVehicle,
  km_ranking:      printKmRanking,
  efficiency:      printEfficiency,
  monthly_summary: printMonthlySummary,
  monthly_comparison: printMonthlyComparison,
  by_fuel_type:    printByFuelType,
  by_supplier:     printBySupplier,
  km_desde_carga:  printKmDesdeCarga,
};

// Lista de N° de ticket en pantalla: si hay más de uno, muestra el primero
// y un "+N" que expande el resto al hacer clic (en la impresión van todos
// juntos separados por coma, sin necesidad de expandir).
function TicketList({ value }) {
  const [expanded, setExpanded] = useState(false);
  const tickets = (value || '').split(', ').filter(Boolean);
  if (tickets.length === 0) return '—';
  if (tickets.length === 1) return tickets[0];
  return expanded ? (
    <span>
      {tickets.join(', ')}{' '}
      <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '1px 6px', fontSize: '.75em' }}
        onClick={() => setExpanded(false)}>−</button>
    </span>
  ) : (
    <span>
      {tickets[0]}{' '}
      <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '1px 6px', fontSize: '.75em' }}
        onClick={() => setExpanded(true)}>+{tickets.length - 1}</button>
    </span>
  );
}

/* ── Preview components ─────────────────────────────── */
function PreviewFuelByVehicle({ data }) {
  const totLit  = data.reduce((a, r) => a + +r.total_litros, 0);
  const totCost = data.reduce((a, r) => a + +(r.total_costo || 0), 0);
  return (
    <div className="table-wrapper">
      <table className="table">
        <thead><tr><th>#</th><th>Vehículo</th><th>Patente</th><th>N° de Ticket</th><th>Combustible</th><th style={{textAlign:'right'}}>Cargas</th><th style={{textAlign:'right'}}>Litros</th><th style={{textAlign:'right'}}>Costo Total</th><th style={{textAlign:'right'}}>Prom/Carga</th></tr></thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={r.id}>
              <td style={{color:'var(--gray-400)',fontSize:'.8em'}}>{i+1}</td>
              <td><strong>{r.name}</strong></td>
              <td>{r.plate}</td>
              <td><TicketList value={r.numeros_ticket} /></td>
              <td>{r.tipos_combustible || '—'}</td>
              <td style={{textAlign:'right'}}>{fmt(r.num_cargas)}</td>
              <td style={{textAlign:'right'}}>{fmt(r.total_litros, 2)} L</td>
              <td style={{textAlign:'right'}}>{fmtPeso(r.total_costo)}</td>
              <td style={{textAlign:'right'}}>{fmt(r.prom_litros, 2)} L</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr>
          <td colSpan={5}><strong>TOTAL</strong></td>
          <td style={{textAlign:'right'}}><strong>{fmt(data.reduce((a,r)=>a+ +r.num_cargas,0))}</strong></td>
          <td style={{textAlign:'right'}}><strong>{fmt(totLit, 2)} L</strong></td>
          <td style={{textAlign:'right'}}><strong>{fmtPeso(totCost)}</strong></td>
          <td></td>
        </tr></tfoot>
      </table>
    </div>
  );
}

function PreviewKmRanking({ data }) {
  return (
    <div className="table-wrapper">
      <table className="table">
        <thead><tr><th>Pos.</th><th>Vehículo</th><th>Patente</th><th style={{textAlign:'right'}}>Total Km</th><th style={{textAlign:'right'}}>Prom/Día</th><th style={{textAlign:'right'}}>Máx/Día</th><th style={{textAlign:'right'}}>Vel. Prom</th><th style={{textAlign:'right'}}>Días GPS</th></tr></thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={r.id}>
              <td><strong>#{i+1}</strong></td>
              <td><strong>{r.name}</strong></td>
              <td>{r.plate}</td>
              <td style={{textAlign:'right'}}>{fmt(r.total_km,1)} km</td>
              <td style={{textAlign:'right'}}>{fmt(r.prom_km_dia,1)} km</td>
              <td style={{textAlign:'right'}}>{fmt(r.max_km_dia,1)} km</td>
              <td style={{textAlign:'right'}}>{r.vel_prom ? fmt(r.vel_prom,1)+' km/h' : '—'}</td>
              <td style={{textAlign:'right'}}>{fmt(r.dias_con_gps)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PreviewGeneric({ data, columns }) {
  return (
    <div className="table-wrapper">
      <table className="table">
        <thead><tr>{columns.map(c => <th key={c.key} style={c.right?{textAlign:'right'}:{}}>{c.label}</th>)}</tr></thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={i}>
              {columns.map(c => (
                <td key={c.key} style={c.right?{textAlign:'right'}:{}}>{c.render ? c.render(r) : (r[c.key] ?? '—')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PreviewMonthlySummary({ data }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const toggle = (mes) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(mes) ? next.delete(mes) : next.add(mes);
      return next;
    });
  };
  return (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>
            <th style={{width:24}}></th>
            <th>Mes</th>
            <th style={{textAlign:'right'}}>Cargas</th>
            <th style={{textAlign:'right'}}>Vehículos</th>
            <th style={{textAlign:'right'}}>Total Litros</th>
            <th style={{textAlign:'right'}}>Total Km</th>
            <th style={{textAlign:'right'}}>Costo Total</th>
            <th style={{textAlign:'right'}}>Precio Prom/L</th>
          </tr>
        </thead>
        <tbody>
          {data.map(r => {
            const [m, y] = r.mes_label.split(' ');
            const label = (MONTHS_ES[m] || m) + ' ' + y;
            const detalle = r.desglose_combustible || [];
            const isOpen = expanded.has(r.mes);
            return (
              <Fragment key={r.mes}>
                <tr
                  onClick={() => detalle.length && toggle(r.mes)}
                  style={{cursor: detalle.length ? 'pointer' : 'default'}}
                >
                  <td style={{textAlign:'center', color:'var(--gray-400)'}}>{detalle.length ? (isOpen ? '▾' : '▸') : ''}</td>
                  <td><strong>{label}</strong></td>
                  <td style={{textAlign:'right'}}>{fmt(r.num_cargas)}</td>
                  <td style={{textAlign:'right'}}>{fmt(r.vehiculos)}</td>
                  <td style={{textAlign:'right'}}>{fmt(r.total_litros, 2)} L</td>
                  <td style={{textAlign:'right'}}>{r.total_km ? fmt(r.total_km,0)+' km' : '—'}</td>
                  <td style={{textAlign:'right'}}>{fmtPeso(r.total_costo)}</td>
                  <td style={{textAlign:'right'}}>{r.prom_precio ? '$'+fmt(r.prom_precio,0)+'/L' : '—'}</td>
                </tr>
                {isOpen && (
                  <tr>
                    <td></td>
                    <td colSpan={7} style={{padding:'0 0 8px'}}>
                      <table className="table" style={{margin:0, background:'var(--gray-50,#f9fafb)'}}>
                        <thead>
                          <tr>
                            <th>Tipo</th>
                            <th style={{textAlign:'right'}}>Litros</th>
                            <th style={{textAlign:'right'}}>% del mes</th>
                            <th style={{textAlign:'right'}}>Precio Prom/L</th>
                            <th style={{textAlign:'right'}}>Costo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detalle.map(d => (
                            <tr key={d.fuel_type}>
                              <td>{d.fuel_type}</td>
                              <td style={{textAlign:'right'}}>{fmt(d.total_litros, 2)} L</td>
                              <td style={{textAlign:'right'}}>{fmt((d.total_litros / r.total_litros) * 100, 1)}%</td>
                              <td style={{textAlign:'right'}}>{d.prom_precio ? '$'+fmt(d.prom_precio,0)+'/L' : '—'}</td>
                              <td style={{textAlign:'right'}}>{fmtPeso(d.total_costo)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PreviewKmDesdeCarga({ data }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const toggle = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  return (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>
            <th style={{width:24}}></th>
            <th>Vehículo</th>
            <th>Patente</th>
            <th>Última Carga</th>
            <th style={{textAlign:'right'}}>Litros</th>
            <th style={{textAlign:'right'}}>Km desde Entonces</th>
            <th style={{textAlign:'right'}}>Días GPS</th>
          </tr>
        </thead>
        <tbody>
          {data.map(r => {
            const dias = r.dias_detalle || [];
            const isOpen = expanded.has(r.id);
            return (
              <Fragment key={r.id}>
                <tr
                  onClick={() => dias.length && toggle(r.id)}
                  style={{cursor: dias.length ? 'pointer' : 'default'}}
                >
                  <td style={{textAlign:'center', color:'var(--gray-400)'}}>{dias.length ? (isOpen ? '▾' : '▸') : ''}</td>
                  <td><strong>{r.name}</strong></td>
                  <td>{r.plate}</td>
                  <td>{r.ultima_carga ? fmtDate(r.ultima_carga) : <span style={{color:'var(--gray-400)'}}>Sin cargas</span>}</td>
                  <td style={{textAlign:'right'}}>{r.ultimos_litros != null ? fmt(r.ultimos_litros, 2) + ' L' : '—'}</td>
                  <td style={{textAlign:'right'}}><strong>{fmt(r.total_km, 1)} km</strong></td>
                  <td style={{textAlign:'right'}}>{fmt(r.dias_gps)}</td>
                </tr>
                {isOpen && (
                  <tr>
                    <td></td>
                    <td colSpan={6} style={{padding:'0 0 8px'}}>
                      <table className="table" style={{margin:0, background:'var(--gray-50,#f9fafb)'}}>
                        <thead>
                          <tr>
                            <th>Fecha GPS</th>
                            <th style={{textAlign:'right'}}>Km</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dias.map(d => (
                            <tr key={d.fecha}>
                              <td>{fmtDate(d.fecha)}</td>
                              <td style={{textAlign:'right'}}>{fmt(d.km, 1)} km</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DeltaBadge({ delta, pct, unit = '', decimals = 1, money = false }) {
  if (delta === null || delta === undefined || pct === null || pct === undefined) {
    return <span style={{color:'var(--gray-400)'}}>—</span>;
  }
  const color = delta > 0 ? '#dc2626' : delta < 0 ? '#16a34a' : 'var(--gray-400)';
  const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '■';
  const pctStr = `${pct > 0 ? '+' : ''}${fmt(pct, 1)}%`;
  return (
    <span style={{color, fontWeight:700}}>
      {arrow} {formatDelta(delta, decimals, unit, money)}{' '}
      <span style={{fontWeight:400, fontSize:'.85em'}}>({pctStr})</span>
    </span>
  );
}

function PreviewMonthlyComparison({ data }) {
  const monthLabel = r => { const [m, y] = r.mes_label.split(' '); return (MONTHS_ES[m] || m) + ' ' + y; };
  const [expanded, setExpanded] = useState(() => new Set());
  const toggle = (mes) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(mes) ? next.delete(mes) : next.add(mes);
      return next;
    });
  };
  return (
    <div>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Mes</th>
              <th style={{textAlign:'right'}}>Total Litros</th>
              <th style={{textAlign:'right'}}>Costo Total</th>
              <th style={{textAlign:'right'}}>Precio Prom/L</th>
              <th style={{textAlign:'right'}}>Total Km</th>
            </tr>
          </thead>
          <tbody>
            {data.map(r => (
              <tr key={r.mes}>
                <td><strong>{monthLabel(r)}</strong></td>
                <td style={{textAlign:'right'}}>{fmt(r.total_litros, 2)} L</td>
                <td style={{textAlign:'right'}}>{fmtPeso(r.total_costo)}</td>
                <td style={{textAlign:'right'}}>{r.prom_precio ? '$'+fmt(r.prom_precio,0)+'/L' : '—'}</td>
                <td style={{textAlign:'right'}}>
                  {r.total_km ? fmt(r.total_km,0)+' km' : '—'}
                  {(r.total_km_delta !== null && r.total_km_delta !== undefined) && (
                    <div style={{fontSize:'.75em', marginTop:2}}>
                      <DeltaBadge delta={r.total_km_delta} pct={r.total_km_pct} unit=" km" decimals={0} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={{fontSize:'.85rem', fontWeight:700, margin:'20px 0 8px', color:'var(--gray-600,#4b5563)'}}>
        Variación respecto al mes anterior
      </h3>
      <p style={{fontSize:'.75rem', color:'var(--gray-500)', margin:'-4px 0 8px'}}>
        Tocá un mes para ver qué vehículos explican la diferencia.
      </p>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th style={{width:24}}></th>
              <th>Mes</th>
              <th style={{textAlign:'right'}}>Litros</th>
              <th style={{textAlign:'right'}}>Costo</th>
              <th style={{textAlign:'right'}}>Precio Prom/L</th>
              <th style={{textAlign:'right'}}>Km</th>
            </tr>
          </thead>
          <tbody>
            {data.map(r => {
              const detalle = r.detalle_vehiculos || [];
              const isOpen = expanded.has(r.mes);
              return (
                <Fragment key={r.mes + '-delta'}>
                  <tr
                    onClick={() => detalle.length && toggle(r.mes)}
                    style={{cursor: detalle.length ? 'pointer' : 'default'}}
                  >
                    <td style={{textAlign:'center', color:'var(--gray-400)'}}>{detalle.length ? (isOpen ? '▾' : '▸') : ''}</td>
                    <td><strong>{monthLabel(r)}</strong></td>
                    <td style={{textAlign:'right'}}><DeltaBadge delta={r.total_litros_delta} pct={r.total_litros_pct} unit=" L" decimals={1} /></td>
                    <td style={{textAlign:'right'}}><DeltaBadge delta={r.total_costo_delta} pct={r.total_costo_pct} decimals={0} money /></td>
                    <td style={{textAlign:'right'}}><DeltaBadge delta={r.prom_precio_delta} pct={r.prom_precio_pct} decimals={0} money /></td>
                    <td style={{textAlign:'right'}}><DeltaBadge delta={r.total_km_delta} pct={r.total_km_pct} unit=" km" decimals={0} /></td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td></td>
                      <td colSpan={5} style={{padding:'0 0 8px'}}>
                        <table className="table" style={{margin:0, background:'var(--gray-50,#f9fafb)'}}>
                          <thead>
                            <tr>
                              <th>Vehículo</th>
                              <th>Patente</th>
                              <th style={{textAlign:'right'}}>Litros</th>
                              <th style={{textAlign:'right'}}>Costo</th>
                              <th style={{textAlign:'right'}}>Km</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detalle.map(d => (
                              <tr key={d.vehicle_id}>
                                <td>{d.name}</td>
                                <td>{d.plate}</td>
                                <td style={{textAlign:'right'}}>
                                  <span style={{color: d.litros_delta > 0 ? '#dc2626' : d.litros_delta < 0 ? '#16a34a' : 'var(--gray-400)'}}>
                                    {formatDelta(d.litros_delta, 1, ' L', false)}
                                  </span>
                                </td>
                                <td style={{textAlign:'right'}}>
                                  <span style={{color: d.costo_delta > 0 ? '#dc2626' : d.costo_delta < 0 ? '#16a34a' : 'var(--gray-400)'}}>
                                    {formatDelta(d.costo_delta, 0, '', true)}
                                  </span>
                                </td>
                                <td style={{textAlign:'right'}}>
                                  <span style={{color: d.km_delta > 0 ? '#dc2626' : d.km_delta < 0 ? '#16a34a' : 'var(--gray-400)'}}>
                                    {formatDelta(d.km_delta, 0, ' km', false)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────── */
export default function Reports() {
  const [selected, setSelected] = useState(null);
  const [from, setFrom]         = useState('');
  const [to, setTo]             = useState('');
  const [loading, setLoading]   = useState(false);
  const [data, setData]         = useState(null);
  const [error, setError]       = useState('');
  const [areaId, setAreaId]     = useState('');
  const [areas, setAreas]       = useState([]);
  const [fuelType, setFuelType] = useState('');
  const [fuelTypes, setFuelTypes] = useState([]);

  useEffect(() => {
    axios.get('/fuel-control/backend/api/areas.php').then(r => setAreas(r.data));
    axios.get('/fuel-control/backend/api/fuel_types.php').then(r => setFuelTypes(r.data));
  }, []);

  const run = async () => {
    if (!selected) return;
    setLoading(true); setError(''); setData(null);
    try {
      const params = { type: selected };
      if (from) params.from = from;
      if (to)   params.to   = to;
      if (areaId) params.area_id = areaId;
      if (selected === 'fuel_by_vehicle' && fuelType) params.fuel_type = fuelType;
      const r = await axios.get('/fuel-control/backend/api/reports.php', { params });
      // El backend ahora devuelve { data, min_date, max_date }
      setData(r.data);
    } catch (e) {
      setError(e.response?.data?.error ?? 'Error al obtener datos');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!data || !selected) return;
    // Pasar fechas reales del backend cuando el usuario no filtró
    const rows    = data.data ?? data;
    const minDate = data.min_date ?? null;
    const maxDate = data.max_date ?? null;
    PRINT_FNS[selected](rows, from, to, minDate, maxDate);
  };

  const rpt = REPORT_TYPES.find(r => r.id === selected);

  function renderPreview() {
    if (!data) return null;
    const rows = data.data ?? data;
    if (selected === 'fuel_by_vehicle') return <PreviewFuelByVehicle data={rows} />;
    if (selected === 'km_ranking')      return <PreviewKmRanking data={rows} />;
    if (selected === 'efficiency') return (
      <PreviewGeneric data={rows} columns={[
        { key:'name', label:'Vehículo', render:r=><strong>{r.name}</strong> },
        { key:'plate', label:'Patente' },
        { key:'km_l_teorico', label:'Km/L Teórico', right:true, render:r=>r.km_l_teorico ? fmt(r.km_l_teorico,2) : '—' },
        { key:'km_l_real', label:'Km/L Real', right:true, render:r=>r.km_l_real ? fmt(r.km_l_real,2) : '—' },
        { key:'total_km', label:'Total Km', right:true, render:r=>fmt(r.total_km,0)+' km' },
        { key:'total_litros', label:'Total L', right:true, render:r=>fmt(r.total_litros, 2)+' L' },
        { key:'costo_x_km', label:'$/Km', right:true, render:r=>r.costo_x_km?fmtPeso(r.costo_x_km):'—' },
      ]} />
    );
    if (selected === 'monthly_summary') return <PreviewMonthlySummary data={rows} />;
    if (selected === 'monthly_comparison') return <PreviewMonthlyComparison data={rows} />;
    if (selected === 'by_fuel_type') {
      const totLit = rows.reduce((a,r)=>a+ +r.total_litros,0);
      return (
        <PreviewGeneric data={rows} columns={[
          { key:'fuel_type', label:'Tipo', render:r=><strong>{r.fuel_type}</strong> },
          { key:'num_cargas', label:'Cargas', right:true, render:r=>fmt(r.num_cargas) },
          { key:'vehiculos', label:'Vehículos', right:true, render:r=>fmt(r.vehiculos) },
          { key:'total_litros', label:'Total Litros', right:true, render:r=>fmt(r.total_litros, 2)+' L' },
          { key:'pct', label:'% Total', right:true, render:r=>fmt((r.total_litros/totLit)*100,1)+'%' },
          { key:'total_costo', label:'Costo Total', right:true, render:r=>fmtPeso(r.total_costo) },
        ]} />
      );
    }
    if (selected === 'km_desde_carga') return <PreviewKmDesdeCarga data={rows} />;
    if (selected === 'by_supplier') {
      const totLit = rows.reduce((a,r)=>a+ +r.total_litros,0);
      return (
        <PreviewGeneric data={rows} columns={[
          { key:'proveedor', label:'Proveedor', render:r=><strong>{r.proveedor}</strong> },
          { key:'num_cargas', label:'Cargas', right:true, render:r=>fmt(r.num_cargas) },
          { key:'vehiculos', label:'Vehículos', right:true, render:r=>fmt(r.vehiculos) },
          { key:'total_litros', label:'Total Litros', right:true, render:r=>fmt(r.total_litros, 2)+' L' },
          { key:'pct', label:'% Total', right:true, render:r=>fmt((r.total_litros/totLit)*100,1)+'%' },
          { key:'total_costo', label:'Costo Total', right:true, render:r=>fmtPeso(r.total_costo) },
        ]} />
      );
    }
    return null;
  }

  return (
    <div>
      {/* Report selector */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12, marginBottom:24 }}>
        {REPORT_TYPES.map(r => (
          <button
            key={r.id}
            onClick={() => { setSelected(r.id); setData(null); setError(''); }}
            style={{
              textAlign:'left', padding:'14px 16px', borderRadius:8, cursor:'pointer',
              border: selected===r.id ? '2px solid var(--primary)' : '2px solid var(--border)',
              background: selected===r.id ? 'var(--primary-50,#eff6ff)' : 'var(--card-bg)',
              transition:'all .15s',
            }}
          >
            <div style={{fontSize:24, marginBottom:6}}>{r.icon}</div>
            <div style={{fontWeight:700, fontSize:'.9rem', marginBottom:4}}>{r.label}</div>
            <div style={{fontSize:'.75rem', color:'var(--gray-500)', lineHeight:1.3}}>{r.desc}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      {selected && (
        <div className="card" style={{marginBottom:16}}>
          <div style={{display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap', padding:'4px 0'}}>
            {selected !== 'km_desde_carga' && (
              <div className="form-group" style={{marginBottom:0}}>
                <label className="form-label">Desde</label>
                <input type="date" className="form-input" value={from} onChange={e=>setFrom(e.target.value)} style={{width:160}} />
              </div>
            )}
            <div className="form-group" style={{marginBottom:0}}>
              <label className="form-label">{selected === 'km_desde_carga' ? 'Hasta (día del corte)' : 'Hasta'}</label>
              <input type="date" className="form-input" value={to} onChange={e=>setTo(e.target.value)} style={{width:160}} />
            </div>
            <div className="form-group" style={{marginBottom:0}}>
              <label className="form-label">Área</label>
              <select className="form-input" value={areaId} onChange={e=>setAreaId(e.target.value)} style={{width:200}}>
                <option value="">Todas las áreas</option>
                {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            {selected === 'fuel_by_vehicle' && (
              <div className="form-group" style={{marginBottom:0}}>
                <label className="form-label">Combustible</label>
                <select className="form-input" value={fuelType} onChange={e=>setFuelType(e.target.value)} style={{width:180}}>
                  <option value="">Todos los tipos</option>
                  {fuelTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              </div>
            )}
            <button className="btn btn-primary" onClick={run} disabled={loading} style={{height:38}}>
              {loading ? 'Cargando...' : '▶ Generar reporte'}
            </button>
            {data && (
              <button className="btn btn-ghost" onClick={handlePrint} style={{height:38}}>
                🖨️ Imprimir / PDF
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Preview */}
      {data && (
        <div className="card">
          {(() => {
            const rows = data.data ?? data;
            const minDate = data.min_date ?? null;
            const maxDate = data.max_date ?? null;
            const f = from ? fmtDate(from) : fmtDate(minDate);
            const t = to   ? fmtDate(to)   : fmtDate(maxDate);
            const periodLabel = f && t ? `${f} al ${t}` : f ? `Desde ${f}` : t ? `Hasta ${t}` : 'Todos los registros';
            return <>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
                <h2 style={{fontSize:'1rem', fontWeight:700}}>
                  {rpt?.icon} {rpt?.label}
                  <span style={{fontWeight:400, fontSize:'.85rem', color:'var(--gray-500)', marginLeft:8}}>
                    {periodLabel}
                  </span>
                </h2>
                <span style={{fontSize:'.8rem', color:'var(--gray-500)'}}>
                  {rows.length} {rows.length===1?'resultado':'resultados'}
                </span>
              </div>
              {rows.length === 0
                ? <p style={{color:'var(--gray-500)', textAlign:'center', padding:32}}>Sin datos para el período seleccionado</p>
                : renderPreview()
              }
            </>;
          })()}
        </div>
      )}
    </div>
  );
}
