import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const fmt = (n) => Number(n ?? 0).toLocaleString('es', { minimumFractionDigits: 2 });

function parseEstadistico(workbook) {
  const ws = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Find date range row (contains 'Fecha de Inicio')
  let importDate = '';
  for (const row of rows) {
    const flat = row.map(c => String(c));
    const idx = flat.findIndex(c => c.includes('Fecha de Inicio') || c.includes('Inicio'));
    if (idx >= 0) {
      // Next row has the actual dates
      const dateRowIdx = rows.indexOf(row) + 1;
      const dateRow = rows[dateRowIdx] || [];
      // Date is like "26/06/2026 00:00:00"
      const dateStr = String(dateRow[3] || dateRow[0] || '');
      const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (match) importDate = `${match[3]}-${match[2]}-${match[1]}`;
      break;
    }
  }

  // Find header row with 'Vehículo'
  let dataStartRow = -1;
  let colMap = {};
  for (let i = 0; i < rows.length; i++) {
    const flat = rows[i].map(c => String(c).toLowerCase());
    if (flat.some(c => c.includes('veh'))) {
      // Find sub-header row for column positions
      const subRow = rows[i + 1] || [];
      // Main row
      const mainRow = rows[i];
      // Build column mapping by scanning both header rows
      for (let c = 0; c < mainRow.length; c++) {
        const h = String(mainRow[c]).toLowerCase();
        const s = String(subRow[c]).toLowerCase();
        if (h.includes('veh')) colMap.vehicle = c;
        if (h.includes('km')) colMap.km = c;
        if (h.includes('total evento')) colMap.eventos = c + 1;
        if (s === 'máx.' && colMap.vel_max === undefined) colMap.vel_max = c;
        if (s === 'prom.' && colMap.vel_prom === undefined) colMap.vel_prom = c;
        if (h.includes('marcha') && s === '') colMap.t_marcha = c;
        if (h.includes('ralentí') && s === '') colMap.t_ralenti = c;
        if (h.includes('detenido') && s === '') colMap.t_detenido = c;
        if (h.includes('inicio') && s === '') colMap.ub_inicio = c;
        if (h.includes('fin') && s === '') colMap.ub_fin = c;
      }
      dataStartRow = i + 2;
      break;
    }
  }

  if (dataStartRow < 0) return [];

  const parsed = [];
  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    const vehicleRaw = String(row[colMap.vehicle] ?? '').trim();
    if (!vehicleRaw) continue;

    // Parse "Toyota HILUX - AC881HJ" → name + plate
    const parts = vehicleRaw.split(' - ');
    const plate = parts.length > 1 ? parts[parts.length - 1].trim() : '';
    const name  = parts.length > 1 ? parts.slice(0, -1).join(' - ').trim() : vehicleRaw;

    // km may be in colMap.km or next cell
    const kmRaw = String(row[colMap.km] ?? row[(colMap.km ?? 0) + 1] ?? '0')
      .replace('.', '').replace(',', '.');

    parsed.push({
      import_date:      importDate,
      vehicle_name:     name,
      plate,
      km_recorridos:    kmRaw,
      vel_max:          String(row[colMap.vel_max]  ?? '').replace(',', '.'),
      vel_prom:         String(row[colMap.vel_prom] ?? '').replace(',', '.'),
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
        const wb = XLSX.read(ev.target.result, { type: 'array', cellDates: true });
        const rows = parseEstadistico(wb);
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
                <span style={{ color: 'var(--gray-500)' }}>Cambiar fecha a todos:</span>
                <input type="date" className="form-input form-input-sm"
                  style={{ width: 160 }}
                  onChange={e => {
                    if (!e.target.value) return;
                    setPreview(prev => prev.map(r => ({ ...r, import_date: e.target.value })));
                  }} />
              </div>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha del día <span style={{ color: 'var(--blue-500)', fontSize: 11 }}>✎ editable</span></th>
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
                          type="date"
                          className="form-input form-input-sm"
                          style={{ width: 150 }}
                          value={r.import_date}
                          onChange={e => setPreview(prev =>
                            prev.map((row, idx) => idx === i ? { ...row, import_date: e.target.value } : row)
                          )}
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
