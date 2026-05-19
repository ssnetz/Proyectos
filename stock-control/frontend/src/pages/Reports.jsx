import { useState, useEffect, useRef } from 'react';
import { useLocations, useCategories } from '../hooks/useApi';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import axios from 'axios';

const api = axios.create({ baseURL: '/stock-control/api' });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sc_token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

const REPORTS = [
  { key: 'stock_consolidado',  label: 'Stock Consolidado',        icon: '📦', desc: 'Stock total de todos los medicamentos e insumos.' },
  { key: 'stock_por_sector',   label: 'Stock por Sector',         icon: '🏥', desc: 'Desglose de stock por farmacia, guardia y dispensarios.' },
  { key: 'stock_bajo',         label: 'Stock Bajo',               icon: '⚠️', desc: 'Medicamentos con stock total igual o por debajo del mínimo.' },
  { key: 'movimientos',        label: 'Historial de Movimientos', icon: '↕️', desc: 'Entradas, salidas y transferencias en un período.' },
  { key: 'proximos_a_vencer',  label: 'Próximos a Vencer',        icon: '🗓️', desc: 'Lotes con fecha de vencimiento en el rango seleccionado.' },
];

const TYPE_COLORS = {
  entrada:       [22, 163, 74],
  salida:        [220, 38, 38],
  transferencia: [37, 99, 235],
  ajuste:        [107, 114, 128],
};

export default function Reports() {
  const locationsApi  = useLocations();
  const categoriesApi = useCategories();

  const [locations,   setLocations]   = useState([]);
  const [categories,  setCategories]  = useState([]);
  const [reportType,  setReportType]  = useState('stock_consolidado');
  const [locationId,  setLocationId]  = useState('');
  const [categoryId,  setCategoryId]  = useState('');
  const [dateFrom,    setDateFrom]    = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [dateTo,      setDateTo]      = useState(() => new Date().toISOString().slice(0, 10));
  const [reportData,  setReportData]  = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const tableRef = useRef(null);

  useEffect(() => {
    Promise.all([locationsApi.list(), categoriesApi.list()])
      .then(([locs, cats]) => { setLocations(locs.data); setCategories(cats.data); });
  }, []);

  const buildParams = () => {
    const p = { type: reportType };
    if (locationId) p.location_id = locationId;
    if (categoryId) p.category_id = categoryId;
    if (reportType === 'movimientos' || reportType === 'proximos_a_vencer') {
      p.from = dateFrom;
      p.to   = dateTo;
    }
    return p;
  };

  const generate = async () => {
    setLoading(true);
    setError('');
    setReportData(null);
    try {
      const res = await api.get('/reports.php', { params: buildParams() });
      setReportData(res.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Error al generar el reporte');
    } finally {
      setLoading(false);
    }
  };

  const loadLogoBase64 = () =>
    fetch('/stock-control/logo-municipalidad.png')
      .then((r) => { if (!r.ok) throw new Error('no logo'); return r.blob(); })
      .then((blob) => new Promise((res) => {
        const reader = new FileReader();
        reader.onloadend = () => res(reader.result);
        reader.readAsDataURL(blob);
      }))
      .catch(() => null);

  const exportPDF = async () => {
    if (!reportData) return;
    const doc  = new jsPDF({ orientation: reportData.columns.length > 7 ? 'landscape' : 'portrait' });
    const pageW = doc.internal.pageSize.getWidth();

    const logoB64  = await loadLogoBase64();
    const tableTop = logoB64 ? 38 : 36;

    // Encabezado con logo
    if (logoB64) {
      doc.addImage(logoB64, 'PNG', 14, 5, 85, 13);
    } else {
      doc.setFontSize(14);
      doc.setTextColor(30, 64, 175);
      doc.text('Municipalidad de la Ciudad de Cosquín', 14, 13);
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text('Hospital Dr. Armando Cima · Farmacia', 14, 19);
    }

    // Línea divisoria
    doc.setDrawColor(30, 64, 175);
    doc.setLineWidth(0.5);
    doc.line(14, 21, pageW - 14, 21);

    // Título del reporte
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text(reportData.title, 14, 28);
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(`Generado: ${reportData.generated}`, 14, 34);

    // Colorear columna tipo en movimientos
    const isMovimientos = reportType === 'movimientos';

    autoTable(doc, {
      startY: tableTop,
      head: [reportData.columns],
      body: reportData.rows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 255] },
      didParseCell: (data) => {
        if (isMovimientos && data.section === 'body' && data.column.index === 3) {
          const tipo = String(data.cell.raw).toLowerCase();
          const color = TYPE_COLORS[tipo];
          if (color) { data.cell.styles.textColor = color; data.cell.styles.fontStyle = 'bold'; }
        }
        // Stock bajo → rojo
        if (reportType === 'stock_bajo' && data.section === 'body' && data.column.index === 5) {
          data.cell.styles.textColor = data.cell.raw === 'Sin stock' ? [220, 38, 38] : [202, 138, 4];
          data.cell.styles.fontStyle = 'bold';
        }
        // Stock 0 → rojo en stock consolidado
        if (['stock_consolidado','stock_por_sector'].includes(reportType) && data.section === 'body' && data.column.index === 4) {
          if (parseInt(data.cell.raw) === 0) data.cell.styles.textColor = [220, 38, 38];
          else if (parseInt(data.cell.raw) <= parseInt(data.row.raw[5])) data.cell.styles.textColor = [202, 138, 4];
        }
        // Próximos a vencer: Vencimiento (col 5) y Días restantes (col 7)
        if (reportType === 'proximos_a_vencer' && data.section === 'body' && (data.column.index === 5 || data.column.index === 7)) {
          const days = parseInt(data.row.raw[7]);
          const color = days < 0 ? [220, 38, 38] : days <= 30 ? [220, 38, 38] : days <= 90 ? [202, 138, 4] : [22, 163, 74];
          data.cell.styles.textColor = color;
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    // Pie
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.getWidth() - 30, doc.internal.pageSize.getHeight() - 8);
    }

    doc.save(`reporte_${reportType}_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const print = () => {
    if (!tableRef.current) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>${reportData?.title}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 10mm; }
        .print-header { display: flex; align-items: center; gap: 16px; padding-bottom: 10px; border-bottom: 2px solid #1e40af; margin-bottom: 10px; }
        .print-header img { height: 40px; width: auto; }
        .print-header-text h2 { color: #1e40af; font-size: 13px; margin: 0 0 2px; }
        .print-header-text p { color: #888; font-size: 9px; margin: 0; }
        h3 { margin: 0 0 4px; font-size: 12px; }
        .print-meta { color: #888; font-size: 9px; margin: 0 0 10px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #1e40af; color: #fff; padding: 5px 8px; text-align: left; font-size: 10px; }
        td { padding: 4px 8px; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
        tr:nth-child(even) td { background: #f5f7ff; }
      </style></head><body>
      <div class="print-header">
        <img src="/stock-control/logo-municipalidad.png" alt="Municipalidad de Cosquín"
             onerror="this.style.display='none';this.nextSibling.style.display='block'"/>
        <span style="display:none;font-weight:700;color:#1e40af;font-size:13px">Municipalidad de la Ciudad de Cosquín</span>
        <div class="print-header-text">
          <h2>Hospital Dr. Armando Cima · Farmacia</h2>
          <p>Sistema de Control de Stock</p>
        </div>
      </div>
      <h3>${reportData?.title}</h3>
      <p class="print-meta">Generado: ${reportData?.generated}</p>
      ${tableRef.current.outerHTML}
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const exportCSV = () => {
    if (!reportData) return;
    const lines = [reportData.columns.join(';'), ...reportData.rows.map((r) => r.join(';'))];
    const blob  = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href = url; a.download = `${reportType}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const current = REPORTS.find((r) => r.key === reportType);

  return (
    <div>
      {/* ── Selector de reporte ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          {REPORTS.map((r) => (
            <button
              key={r.key}
              className={`btn ${reportType === r.key ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: '1 1 180px' }}
              onClick={() => {
                setReportType(r.key);
                setReportData(null);
                if (r.key === 'proximos_a_vencer') {
                  setDateFrom(new Date().toISOString().slice(0, 10));
                  setDateTo(new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10));
                }
              }}
            >
              {r.icon} {r.label}
            </button>
          ))}
        </div>

        {current && (
          <p style={{ fontSize: '.85rem', color: 'var(--gray-400)', margin: '0 0 16px' }}>
            {current.desc}
          </p>
        )}

        {/* ── Filtros ── */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Ubicación: no aplica a stock_por_sector ni stock_bajo */}
          {reportType !== 'stock_por_sector' && reportType !== 'stock_bajo' && reportType !== 'movimientos' && (
            <div className="form-group" style={{ margin: 0, flex: '0 0 200px' }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Ubicación</label>
              <select className="form-control" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                <option value="">Todas</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}
          {/* Categoría: no aplica a movimientos */}
          {reportType !== 'movimientos' && (
            <div className="form-group" style={{ margin: 0, flex: '0 0 200px' }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Categoría</label>
              <select className="form-control" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Todas</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          {/* Rango de fechas: movimientos y próximos a vencer */}
          {(reportType === 'movimientos' || reportType === 'proximos_a_vencer') && (
            <>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ marginBottom: 4 }}>
                  {reportType === 'proximos_a_vencer' ? 'Vence desde' : 'Desde'}
                </label>
                <input type="date" className="form-control" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ marginBottom: 4 }}>
                  {reportType === 'proximos_a_vencer' ? 'Vence hasta' : 'Hasta'}
                </label>
                <input type="date" className="form-control" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0, flex: '0 0 200px' }}>
                <label className="form-label" style={{ marginBottom: 4 }}>Ubicación</label>
                <select className="form-control" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                  <option value="">Todas</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </>
          )}
          <button className="btn btn-primary" onClick={generate} disabled={loading} style={{ alignSelf: 'flex-end' }}>
            {loading ? 'Generando...' : '🔍 Generar reporte'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* ── Resultado ── */}
      {reportData && (
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div>
              <span className="card-title">{reportData.title}</span>
              <span style={{ marginLeft: 12, fontSize: '.8rem', color: 'var(--gray-500)' }}>
                {reportData.rows.length} registros · {reportData.generated}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={print} title="Imprimir">🖨 Imprimir</button>
              <button className="btn btn-ghost btn-sm" onClick={exportCSV} title="Exportar CSV">📊 CSV</button>
              <button className="btn btn-primary btn-sm" onClick={exportPDF} title="Exportar PDF">📄 PDF</button>
            </div>
          </div>

          {reportData.rows.length === 0 ? (
            <div className="empty"><div className="empty-icon">📋</div><p>Sin datos para este reporte</p></div>
          ) : (
            <div className="table-wrap">
              <table ref={tableRef}>
                <thead>
                  <tr>{reportData.columns.map((c, i) => <th key={i}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {reportData.rows.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => {
                        let style = { fontSize: '.82rem' };
                        // Colorear tipo en movimientos
                        if (reportType === 'movimientos' && ci === 3) {
                          const color = { entrada: 'var(--success)', salida: 'var(--danger)', transferencia: 'var(--primary)', ajuste: 'var(--gray-400)' }[String(cell).toLowerCase()];
                          if (color) style = { ...style, color, fontWeight: 600 };
                        }
                        // Stock 0 → rojo
                        if (['stock_consolidado','stock_por_sector'].includes(reportType) && ci === 4) {
                          if (parseInt(cell) === 0) style = { ...style, color: 'var(--danger)', fontWeight: 600 };
                          else if (parseInt(cell) <= parseInt(row[5])) style = { ...style, color: 'var(--warning)', fontWeight: 600 };
                        }
                        // Próximos a vencer: columna Vencimiento (5) y Días restantes (7)
                        if (reportType === 'proximos_a_vencer') {
                          const days = parseInt(row[7]);
                          if (ci === 5 || ci === 7) {
                            const c = days < 0 ? 'var(--danger)' : days <= 30 ? 'var(--danger)' : days <= 90 ? 'var(--warning)' : 'var(--success)';
                            style = { ...style, color: c, fontWeight: 600 };
                          }
                        }
                        return <td key={ci} style={style}>{cell}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
