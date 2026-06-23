import { useEffect, useState } from 'react';
import axios from 'axios';

export default function FuelPrices() {
  const [prices, setPrices]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // fuel_type siendo editado
  const [newPrice, setNewPrice] = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const load = () =>
    axios.get('/fuel-control/backend/api/fuel_prices.php').then(r => {
      setPrices(r.data);
      setLoading(false);
    });

  useEffect(() => { load(); }, []);

  const handleSave = async (fuel_type) => {
    if (!newPrice || parseFloat(newPrice) <= 0) {
      setError('Ingresá un precio válido');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await axios.post('/fuel-control/backend/api/fuel_prices.php', {
        fuel_type,
        price: parseFloat(newPrice),
      });
      setEditing(null);
      setNewPrice('');
      setSuccess(`Precio de ${fuel_type} actualizado`);
      load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      {error   && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Precios vigentes por tipo de combustible</h3>
          <span style={{ fontSize: '.8rem', color: 'var(--gray-500)' }}>
            Cada actualización queda registrada sin borrar el historial
          </span>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Precio vigente ($/L)</th>
                <th>Última actualización</th>
                <th>Actualizado por</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {prices.map(p => (
                <tr key={p.fuel_type}>
                  <td><span className="badge badge-blue">{p.fuel_type}</span></td>
                  <td>
                    {editing === p.fuel_type ? (
                      <input
                        className="form-input form-input-sm"
                        type="number"
                        step="0.0001"
                        autoFocus
                        style={{ width: 140 }}
                        value={newPrice}
                        onChange={e => setNewPrice(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSave(p.fuel_type)}
                      />
                    ) : (
                      <strong>
                        {p.price ? `$${Number(p.price).toLocaleString('es', { minimumFractionDigits: 4 })}` : '—'}
                      </strong>
                    )}
                  </td>
                  <td>
                    {p.created_at
                      ? new Date(p.created_at).toLocaleString('es')
                      : <span style={{ color: 'var(--gray-400)' }}>Sin precio cargado</span>}
                  </td>
                  <td>{p.username ?? '—'}</td>
                  <td>
                    {editing === p.fuel_type ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-primary btn-sm" disabled={saving}
                          onClick={() => handleSave(p.fuel_type)}>
                          {saving ? '...' : 'Guardar'}
                        </button>
                        <button className="btn btn-ghost btn-sm"
                          onClick={() => { setEditing(null); setNewPrice(''); setError(''); }}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button className="btn btn-ghost btn-sm"
                        onClick={() => { setEditing(p.fuel_type); setNewPrice(p.price ?? ''); setError(''); }}>
                        Actualizar precio
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
