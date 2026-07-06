import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const VEHICLE_TYPES = ['Auto', 'Camioneta', 'Utilitario', 'Moto', 'Camión', 'Motoniveladora', 'Pala de Carga', 'Bobcat', 'Tractor', 'Otros'];

const emptyForm = { name: '', plate: '', type: 'Auto', tank_capacity: '', km_per_liter: '', active: true };

export default function Vehicles() {
  const { user }              = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [showAutoKm, setShowAutoKm]   = useState(false);
  const [autoKmData, setAutoKmData]   = useState([]);
  const [autoKmLoading, setAutoKmLoading] = useState(false);
  const [autoKmSaving, setAutoKmSaving]   = useState(false);
  const isAdmin = user?.role === 'admin';

  const load = () =>
    axios.get('/fuel-control/backend/api/vehicles.php').then(r => { setVehicles(r.data); setLoading(false); });

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setError(''); setShowForm(true); };
  const openEdit = (v) => {
    setEditing(v.id);
    setForm({ name: v.name, plate: v.plate, type: v.type, tank_capacity: v.tank_capacity ?? '', km_per_liter: v.km_per_liter ?? '', active: Boolean(v.active) });
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await axios.put(`/fuel-control/backend/api/vehicles.php?id=${editing}`, form);
      } else {
        await axios.post('/fuel-control/backend/api/vehicles.php', form);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (v) => {
    await axios.put(`/fuel-control/backend/api/vehicles.php?id=${v.id}`, { ...v, active: !v.active });
    load();
  };

  const openAutoKm = async () => {
    setShowAutoKm(true);
    setAutoKmLoading(true);
    setAutoKmData([]);
    const r = await axios.get('/fuel-control/backend/api/auto_km_per_liter.php');
    setAutoKmData(r.data);
    setAutoKmLoading(false);
  };

  const applyAutoKm = async (overwrite) => {
    setAutoKmSaving(true);
    await axios.post('/fuel-control/backend/api/auto_km_per_liter.php', { overwrite });
    setAutoKmSaving(false);
    setShowAutoKm(false);
    load();
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      {isAdmin && (
        <div className="page-actions">
          <button className="btn btn-ghost btn-sm" onClick={openAutoKm} title="Calcular rendimiento automáticamente desde datos GPS + cargas">
            ⚡ Auto rendimiento (km/L)
          </button>
          <button className="btn btn-primary" onClick={openNew}>+ Nuevo vehículo</button>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Editar vehículo' : 'Nuevo vehículo'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Nombre *</label>
                  <input className="form-input" required value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Patente / ID *</label>
                  <input className="form-input" required value={form.plate}
                    onChange={e => setForm(f => ({ ...f, plate: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <select className="form-input" value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Capacidad del tanque (litros)</label>
                  <input className="form-input" type="number" min="0" step="0.1" value={form.tank_capacity}
                    onChange={e => setForm(f => ({ ...f, tank_capacity: e.target.value }))}
                    placeholder="Ej: 200" />
                </div>
                <div className="form-group">
                  <label className="form-label">Rendimiento (km/litro)</label>
                  <input className="form-input" type="number" min="0" step="0.01" value={form.km_per_liter}
                    onChange={e => setForm(f => ({ ...f, km_per_liter: e.target.value }))}
                    placeholder="Ej: 3.5" />
                </div>
                {editing && (
                  <div className="form-group">
                    <label className="form-label">Estado</label>
                    <select className="form-input" value={form.active ? '1' : '0'}
                      onChange={e => setForm(f => ({ ...f, active: e.target.value === '1' }))}>
                      <option value="1">Activo</option>
                      <option value="0">Inactivo</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Patente / ID</th>
                <th>Tipo</th>
                <th>Tanque</th>
                <th>Rendimiento</th>
                <th>Estado</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {vehicles.length === 0 && (
                <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--gray-500)' }}>Sin vehículos</td></tr>
              )}
              {vehicles.map(v => (
                <tr key={v.id}>
                  <td><strong>{v.name}</strong></td>
                  <td>{v.plate}</td>
                  <td><span className="badge badge-gray">{v.type}</span></td>
                  <td>{v.tank_capacity ? `${v.tank_capacity} L` : '—'}</td>
                  <td>{v.km_per_liter ? `${v.km_per_liter} km/L` : '—'}</td>
                  <td>
                    <span className={`badge ${v.active ? 'badge-green' : 'badge-red'}`}>
                      {v.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(v)}>Editar</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal auto rendimiento */}
      {showAutoKm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h2 className="modal-title">⚡ Rendimiento automático (km/L)</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAutoKm(false)}>✕</button>
            </div>
            <div style={{ padding: '0 0 12px', fontSize: 13, color: 'var(--gray-500)' }}>
              Calculado a partir del total de km GPS y litros cargados históricos por vehículo.
            </div>
            {autoKmLoading && <div className="spinner" />}
            {!autoKmLoading && autoKmData.length === 0 && (
              <div style={{ color: 'var(--gray-500)', padding: 12 }}>
                Sin datos suficientes (se necesitan registros GPS y cargas para el mismo vehículo).
              </div>
            )}
            {!autoKmLoading && autoKmData.length > 0 && (
              <>
                <div className="table-wrapper" style={{ maxHeight: 360, overflowY: 'auto', marginBottom: 16 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Vehículo</th>
                        <th>Patente</th>
                        <th style={{ textAlign: 'right' }}>Total km</th>
                        <th style={{ textAlign: 'right' }}>Total litros</th>
                        <th style={{ textAlign: 'right' }}>Calculado</th>
                        <th style={{ textAlign: 'right' }}>Actual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {autoKmData.map(v => (
                        <tr key={v.id}>
                          <td>{v.name}</td>
                          <td>{v.plate}</td>
                          <td style={{ textAlign: 'right' }}>{Number(v.total_km).toFixed(0)}</td>
                          <td style={{ textAlign: 'right' }}>{Number(v.total_litros).toFixed(0)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--blue-600)' }}>{v.km_l_calculado}</td>
                          <td style={{ textAlign: 'right', color: v.actual ? 'var(--gray-700)' : 'var(--gray-400)' }}>
                            {v.actual ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost" onClick={() => setShowAutoKm(false)}>Cancelar</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => applyAutoKm(false)} disabled={autoKmSaving}>
                    {autoKmSaving ? 'Guardando...' : 'Aplicar solo sin valor'}
                  </button>
                  <button className="btn btn-primary" onClick={() => applyAutoKm(true)} disabled={autoKmSaving}>
                    {autoKmSaving ? 'Guardando...' : 'Aplicar todos (sobreescribir)'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
