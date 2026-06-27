import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const fmt = (n) => Number(n ?? 0).toLocaleString('es', { minimumFractionDigits: 2 });

// Convierte cualquier valor de celda de fecha a "YYYY-MM-DD"
function toIsoDate(val) {
  if (!val) return '';
  // Objeto Date de JS
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  // String "26/06/2026 ..." o "26/06/2026"
  const s = String(val);
  const m1 = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
  // String "2026-06-26 ..." o ISO
  const m2 = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  // Número serial de Excel (días desde 1900-01-01)
  if (!isNaN(val)) {
    const d = new Date(Math.round((Number(val) - 25569) * 86400 * 1000));
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const da = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${mo}-${da}`;
  }
  return '';
}

// Detecta si el Excel es formato flota (fechas como columnas, vehículos como filas)
function isFlotaFormat(rows) {
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const r = rows[i];
    if (String(r[1]).toLowerCase().includes('fecha') && String(r[2]).match(/\d{2}\/\d{2}\/\d{2}/)) return true;
  }
  return false;
}

function parseFlota(workbook) {
  const ws = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

  // Encontrar la fila de fechas (col 1 = "Fecha", col 2+ = dd/mm/yy)
  let dateRowIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][1]).toLowerCase().includes('fecha') && String(rows[i][2]).match(/\d{2}\/\d{2}\/\d{2}/)) {
      dateRowIdx = i; break;
    }
  }
  if (dateRowIdx < 0) return [];

  // Mapear columna → fecha ISO
  const dateRow = rows[dateRowIdx];
  const dateMap = {}; // colIdx → 'YYYY-MM-DD'
  for (let c = 2; c < dateRow.length; c++) {
    const d = toIsoDate(String(dateRow[c]));
    if (d) dateMap[c] = d;
  }
  const dateCols = Object.keys(dateMap).map(Number);
  if (!dateCols.length) return [];

  // Agrupar filas por vehículo
  // Cada vehículo tiene filas: Vel. máx., Vel. prom., Km rec., Tiempo en marcha, Tiempo detenido, Tiempo en ralentí, Total evt., Ubicación inicial, Ubicación final
  const metricMap = {
    'km rec.'         : 'km',
    'vel. máx.'       : 'vel_max',
    'vel. prom.'      : 'vel_prom',
    'tiempo en marcha': 't_marcha',
    'tiempo en ralentí': 't_ralenti',
    'tiempo detenido' : 't_detenido',
    'total evt.'      : 'eventos',
    'ubicación inicial': 'ub_inicio',
    'ubicación final'  : 'ub_fin',
  };

  // vehicle → date → metrics
  const vehicleData = {};
  let currentVehicle = null;

  for (let i = dateRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const col0 = String(row[0]).trim();
    const col1 = String(row[1]).trim().toLowerCase();

    if (col0) currentVehicle = col0;
    if (!currentVehicle || col1 === 'fecha') continue;

    const metricKey = metricMap[col1];
    if (!metricKey) continue;

    if (!vehicleData[currentVehicle]) vehicleData[currentVehicle] = {};

    for (const c of dateCols) {
      const date = dateMap[c];
      if (!vehicleData[currentVehicle][date]) vehicleData[currentVehicle][date] = {};
      const cell = row[c];
      vehicleData[currentVehicle][date][metricKey] = cell;
    }
  }

  // Convertir a array plano de registros por vehículo+día
  const parsed = [];
  for (const [vehicleRaw, dates] of Object.entries(vehicleData)) {
    const parts = vehicleRaw.split(' - ');
    const plate = parts.length > 1 ? parts[parts.length - 1].trim().replace(/\t/g, '') : '';
    const name  = parts.length > 1 ? parts.slice(0, -1).join(' - ').trim() : vehicleRaw;

    for (const [date, m] of Object.entries(dates)) {
      const kmCell = m.km ?? 0;
      const kmStr = typeof kmCell === 'number'
        ? String(kmCell)
        : String(kmCell).replace(/\./g, '').replace(',', '.');
      const km = parseFloat(kmStr) || 0;
      if (km === 0) continue; // omitir días sin actividad

      const toNum = (v) => {
        if (v === undefined || v === '') return '';
        if (typeof v === 'number') return String(v);
        return String(v).replace(',', '.');
      };

      parsed.push({
        import_date:      date,
        vehicle_name:     name,
        plate,
        km_recorridos:    kmStr,
        vel_max:          toNum(m.vel_max),
        vel_prom:         toNum(m.vel_prom),
        total_eventos:    String(m.eventos ?? ''),
        tiempo_marcha:    String(m.t_marcha   ?? ''),
        tiempo_ralenti:   String(m.t_ralenti  ?? ''),
        tiempo_detenido:  String(m.t_detenido ?? ''),
        ubicacion_inicio: String(m.ub_inicio  ?? ''),
        ubicacion_fin:    String(m.ub_fin     ?? ''),
      });
    }
  }
  return parsed;
}

function parseEstadistico(workbook) {
  const ws = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

  // Encontrar la fila de encabezados (contiene 'Vehículo')
  let headerRowIdx = -1;
  let subHeaderRowIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const flat = rows[i].map(c => String(c).toLowerCase());
    if (flat.some(c => c.includes('veh'))) {
      headerRowIdx = i;
      subHeaderRowIdx = i + 1;
      break;
    }
  }
  if (headerRowIdx < 0) return [];

  const mainRow = rows[headerRowIdx];
  const subRow  = rows[subHeaderRowIdx] || [];

  // Mapeo de columnas
  const colMap = {};
  for (let c = 0; c < mainRow.length; c++) {
    const h = String(mainRow[c]).toLowerCase().trim();
    const s = String(subRow[c]).toLowerCase().trim();
    if (h.includes('veh'))           colMap.vehicle    = c;
    if (h === 'fecha')               colMap.fecha      = c;
    if (h.includes('km'))            colMap.km         = c;
    if (h.includes('total evento'))  colMap.eventos    = c + 1;
    if ((s === 'máx.' || s === 'max.') && colMap.vel_max === undefined) colMap.vel_max = c;
    if ((s === 'prom.'|| s === 'avg.') && colMap.vel_prom === undefined) colMap.vel_prom = c;
    if (h.includes('marcha')   && !h.includes('hs')) colMap.t_marcha   = c;
    if (h.includes('ralentí')  || h.includes('ralenti')) colMap.t_ralenti  = c;
    if (h.includes('detenido'))      colMap.t_detenido = c;
    if (h.includes('inicio') && s === '') colMap.ub_inicio = c;
    if (h.includes('fin')    && s === '') colMap.ub_fin    = c;
  }

  const dataStartRow = subHeaderRowIdx + 1;

  // Fecha de respaldo desde el encabezado del reporte (fila con "Fecha de Inicio")
  let fallbackDate = '';
  for (let i = 0; i < headerRowIdx; i++) {
    const flat = rows[i].map(c => String(c));
    if (flat.some(c => c.includes('Fecha de Inicio') || c.includes('Inicio'))) {
      const dateRow = rows[i + 1] || [];
      for (const cell of dateRow) {
        const d = toIsoDate(cell);
        if (d) { fallbackDate = d; break; }
      }
      break;
    }
  }

  const parsed = [];
  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    const vehicleRaw = String(row[colMap.vehicle] ?? '').trim();
    if (!vehicleRaw) continue;

    // Parse "Toyota HILUX - AC881HJ" → name + plate
    const parts = vehicleRaw.split(' - ');
    const plate = parts.length > 1 ? parts[parts.length - 1].trim() : '';
    const name  = parts.length > 1 ? parts.slice(0, -1).join(' - ').trim() : vehicleRaw;

    // Fecha: columna "Fecha" de la fila o fallback del encabezado
    const fechaCell  = colMap.fecha !== undefined ? row[colMap.fecha] : undefined;
    const importDate = toIsoDate(fechaCell) || fallbackDate;

    // km: si ya es número (SheetJS raw) usarlo directo; si es string manejar separadores
    const kmCell = row[colMap.km] ?? 0;
    const kmRaw = typeof kmCell === 'number'
      ? String(kmCell)
      : String(kmCell).replace(/\./g, '').replace(',', '.');

    parsed.push({
      import_date:      importDate,
      vehicle_name:     name,
      plate,
      km_recorridos:    kmRaw,
      vel_max:  typeof row[colMap.vel_max]  === 'number' ? String(row[colMap.vel_max])  : String(row[colMap.vel_max]  ?? '').replace(',', '.'),
      vel_prom: typeof row[colMap.vel_prom] === 'number' ? String(row[colMap.vel_prom]) : String(row[colMap.vel_prom] ?? '').replace(',', '.'),
      total_eventos:    String(row[colMap.eventos]  ?? ''),
      tiempo_marcha:    String(row[colMap.t_marcha]   ?? ''),
      tiempo_ralenti:   String(row[colMap.t_ralenti]  ?? ''),
      tiempo_detenido:  String(row[colMap.t_detenido] ?? ''),
      ubicacion_inicio: String(row[colMap.ub_inicio]  ?? ''),
      ubicacion_fin:    String(row[colMap.ub_fin]     ?? ''),
    });
  }
  return parsed;
}

export default function GpsImport() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const fileRef = useRef();

  const [preview, setPreview]   = useState([]);
  const [fileName, setFileName] = useState('');
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState('');
  const [error, setError]       = useState('');

  const [history, setHistory]   = useState([]);
  const [filters, setFilters]   = useState({ from: '', to: '' });
  const [applied, setApplied]   = useState({ from: '', to: '' });
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = (f = applied) => {
    setLoadingHistory(true);
    const params = {};
    if (f.from) params.from = f.from;
    if (f.to)   params.to   = f.to;
    axios.get('/fuel-control/backend/api/gps_import.php', { params })
      .then(r => { setHistory(r.data); setLoadingHistory(false); })
      .catch(() => setLoadingHistory(false));
  };

  useEffect(() => { loadHistory({ from: '', to: '' }); }, []);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setMsg(''); setError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
        const flota = isFlotaFormat(rawRows);
        const rows = flota ? parseFlota(wb) : parseEstadistico(wb);
        if (rows.length === 0) {
          setError('No se encontraron datos de vehículos. Asegurate de subir el reporte Estadístico de AmericaGIS.');
          setPreview([]);
        } else {
          setPreview(rows);
        }
      } catch (err) {
        setError('Error al leer el archivo: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!preview.length) return;
    setSaving(true); setMsg(''); setError('');
    try {
      const r = await axios.post('/fuel-control/backend/api/gps_import.php', { rows: preview });
      setMsg(`✓ Importados ${r.data.inserted} registros correctamente.`);
      setPreview([]);
      setFileName('');
      if (fileRef.current) fileRef.current.value = '';
      loadHistory(applied);
    } catch (err) {
      setError(err.response?.data?.error ?? 'Error al importar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este registro?')) return;
    await axios.delete(`/fuel-control/backend/api/gps_import.php?id=${id}`);
    loadHistory(applied);
  };

  const handleDeleteAll = async () => {
    if (!confirm('¿Borrar TODOS los registros GPS? Esta acción no se puede deshacer.')) return;
    await axios.delete('/fuel-control/backend/api/gps_import.php');
    loadHistory(applied);
  };

  const handleSearch = () => { setApplied(filters); loadHistory(filters); };
  const handleClear  = () => {
    const e = { from: '', to: '' };
    setFilters(e); setApplied(e); loadHistory(e);
  };

  return (
    <div>
      {/* Upload card */}
      <div className="card" style={{ padding: '24px', marginBottom: 20 }}>
        <h3 style={{ marginBottom: 16, fontWeight: 700 }}>Importar reporte estadístico de AmericaGIS</h3>
        <p style={{ color: 'var(--gray-500)', fontSize: 13, marginBottom: 16 }}>
          Exportá el reporte <strong>Estadístico</strong> desde AmericaGIS (botón "Exportar a XLSX") y subilo acá.
          Se importarán los km recorridos, tiempos y velocidades por vehículo.
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFile}
            className="form-input"
            style={{ maxWidth: 360 }}
          />
          {preview.length > 0 && (
            <button className="btn btn-primary" onClick={handleImport} disabled={saving}>
              {saving ? 'Importando...' : `Confirmar importación (${preview.length} vehículos)`}
            </button>
          )}
        </div>

        {msg   && <div className="alert alert-success" style={{ marginTop: 12 }}>{msg}</div>}
        {error && <div className="alert alert-error"   style={{ marginTop: 12 }}>{error}</div>}

        {/* Preview table */}
        {preview.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h4 style={{ fontWeight: 600 }}>Vista previa — {fileName}</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span style={{ color: 'var(--gray-500)' }}>Cambiar fecha a todos (dd/mm/aaaa):</span>
                <input type="text" className="form-input form-input-sm" placeholder="27/06/2026"
                  style={{ width: 130 }}
                  onBlur={e => {
                    const d = toIsoDate(e.target.value);
                    if (!d) return;
                    setPreview(prev => prev.map(r => ({ ...r, import_date: d })));
                    e.target.value = '';
                  }} />
              </div>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha (dd/mm/aaaa) <span style={{ color: 'var(--blue-500)', fontSize: 11 }}>✎ editable</span></th>
                    <th>Vehículo</th>
                    <th>Patente</th>
                    <th>Km recorridos</th>
                    <th>En marcha</th>
                    <th>Ralentí</th>
                    <th>Vel. máx</th>
                    <th>Vel. prom</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          type="text"
                          className="form-input form-input-sm"
                          style={{ width: 120 }}
                          defaultValue={r.import_date ? r.import_date.split('-').reverse().join('/') : ''}
                          onBlur={e => {
                            const d = toIsoDate(e.target.value) || r.import_date;
                            e.target.value = d ? d.split('-').reverse().join('/') : e.target.value;
                            setPreview(prev =>
                              prev.map((row, idx) => idx === i ? { ...row, import_date: d } : row)
                            );
                          }}
                        />
                      </td>
                      <td><strong>{r.vehicle_name}</strong></td>
                      <td><span className="badge badge-blue">{r.plate}</span></td>
                      <td><strong>{fmt(r.km_recorridos)} km</strong></td>
                      <td>{r.tiempo_marcha   || '—'}</td>
                      <td>{r.tiempo_ralenti  || '—'}</td>
                      <td>{r.vel_max  ? `${r.vel_max} km/h`  : '—'}</td>
                      <td>{r.vel_prom ? `${r.vel_prom} km/h` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--gray-500)' }}>
              💡 Editá la fecha de cada fila si el Excel no la detectó correctamente. La fecha determina qué días aparecen en el selector de km al cargar combustible.
            </div>
          </div>
        )}
      </div>

      {/* History */}
      <div className="page-actions" style={{ marginBottom: 16 }}>
        <div className="filters">
          <input type="date" className="form-input form-input-sm" value={filters.from}
            onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
          <input type="date" className="form-input form-input-sm" value={filters.to}
            onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
          <button className="btn btn-primary btn-sm" onClick={handleSearch}>Buscar</button>
          <button className="btn btn-ghost btn-sm" onClick={handleClear}>Limpiar</button>
          {isAdmin && (
            <button className="btn btn-sm" style={{ background: '#ef4444', color: '#fff', marginLeft: 'auto' }} onClick={handleDeleteAll}>
              Borrar todo
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Vehículo</th>
                <th>Patente</th>
                <th>Km recorridos</th>
                <th>En marcha</th>
                <th>Vel. máx</th>
                <th>Vel. prom</th>
                <th>Ubicación inicio</th>
                <th>Importado por</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {loadingHistory && (
                <tr><td colSpan="10"><div className="spinner" /></td></tr>
              )}
              {!loadingHistory && history.length === 0 && (
                <tr><td colSpan="10" style={{ textAlign: 'center', color: 'var(--gray-500)' }}>Sin importaciones</td></tr>
              )}
              {history.map(r => (
                <tr key={r.id}>
                  <td>{r.import_date}</td>
                  <td><strong>{r.vehicle_name}</strong></td>
                  <td><span className="badge badge-blue">{r.plate}</span></td>
                  <td><strong>{fmt(r.km_recorridos)} km</strong></td>
                  <td>{r.tiempo_marcha || '—'}</td>
                  <td>{r.vel_max  ? `${r.vel_max} km/h`  : '—'}</td>
                  <td>{r.vel_prom ? `${r.vel_prom} km/h` : '—'}</td>
                  <td style={{ fontSize: 12 }}>{r.ubicacion_inicio || '—'}</td>
                  <td>{r.imported_by}</td>
                  {isAdmin && (
                    <td>
                      <button className="btn btn-ghost btn-sm btn-icon" title="Eliminar"
                        onClick={() => handleDelete(r.id)}>🗑</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
