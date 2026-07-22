import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const VEHICLE_TYPES = ['Auto', 'Camioneta', 'Utilitario', 'Moto', 'Camión', 'Motoniveladora', 'Pala de Carga', 'Bobcat', 'Tractor', 'Otros'];

const emptyForm = { name: '', plate: '', type: 'Auto', tank_capacity: '', km_per_liter: '', area_id: '', active: true };

// Nivel estimado (sin sensores reales, ver helpers.php ajustarNivelTanque).
// Solo se puede mostrar si el vehículo tiene tank_capacity cargado.
function NivelBadge({ v, onEdit }) {
  if (!v.tank_capacity || v.fuel_level_liters === null || v.fuel_level_liters === undefined) {
    return <span style={{ color: 'var(--gray-400)' }}>—</span>;
  }
  const pct = Math.round((Number(v.fuel_level_liters) / Number(v.tank_capacity)) * 100);
  const color = pct <= 25 ? 'badge-red' : pct <= 50 ? 'badge-yellow' : 'badge-green';
  const badge = (
    <span className={`badge ${color}`} title={`${Number(v.fuel_level_liters).toFixed(0)} L estimados`}>
      {pct}%
    </span>
  );
  if (!onEdit) return badge;
  return (
    <button type="button" className="btn btn-ghost btn-sm" style={{ padding: 0, gap: 6 }}
      title="Ajustar nivel a mano" onClick={() => onEdit(v)}>
      {badge} ✏️
    </button>
  );
}

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
  const [areas, setAreas]             = useState([]);
  const [levelEditing, setLevelEditing] = useState(null);
  const [levelValue, setLevelValue]     = useState('');
  const [levelSaving, setLevelSaving]   = useState(false);
  const [levelError, setLevelError]     = useState('');
  const isAdmin = user?.role === 'admin';

  const load = () =>
    axios.get('/fuel-control/backend/api/vehicles.php').then(r => { setVehicles(r.data); setLoading(false); });

  useEffect(() => {
    load();
    axios.get('/fuel-control/backend/api/areas.php').then(r => setAreas(r.data));
  }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setError(''); setShowForm(true); };
  const openEdit = (v) => {
    setEditing(v.id);
    setForm({ name: v.name, plate: v.plate, type: v.type, tank_capacity: v.tank_capacity ?? '', km_per_liter: v.km_per_liter ?? '', area_id: v.area_id ?? '', active: Boolean(v.active) });
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

  const openLevelEdit = (v) => {
    setLevelEditing(v);
    setLevelValue(v.fuel_level_liters ?? v.tank_capacity ?? '');
    setLevelError('');
  };

  const saveLevel = async (e) => {
    e.preventDefault();
    setLevelSaving(true);
    setLevelError('');
    try {
      await axios.put(`/fuel-control/backend/api/vehicles.php?id=${levelEditing.id}&action=set_level`, {
        fuel_level_liters: parseFloat(levelValue),
      });
      setLevelEditing(null);
      load();
    } catch (err) {
      setLevelError(err.response?.data?.error ?? 'Error al guardar');
    } finally {
      setLevelSaving(false);
    }
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
                <div className="form-group">
                  <label className="form-label">Área municipal</label>
                  <select className="form-input" value={form.area_id}
                    onChange={e => setForm(f => ({ ...f, area_id: e.target.value }))}>
                    <option value="">— Sin área asignada —</option>
                    {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
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
                <th>Área</th>
                <th>Tanque</th>
                <th>Rendimiento</th>
                <th>Nivel</th>
                <th>Estado</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {vehicles.length === 0 && (
                <tr><td colSpan={isAdmin ? 9 : 8} style={{ textAlign: 'center', color: 'var(--gray-500)' }}>Sin vehículos</td></tr>
              )}
              {vehicles.map(v => (
                <tr key={v.id}>
                  <td><strong>{v.name}</strong></td>
                  <td>{v.plate}</td>
                  <td><span className="badge badge-gray">{v.type}</span></td>
                  <td style={{ fontSize: '.85em', color: 'var(--gray-500)' }}>
                    {v.area_name ?? '—'}
                  </td>
                  <td>{v.tank_capacity ? `${v.tank_capacity} L` : '—'}</td>
                  <td>{v.km_per_liter ? `${v.km_per_liter} km/L` : '—'}</td>
                  <td><NivelBadge v={v} onEdit={isAdmin && v.tank_capacity ? openLevelEdit : null} /></td>
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

      {/* Modal ajuste manual de nivel */}
      {levelEditing && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2 className="modal-title">Ajustar nivel — {levelEditing.name}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setLevelEditing(null)}>✕</button>
            </div>
            <form onSubmit={saveLevel}>
              {levelError && <div className="alert alert-error">{levelError}</div>}
              <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 14 }}>
                Nivel estimado sin sensores reales. Usá esto solo si notás que se desvió de la realidad
                (por ejemplo, después de una carga a mano no registrada en el sistema).
              </div>
              <div className="form-group">
                <label className="form-label">
                  Litros en el tanque
                  <span style={{ fontWeight: 400, color: 'var(--gray-500)', marginLeft: 8 }}>
                    Tanque: {levelEditing.tank_capacity} L
                  </span>
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-input" type="number" min="0" max={levelEditing.tank_capacity}
                    step="0.1" required value={levelValue}
                    onChange={e => setLevelValue(e.target.value)} />
                  <button type="button" className="btn btn-ghost btn-sm" style={{ whiteSpace: 'nowrap' }}
                    onClick={() => setLevelValue(levelEditing.tank_capacity)}>
                    Tanque lleno
                  </button>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setLevelEditing(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={levelSaving}>
                  {levelSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
