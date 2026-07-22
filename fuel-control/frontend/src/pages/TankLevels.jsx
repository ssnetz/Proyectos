import { useEffect, useState } from 'react';
import axios from 'axios';

// Nivel estimado sin sensores reales (ver ajustarNivelTanque en helpers.php):
// sube con cada carga y baja con los km GPS importados. Arranca en "tanque
// lleno" la primera vez que se toca el vehículo.
const THRESHOLD_PCT = 25;

function levelColor(pct) {
  if (pct <= THRESHOLD_PCT) return '#ef4444';
  if (pct <= 50) return '#f59e0b';
  return '#10b981';
}

function LevelRow({ v }) {
  const pct = Math.round((Number(v.fuel_level_liters) / Number(v.tank_capacity)) * 100);
  const color = levelColor(pct);
  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div>
          <strong>{v.name}</strong>
          <span style={{ fontSize: 12, color: 'var(--gray-500)', marginLeft: 8 }}>{v.plate}</span>
          {v.area_name && <span style={{ fontSize: 12, color: 'var(--gray-500)', marginLeft: 8 }}>· {v.area_name}</span>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 18, fontWeight: 700, color }}>{pct}%</span>
          <span style={{ fontSize: 12, color: 'var(--gray-500)', marginLeft: 6 }}>
            {Number(v.fuel_level_liters).toFixed(0)} / {Number(v.tank_capacity).toFixed(0)} L
          </span>
        </div>
      </div>
      <div style={{ background: 'var(--gray-200)', borderRadius: 4, height: 12 }}>
        <div style={{ width: `${Math.max(pct, 2)}%`, background: color, borderRadius: 4, height: 12, transition: 'width .4s' }} />
      </div>
      {pct <= THRESHOLD_PCT && (
        <div style={{ fontSize: 12, color, marginTop: 6 }}>
          ⚠ Nivel bajo — se genera una orden de carga automática si no hay una pendiente.
        </div>
      )}
    </div>
  );
}

export default function TankLevels() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    axios.get('/fuel-control/backend/api/vehicles.php').then(r => {
      setVehicles(r.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="spinner" />;

  const withTank = vehicles
    .filter(v => v.active && v.tank_capacity)
    .map(v => ({ ...v, _pct: (Number(v.fuel_level_liters ?? v.tank_capacity) / Number(v.tank_capacity)) * 100 }))
    .sort((a, b) => a._pct - b._pct);

  const sinTanque = vehicles.filter(v => v.active && !v.tank_capacity);

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>
        Nivel estimado (sin sensores reales): se calcula solo con las cargas registradas y los km
        importados del GPS. Por debajo del {THRESHOLD_PCT}% el sistema genera una orden de carga automática.
      </div>

      {withTank.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--gray-500)', padding: 40 }}>
          Ningún vehículo activo tiene capacidad de tanque configurada todavía.
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {withTank.map(v => <LevelRow key={v.id} v={v} />)}
      </div>

      {sinTanque.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 20 }}>
          Sin capacidad de tanque cargada: {sinTanque.map(v => v.name).join(', ')}
        </div>
      )}
    </div>
  );
}
