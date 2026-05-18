import { useState, useEffect } from 'react';
import { useMovements, useProducts, useLocations } from '../hooks/useApi';

const typeMap = {
  entrada:       { label: '⬆ Entrada',       cls: 'mov-entrada' },
  salida:        { label: '⬇ Salida',        cls: 'mov-salida'  },
  ajuste:        { label: '⚙ Ajuste',        cls: 'mov-ajuste'  },
  transferencia: { label: '↔ Transferencia', cls: 'mov-transferencia' },
};

export default function Movements() {
  const movementsApi = useMovements();
  const productsApi  = useProducts();
  const locationsApi = useLocations();

  const [movements,  setMovements]  = useState([]);
  const [products,   setProducts]   = useState([]);
  const [locations,  setLocations]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  const [filterProduct,  setFilterProduct]  = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterType,     setFilterType]     = useState('');
  const [limit,          setLimit]          = useState(100);

  const load = () => {
    const params = { limit };
    if (filterProduct)  params.product_id  = filterProduct;
    if (filterLocation) params.location_id = filterLocation;
    if (filterType)     params.type        = filterType;
    return movementsApi.list(params).then((r) => setMovements(r.data));
  };

  useEffect(() => {
    Promise.all([load(), productsApi.list(), locationsApi.list()])
      .then(([, prods, locs]) => {
        setProducts(prods.data);
        setLocations(locs.data);
      })
      .catch(() => setError('Error cargando datos'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading) load().catch(() => {});
  }, [filterProduct, filterLocation, filterType, limit]);

  const fmtDate = (d) =>
    new Date(d).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });

  return (
    <div>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="card">
        <div className="table-actions">
          <div className="filters">
            <select className="form-control" style={{ width: 200 }} value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)}>
              <option value="">Todos los medicamentos</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="form-control" style={{ width: 180 }} value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}>
              <option value="">Todas las ubicaciones</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <select className="form-control" style={{ width: 160 }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">Todos los tipos</option>
              <option value="entrada">Entradas</option>
              <option value="salida">Salidas</option>
              <option value="transferencia">Transferencias</option>
              <option value="ajuste">Ajustes</option>
            </select>
            <select className="form-control" style={{ width: 120 }} value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              <option value={50}>Últimos 50</option>
              <option value={100}>Últimos 100</option>
              <option value={200}>Últimos 200</option>
            </select>
          </div>
          <span style={{ fontSize: '.875rem', color: 'var(--gray-500)' }}>
            {movements.length} movimientos
          </span>
        </div>

        {loading ? <div className="spinner" /> : movements.length === 0 ? (
          <div className="empty"><div className="empty-icon">📋</div><p>No hay movimientos registrados</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Medicamento</th>
                  <th>Tipo</th>
                  <th>Ubicación</th>
                  <th style={{ textAlign: 'right' }}>Cant.</th>
                  <th style={{ textAlign: 'right' }}>Ant.</th>
                  <th style={{ textAlign: 'right' }}>Nuevo</th>
                  <th>Motivo / Ref.</th>
                  <th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => {
                  const t = typeMap[m.type] ?? { label: m.type, cls: '' };
                  return (
                    <tr key={m.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '.8rem', color: 'var(--gray-400)' }}>
                        {fmtDate(m.created_at)}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{m.product_name}</div>
                        <div style={{ fontSize: '.75rem', color: 'var(--gray-500)' }}>{m.product_code}</div>
                      </td>
                      <td><span className={t.cls}>{t.label}</span></td>
                      <td style={{ fontSize: '.8rem' }}>
                        {m.type === 'transferencia' ? (
                          <span>
                            {m.location_name}
                            <span style={{ color: 'var(--primary)', margin: '0 4px' }}>→</span>
                            {m.to_location_name}
                          </span>
                        ) : (
                          m.location_name || <span style={{ color: 'var(--gray-600)' }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{m.quantity}</td>
                      <td style={{ textAlign: 'right', color: 'var(--gray-500)' }}>{m.previous_stock}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{m.new_stock}</td>
                      <td style={{ fontSize: '.8rem', color: 'var(--gray-500)' }}>
                        {m.reason || '—'}
                        {m.reference && (
                          <div style={{ fontSize: '.7rem' }}><code>{m.reference}</code></div>
                        )}
                      </td>
                      <td style={{ fontSize: '.8rem', color: 'var(--gray-500)' }}>{m.user}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
