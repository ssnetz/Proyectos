import { useState } from 'react';
import { useReports } from '../hooks/useApi';

const today    = new Date().toISOString().slice(0, 10);
const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

const TIPOS = [
  { value: '',         label: 'Todos' },
  { value: 'entrada',  label: 'Entradas' },
  { value: 'dispensa', label: 'Dispensas' },
  { value: 'salida',   label: 'Salidas' },
  { value: 'ajuste',   label: 'Ajustes' },
];

export default function Reports() {
  const { get } = useReports();

  const [tab, setTab]     = useState('dispensas');
  const [from, setFrom]   = useState(firstDay);
  const [to, setTo]       = useState(today);
  const [movType, setMovType] = useState('');

  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const run = () => {
    setLoading(true);
    setError('');
    setData(null);
    const params = { report: tab, from, to };
    if (tab === 'movimientos' && movType) params.type = movType;
    get(params)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error || 'Error al generar reporte'))
      .finally(() => setLoading(false));
  };

  const fmt = (d) => new Date(d).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  const tabs = [
    { key: 'dispensas',   label: '💊 Dispensas' },
    { key: 'movimientos', label: '↕️ Movimientos' },
    { key: 'stock',       label: '📦 Stock actual' },
    { key: 'stock_bajo',  label: '⚠️ Stock bajo' },
  ];

  const needsDates = tab === 'dispensas' || tab === 'movimientos';

  return (
    <div>
      {error && <div className="alert alert-danger">{error}</div>}

      {/* Tab selector */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: needsDates ? 16 : 0 }}>
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              className={`btn ${tab === key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setTab(key); setData(null); }}
            >
              {label}
            </button>
          ))}
        </div>

        {needsDates && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Desde</label>
              <input type="date" className="form-control" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Hasta</label>
              <input type="date" className="form-control" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            {tab === 'movimientos' && (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Tipo</label>
                <select className="form-control" value={movType} onChange={(e) => setMovType(e.target.value)}>
                  {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            )}
            <button className="btn btn-primary" onClick={run} disabled={loading}>
              {loading ? 'Generando...' : '🔍 Generar reporte'}
            </button>
          </div>
        )}

        {!needsDates && (
          <div style={{ marginTop: 0 }}>
            <button className="btn btn-primary" onClick={run} disabled={loading}>
              {loading ? 'Cargando...' : '🔍 Ver reporte'}
            </button>
          </div>
        )}
      </div>

      {loading && <div className="spinner" />}

      {/* ── Reporte Dispensas ── */}
      {data && tab === 'dispensas' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">💊 Dispensas del {from} al {to}</span>
            <span style={{ fontSize: '.875rem', color: 'var(--gray-400)' }}>
              {data.total_registros} registros · {data.total_unidades} unidades dispensadas
            </span>
          </div>
          {data.rows.length === 0 ? (
            <div className="empty"><div className="empty-icon">💊</div><p>Sin dispensas en el período</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th><th>Medicamento</th><th>Cantidad</th>
                    <th>Beneficiario</th><th>DNI</th><th>Barrio</th><th>Motivo</th><th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '.8rem' }}>{fmt(r.created_at)}</td>
                      <td>
                        <strong>{r.medicamento_name}</strong>
                        <span style={{ color: 'var(--gray-400)', marginLeft: 4, fontSize: '.75rem' }}>/ {r.unit}</span>
                      </td>
                      <td><strong style={{ color: 'var(--primary)' }}>{r.quantity}</strong></td>
                      <td>
                        {r.apellido
                          ? <><strong>{r.apellido}</strong>{r.beneficiary_nombre ? ', ' + r.beneficiary_nombre : ''}</>
                          : <span style={{ color: 'var(--gray-500)' }}>—</span>}
                      </td>
                      <td style={{ fontSize: '.8rem', color: 'var(--gray-400)' }}>{r.documento || '—'}</td>
                      <td style={{ fontSize: '.8rem' }}>{r.barrio || '—'}</td>
                      <td style={{ fontSize: '.8rem', color: 'var(--gray-500)' }}>{r.reason || '—'}</td>
                      <td style={{ fontSize: '.8rem', color: 'var(--gray-500)' }}>{r.user}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Reporte Movimientos ── */}
      {data && tab === 'movimientos' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">↕️ Movimientos del {from} al {to}</span>
            <span style={{ fontSize: '.875rem', color: 'var(--gray-400)' }}>{data.total} registros</span>
          </div>
          {data.rows.length === 0 ? (
            <div className="empty"><div className="empty-icon">📋</div><p>Sin movimientos en el período</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th><th>Medicamento</th><th>Tipo</th><th>Cant.</th>
                    <th>Stock ant.</th><th>Stock nuevo</th><th>Beneficiario</th><th>Motivo</th><th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '.8rem' }}>{fmt(r.created_at)}</td>
                      <td><strong>{r.medicamento_name}</strong></td>
                      <td><span className={`mov-${r.type}`}>{r.type}</span></td>
                      <td><strong>{r.quantity}</strong></td>
                      <td style={{ color: 'var(--gray-500)' }}>{r.previous_stock}</td>
                      <td><strong>{r.new_stock}</strong></td>
                      <td style={{ fontSize: '.8rem' }}>
                        {r.apellido
                          ? `${r.apellido}${r.beneficiary_nombre ? ', ' + r.beneficiary_nombre : ''}`
                          : <span style={{ color: 'var(--gray-500)' }}>—</span>}
                      </td>
                      <td style={{ fontSize: '.8rem', color: 'var(--gray-500)' }}>{r.reason || '—'}</td>
                      <td style={{ fontSize: '.8rem', color: 'var(--gray-500)' }}>{r.user}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Reporte Stock actual ── */}
      {data && tab === 'stock' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">📦 Stock actual de medicamentos</span>
            <div style={{ display: 'flex', gap: 10, fontSize: '.875rem' }}>
              <span className="badge badge-red">Sin stock: {data.sin_stock}</span>
              <span className="badge badge-yellow">Stock bajo: {data.stock_bajo}</span>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Código</th><th>Medicamento</th><th>Categoría</th><th>Unidad</th><th>Stock</th><th>Mínimo</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={i}>
                    <td><code style={{ fontSize: '.8rem' }}>{r.code}</code></td>
                    <td><strong>{r.name}</strong></td>
                    <td style={{ color: 'var(--gray-500)' }}>{r.categoria || '—'}</td>
                    <td style={{ color: 'var(--gray-500)', fontSize: '.85rem' }}>{r.unit}</td>
                    <td>
                      <strong style={{ color: r.estado === 'sin_stock' ? 'var(--danger)' : r.estado === 'stock_bajo' ? 'var(--warning)' : 'inherit' }}>
                        {r.stock}
                      </strong>
                    </td>
                    <td style={{ color: 'var(--gray-500)' }}>{r.min_stock}</td>
                    <td>
                      {r.estado === 'sin_stock'  && <span className="badge badge-red">Sin stock</span>}
                      {r.estado === 'stock_bajo' && <span className="badge badge-yellow">Stock bajo</span>}
                      {r.estado === 'ok'         && <span className="badge badge-green">OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Reporte Stock bajo ── */}
      {data && tab === 'stock_bajo' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">⚠️ Medicamentos con stock bajo o sin stock</span>
            <span style={{ fontSize: '.875rem', color: 'var(--gray-400)' }}>{data.rows.length} medicamentos</span>
          </div>
          {data.rows.length === 0 ? (
            <div className="empty"><div className="empty-icon">✅</div><p>Todos los medicamentos tienen stock suficiente</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Código</th><th>Medicamento</th><th>Categoría</th><th>Unidad</th><th>Stock actual</th><th>Stock mínimo</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {data.rows.map((r, i) => (
                    <tr key={i}>
                      <td><code style={{ fontSize: '.8rem' }}>{r.code}</code></td>
                      <td><strong>{r.name}</strong></td>
                      <td style={{ color: 'var(--gray-500)' }}>{r.categoria || '—'}</td>
                      <td style={{ color: 'var(--gray-500)', fontSize: '.85rem' }}>{r.unit}</td>
                      <td>
                        <strong style={{ color: r.stock === 0 ? 'var(--danger)' : 'var(--warning)' }}>
                          {r.stock}
                        </strong>
                      </td>
                      <td style={{ color: 'var(--gray-500)' }}>{r.min_stock}</td>
                      <td>
                        {r.stock === 0
                          ? <span className="badge badge-red">Sin stock</span>
                          : <span className="badge badge-yellow">Stock bajo</span>}
                      </td>
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
