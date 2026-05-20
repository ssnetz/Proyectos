import { useState, useEffect } from 'react';
import { useMovements } from '../hooks/useApi';

export default function Movements() {
  const { list } = useMovements();
  const [movements, setMovements] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [filterType, setFilterType] = useState('');
  const [limit, setLimit]         = useState(50);

  const load = () => {
    const params = { limit };
    if (filterType) params.type = filterType;
    return list(params).then((r) => setMovements(r.data));
  };

  useEffect(() => {
    load().catch(() => setError('Error cargando movimientos')).finally(() => setLoading(false));
  }, [filterType, limit]);

  const typeLabel = (t) => {
    const map = { entrada: '⬆ Entrada', salida: '⬇ Salida', ajuste: '⚙ Ajuste', dispensa: '💊 Dispensa' };
    return map[t] || t;
  };

  const typeClass = (t) => `mov-${t}`;

  return (
    <div>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="card">
        <div className="table-actions">
          <div className="filters">
            <select className="form-control" style={{ width: 160 }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">Todos los tipos</option>
              <option value="entrada">Entradas</option>
              <option value="dispensa">Dispensas</option>
              <option value="salida">Salidas</option>
              <option value="ajuste">Ajustes</option>
            </select>
            <select className="form-control" style={{ width: 120 }} value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              <option value={25}>Últimos 25</option>
              <option value={50}>Últimos 50</option>
              <option value={100}>Últimos 100</option>
              <option value={200}>Últimos 200</option>
            </select>
          </div>
          <span style={{ fontSize: '.875rem', color: 'var(--gray-500)' }}>{movements.length} movimientos</span>
        </div>

        {loading ? <div className="spinner" /> : movements.length === 0 ? (
          <div className="empty"><div className="empty-icon">📋</div><p>No hay movimientos registrados</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Fecha</th><th>Producto</th><th>Tipo</th>
                  <th>Cantidad</th><th>Stock ant.</th><th>Stock nuevo</th>
                  <th>Beneficiario</th><th>Motivo</th><th>Referencia</th><th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td style={{ color: 'var(--gray-400)', fontSize: '.8rem' }}>{m.id}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '.8rem' }}>
                      {new Date(m.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{m.product_name}</div>
                      <div style={{ fontSize: '.75rem', color: 'var(--gray-400)' }}>{m.product_code}</div>
                    </td>
                    <td><span className={typeClass(m.type)}>{typeLabel(m.type)}</span></td>
                    <td><strong>{m.quantity}</strong></td>
                    <td style={{ color: 'var(--gray-500)' }}>{m.previous_stock}</td>
                    <td><strong>{m.new_stock}</strong></td>
                    <td style={{ fontSize: '.8rem' }}>
                      {m.beneficiary_apellido
                        ? <span>👤 <strong>{m.beneficiary_apellido}{m.beneficiary_nombre ? ', ' + m.beneficiary_nombre : ''}</strong><br /><span style={{ color: 'var(--gray-400)' }}>DNI {m.beneficiary_documento}</span></span>
                        : <span style={{ color: 'var(--gray-500)' }}>—</span>}
                    </td>
                    <td style={{ color: 'var(--gray-600)', fontSize: '.85rem' }}>{m.reason || '—'}</td>
                    <td style={{ color: 'var(--gray-500)', fontSize: '.8rem' }}>{m.reference || '—'}</td>
                    <td style={{ color: 'var(--gray-500)', fontSize: '.8rem' }}>{m.user}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
