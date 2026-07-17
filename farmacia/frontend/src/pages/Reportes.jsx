import { useState, useEffect } from 'react';
import { useReportes, useMedicamentos } from '../hooks/useApi';
import { exportToCSV } from '../utils/csvExport';
import { printReporte } from '../utils/reportPrint';

const TABS = [
  { id: 'stock', label: '📦 Stock actual' },
  { id: 'vencimientos', label: '⏰ Vencimientos' },
  { id: 'dispensas', label: '💊 Dispensas' },
  { id: 'movimientos', label: '↕️ Movimientos' },
];

export default function Reportes() {
  const reportes = useReportes();
  const medicamentos = useMedicamentos();

  const [tab, setTab] = useState('stock');
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + '01';

  const [days, setDays] = useState(30);
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [productId, setProductId] = useState('');

  useEffect(() => {
    medicamentos.list({ active: '1' }).then((r) => setProducts(r.data)).catch(() => {});
  }, []);

  const generar = () => {
    setLoading(true);
    setError('');
    const params = { type: tab };
    if (tab === 'vencimientos') params.days = days;
    if (tab === 'dispensas' || tab === 'movimientos') { params.from = from; params.to = to; }
    if (tab === 'movimientos' && productId) params.product_id = productId;

    reportes
      .get(params)
      .then((r) => setRows(r.data))
      .catch((e) => setError(e.response?.data?.error || 'Error al cargar reporte'))
      .finally(() => setLoading(false));
  };

  useEffect(generar, [tab]);

  const currentTabLabel = TABS.find((t) => t.id === tab)?.label || tab;

  const handleCSV = () => exportToCSV(rows, `reporte-${tab}-${today}.csv`);
  const handlePDF = () => {
    const subtitle = tab === 'vencimientos' ? `Próximos ${days} días` : tab === 'dispensas' || tab === 'movimientos' ? `${from} al ${to}` : '';
    printReporte(rows, tab, currentTabLabel, subtitle);
  };

  const renderFilters = () => (
    <div className="filters" style={{ marginBottom: 16 }}>
      {tab === 'vencimientos' && (
        <>
          <label className="form-label" style={{ margin: 0 }}>Días:</label>
          <input type="number" className="form-control" style={{ width: 90 }} value={days} onChange={(e) => setDays(e.target.value)} min="1" />
        </>
      )}
      {(tab === 'dispensas' || tab === 'movimientos') && (
        <>
          <label className="form-label" style={{ margin: 0 }}>Desde:</label>
          <input type="date" className="form-control" style={{ width: 155 }} value={from} onChange={(e) => setFrom(e.target.value)} />
          <label className="form-label" style={{ margin: 0 }}>Hasta:</label>
          <input type="date" className="form-control" style={{ width: 155 }} value={to} onChange={(e) => setTo(e.target.value)} />
        </>
      )}
      {tab === 'movimientos' && (
        <select className="form-control" style={{ width: 200 }} value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Todos los medicamentos</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      <button className="btn btn-primary btn-sm" onClick={generar}>Generar</button>
      <button className="btn btn-ghost btn-sm" onClick={handleCSV}>CSV</button>
      <button className="btn btn-ghost btn-sm" onClick={handlePDF}>PDF</button>
    </div>
  );

  const renderStockTable = () => (
    <table>
      <thead>
        <tr>
          <th>Código</th><th>Medicamento</th><th>Acción terapéutica</th><th>Categoría</th>
          <th>Stock</th><th>Stock mín.</th><th>Unidad</th><th>Precio compra</th><th>Valor stock</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td><code style={{ fontSize: '.8rem' }}>{r.code}</code></td>
            <td>{r.name}</td>
            <td>{r.therapeutic_action || '—'}</td>
            <td>{r.category_name || '—'}</td>
            <td style={{ color: r.stock === 0 ? 'var(--danger)' : Number(r.stock) <= Number(r.min_stock) ? 'var(--warning)' : 'inherit', fontWeight: 600 }}>{r.stock}</td>
            <td>{r.min_stock}</td>
            <td>{r.unit}</td>
            <td>${Number(r.purchase_price).toLocaleString('es-AR')}</td>
            <td>${Number(r.stock_value).toLocaleString('es-AR')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderVencimientosTable = () => (
    <table>
      <thead>
        <tr><th>Medicamento</th><th>N° Lote</th><th>Vencimiento</th><th>Cantidad</th><th>Ubicación</th><th>Días restantes</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{r.product_name}</td>
            <td><code>{r.lot_number}</code></td>
            <td>{new Date(r.expiry_date + 'T00:00:00').toLocaleDateString('es-AR')}</td>
            <td>{r.quantity} {r.unit}</td>
            <td>{r.location_name || '—'}</td>
            <td style={{ color: Number(r.days_left) < 0 || Number(r.days_left) <= 7 ? 'var(--danger)' : 'var(--warning)', fontWeight: 600 }}>
              {Number(r.days_left) < 0 ? `Vencido hace ${Math.abs(Number(r.days_left))} días` : `${r.days_left} días`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderDispensasTable = () => (
    <table>
      <thead>
        <tr>
          <th>Referencia</th><th>Fecha</th><th>Paciente</th><th>Documento</th><th>Ítems</th><th>Unidades</th><th>Operador</th><th>Observaciones</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.reference}>
            <td><code style={{ fontSize: '.8rem' }}>{r.reference}</code></td>
            <td style={{ fontSize: '.8rem' }}>{new Date(r.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
            <td>{r.apellido}, {r.nombre}</td>
            <td>{r.documento}</td>
            <td>{r.total_items}</td>
            <td>{r.total_unidades}</td>
            <td>{r.operador || '—'}</td>
            <td>{r.observaciones || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderMovimientosTable = () => (
    <table>
      <thead>
        <tr>
          <th>Fecha</th><th>Medicamento</th><th>Tipo</th><th>Cantidad</th><th>Stock anterior</th><th>Stock nuevo</th><th>Motivo</th><th>Operador</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td style={{ fontSize: '.8rem' }}>{new Date(r.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
            <td>{r.product_name}</td>
            <td><span className={r.type === 'entrada' ? 'mov-entrada' : r.type === 'salida' ? 'mov-salida' : 'mov-ajuste'}>{r.type}</span></td>
            <td>{r.quantity}</td>
            <td>{r.previous_stock}</td>
            <td>{r.new_stock}</td>
            <td>{r.reason || '—'}</td>
            <td>{r.user || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderResults = () => {
    if (loading) return <div className="spinner" />;
    if (rows.length === 0) return <div className="empty"><div className="empty-icon">📈</div><p>Sin datos para los filtros seleccionados</p></div>;
    return (
      <div className="table-wrap">
        {tab === 'stock' && renderStockTable()}
        {tab === 'vencimientos' && renderVencimientosTable()}
        {tab === 'dispensas' && renderDispensasTable()}
        {tab === 'movimientos' && renderMovimientosTable()}
      </div>
    );
  };

  return (
    <div>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--gray-200)', paddingBottom: 12, marginBottom: 16 }}>
          {TABS.map((t) => (
            <button key={t.id} type="button" className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        {renderFilters()}
        {renderResults()}
        {!loading && rows.length > 0 && <p style={{ marginTop: 12, color: 'var(--gray-400)', fontSize: '.8rem' }}>{rows.length} registros</p>}
      </div>
    </div>
  );
}
