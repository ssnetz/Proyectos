import { useState, useEffect } from 'react';
import { useReportes, useMedicamentos } from '../hooks/useApi';

function exportPDF(data, tab, tabLabel, filters) {
  if (!data || data.length === 0) return;

  const fmtDate = (d) => d ? new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  const fmtDay  = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-AR') : '—';

  const HEADERS = {
    stock:        ['Código','Medicamento','Acción terapéutica','Categoría','Stock','Stock mín.','Unidad','$ Compra','Valor stock'],
    vencimientos: ['Medicamento','N° Lote','Vencimiento','Cantidad','Ubicación','Días restantes'],
    dispensas:    ['Referencia','Fecha','Paciente','Documento','Ítems','Unidades','Operador','Observaciones'],
    movimientos:  ['Fecha','Medicamento','Tipo','Cantidad','Stock ant.','Stock nuevo','Motivo','Operador'],
  };

  const buildRow = (d) => {
    if (tab === 'stock') return [d.code, d.name, d.therapeutic_action||'—', d.category_name||'—', d.stock, d.min_stock, d.unit, `$${Number(d.purchase_price).toLocaleString('es-AR')}`, `$${Number(d.stock_value).toLocaleString('es-AR')}`];
    if (tab === 'vencimientos') return [d.product_name, d.lot_number, fmtDay(d.expiry_date), `${d.quantity} ${d.unit}`, d.location_name||'—', Number(d.days_left) < 0 ? `Vencido hace ${Math.abs(Number(d.days_left))} días` : `${d.days_left} días`];
    if (tab === 'dispensas') return [d.reference, fmtDate(d.fecha), `${d.apellido}, ${d.nombre}`, d.documento, d.total_items, d.total_unidades, d.operador||'—', d.observaciones||'—'];
    if (tab === 'movimientos') return [fmtDate(d.created_at), d.product_name, d.type, d.quantity, d.previous_stock, d.new_stock, d.reason||'—', d.user||'—'];
    return [];
  };

  const headers = HEADERS[tab] || [];
  const rows    = data.map(buildRow);

  const thCells = headers.map((h) => `<th>${h}</th>`).join('');
  const trRows  = rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>Reporte ${tabLabel}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:10px;margin:16px}
  h2{font-size:14px;margin:0 0 2px}
  .sub{color:#666;font-size:9px;margin-bottom:12px}
  table{width:100%;border-collapse:collapse}
  th{background:#e5e7eb;padding:5px 7px;text-align:left;border:1px solid #ccc;font-size:9px}
  td{padding:4px 7px;border:1px solid #ddd;vertical-align:top}
  tr:nth-child(even){background:#f9fafb}
  .foot{color:#999;font-size:9px;margin-top:8px}
  @page{margin:15mm}
</style></head><body>
<h2>Farmacia — Reporte ${tabLabel}</h2>
<p class="sub">${filters || ''} &nbsp;·&nbsp; Generado: ${new Date().toLocaleString('es-AR')} &nbsp;·&nbsp; ${data.length} registros</p>
<table><thead><tr>${thCells}</tr></thead><tbody>${trRows}</tbody></table>
</body></html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

function exportCSV(data, filename) {
  if (!data || data.length === 0) return;
  const keys = Object.keys(data[0]);
  const header = keys.join(',');
  const rows = data.map((row) =>
    keys.map((k) => {
      const val = row[k] ?? '';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }).join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reportes() {
  const reportesApi = useReportes();
  const medApi      = useMedicamentos();

  const [tab, setTab]           = useState('stock');
  const [data, setData]         = useState([]);
  const [medicamentos, setMedicamentos] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // Filters per tab
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + '01';
  const [days, setDays]         = useState(30);
  const [from, setFrom]         = useState(firstOfMonth);
  const [to, setTo]             = useState(today);
  const [prodId, setProdId]     = useState('');

  useEffect(() => {
    medApi.list({ active: '1' }).then((r) => setMedicamentos(r.data)).catch(() => {});
  }, []);

  const loadReport = () => {
    setLoading(true); setError('');
    const params = { type: tab };
    if (tab === 'vencimientos') params.days = days;
    if (tab === 'dispensas' || tab === 'movimientos') { params.from = from; params.to = to; }
    if (tab === 'movimientos' && prodId) params.product_id = prodId;
    reportesApi.get(params)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error || 'Error al cargar reporte'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadReport(); }, [tab]);

  const TABS = [
    { id: 'stock',        label: '📦 Stock actual' },
    { id: 'vencimientos', label: '⏰ Vencimientos' },
    { id: 'dispensas',    label: '💊 Dispensas' },
    { id: 'movimientos',  label: '↕️ Movimientos' },
  ];

  const renderFilters = () => (
    <div className="filters" style={{ marginBottom: 16 }}>
      {tab === 'vencimientos' && (
        <>
          <label className="form-label" style={{ margin: 0 }}>Días:</label>
          <input type="number" className="form-control" style={{ width: 90 }}
            value={days} onChange={(e) => setDays(e.target.value)} min="1" />
        </>
      )}
      {(tab === 'dispensas' || tab === 'movimientos') && (
        <>
          <label className="form-label" style={{ margin: 0 }}>Desde:</label>
          <input type="date" className="form-control" style={{ width: 155 }}
            value={from} onChange={(e) => setFrom(e.target.value)} />
          <label className="form-label" style={{ margin: 0 }}>Hasta:</label>
          <input type="date" className="form-control" style={{ width: 155 }}
            value={to} onChange={(e) => setTo(e.target.value)} />
        </>
      )}
      {tab === 'movimientos' && (
        <select className="form-control" style={{ width: 200 }}
          value={prodId} onChange={(e) => setProdId(e.target.value)}>
          <option value="">Todos los medicamentos</option>
          {medicamentos.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      )}
      <button className="btn btn-primary btn-sm" onClick={loadReport}>Generar</button>
      <button className="btn btn-ghost btn-sm" onClick={() => exportCSV(data, `reporte-${tab}-${today}.csv`)}>
        CSV
      </button>
      <button className="btn btn-ghost btn-sm" onClick={() => {
        const tabLabel = TABS.find(t => t.id === tab)?.label || tab;
        const filterDesc = tab === 'vencimientos' ? `Próximos ${days} días`
          : (tab === 'dispensas' || tab === 'movimientos') ? `${from} al ${to}`
          : '';
        exportPDF(data, tab, tabLabel, filterDesc);
      }}>
        PDF
      </button>
    </div>
  );

  const renderStock = () => (
    <table>
      <thead>
        <tr>
          <th>Código</th><th>Medicamento</th><th>Acción terapéutica</th>
          <th>Categoría</th><th>Stock</th><th>Stock mín.</th><th>Unidad</th>
          <th>Precio compra</th><th>Valor stock</th>
        </tr>
      </thead>
      <tbody>
        {data.map((p) => (
          <tr key={p.id}>
            <td><code style={{ fontSize: '.8rem' }}>{p.code}</code></td>
            <td>{p.name}</td>
            <td>{p.therapeutic_action || '—'}</td>
            <td>{p.category_name || '—'}</td>
            <td style={{ color: p.stock === 0 ? 'var(--danger)' : Number(p.stock) <= Number(p.min_stock) ? 'var(--warning)' : 'inherit', fontWeight: 600 }}>
              {p.stock}
            </td>
            <td>{p.min_stock}</td>
            <td>{p.unit}</td>
            <td>${Number(p.purchase_price).toLocaleString('es-AR')}</td>
            <td>${Number(p.stock_value).toLocaleString('es-AR')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderVencimientos = () => (
    <table>
      <thead>
        <tr>
          <th>Medicamento</th><th>N° Lote</th><th>Vencimiento</th>
          <th>Cantidad</th><th>Ubicación</th><th>Días restantes</th>
        </tr>
      </thead>
      <tbody>
        {data.map((l) => (
          <tr key={l.id}>
            <td>{l.product_name}</td>
            <td><code>{l.lot_number}</code></td>
            <td>{new Date(l.expiry_date + 'T00:00:00').toLocaleDateString('es-AR')}</td>
            <td>{l.quantity} {l.unit}</td>
            <td>{l.location_name || '—'}</td>
            <td style={{ color: Number(l.days_left) < 0 ? 'var(--danger)' : Number(l.days_left) <= 7 ? 'var(--danger)' : 'var(--warning)', fontWeight: 600 }}>
              {Number(l.days_left) < 0 ? `Vencido hace ${Math.abs(Number(l.days_left))} días` : `${l.days_left} días`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderDispensas = () => (
    <table>
      <thead>
        <tr>
          <th>Referencia</th><th>Fecha</th><th>Paciente</th><th>Documento</th>
          <th>Ítems</th><th>Unidades</th><th>Operador</th><th>Observaciones</th>
        </tr>
      </thead>
      <tbody>
        {data.map((d) => (
          <tr key={d.reference}>
            <td><code style={{ fontSize: '.8rem' }}>{d.reference}</code></td>
            <td style={{ fontSize: '.8rem' }}>{new Date(d.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
            <td>{d.apellido}, {d.nombre}</td>
            <td>{d.documento}</td>
            <td>{d.total_items}</td>
            <td>{d.total_unidades}</td>
            <td>{d.operador || '—'}</td>
            <td>{d.observaciones || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderMovimientos = () => (
    <table>
      <thead>
        <tr>
          <th>Fecha</th><th>Medicamento</th><th>Tipo</th><th>Cantidad</th>
          <th>Stock anterior</th><th>Stock nuevo</th><th>Motivo</th><th>Operador</th>
        </tr>
      </thead>
      <tbody>
        {data.map((m) => (
          <tr key={m.id}>
            <td style={{ fontSize: '.8rem' }}>{new Date(m.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
            <td>{m.product_name}</td>
            <td><span className={m.type === 'entrada' ? 'mov-entrada' : m.type === 'salida' ? 'mov-salida' : 'mov-ajuste'}>{m.type}</span></td>
            <td>{m.quantity}</td>
            <td>{m.previous_stock}</td>
            <td>{m.new_stock}</td>
            <td>{m.reason || '—'}</td>
            <td>{m.user || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderTable = () => {
    if (loading) return <div className="spinner" />;
    if (data.length === 0) return <div className="empty"><div className="empty-icon">📈</div><p>Sin datos para los filtros seleccionados</p></div>;
    return (
      <div className="table-wrap">
        {tab === 'stock'        && renderStock()}
        {tab === 'vencimientos' && renderVencimientos()}
        {tab === 'dispensas'    && renderDispensas()}
        {tab === 'movimientos'  && renderMovimientos()}
      </div>
    );
  };

  return (
    <div>
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--gray-200)', paddingBottom: 12, marginBottom: 16 }}>
          {TABS.map((t) => (
            <button key={t.id} type="button"
              className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        {renderFilters()}
        {renderTable()}
        {!loading && data.length > 0 && (
          <p style={{ marginTop: 12, color: 'var(--gray-400)', fontSize: '.8rem' }}>
            {data.length} registros
          </p>
        )}
      </div>
    </div>
  );
}
