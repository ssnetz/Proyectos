import { useState, useEffect } from 'react';
import { useMesas, useElecciones, useCortesMesa } from '../hooks/useApi';
import { useMunicipio } from '../context/MunicipioContext';
import { useEleccion } from '../context/EleccionContext';

// Datos variables que antes estaban fijos en el código de la Constancia de
// Emisión de Voto (y que van a reusarse en otras actas): el nombre/fecha de
// la elección y el encabezado de la Junta Electoral (ambos propios de cada
// elección: un mismo municipio puede tener varias, cada una con lo suyo), y
// el corte de mesa (cuántos electores tiene cada mesa), que hoy se carga a
// mano mesa por mesa.

export default function Configuracion() {
  const { list: listMesas, update: updateMesa } = useMesas();
  const { get: getEleccion, update: updateEleccion } = useElecciones();
  const { cortar } = useCortesMesa();
  const { selectedId: municipioId } = useMunicipio();
  const { selectedId: eleccionId } = useEleccion();

  const [eleccionNombre, setEleccionNombre] = useState('');
  const [eleccionFecha, setEleccionFecha]   = useState('');
  const [juntaNombre, setJuntaNombre]       = useState('');
  const [savingEleccion, setSavingEleccion] = useState(false);

  const [mesas, setMesas]         = useState([]);
  const [cortes, setCortes]       = useState({}); // mesaId -> valor en edición
  const [savingMesa, setSavingMesa] = useState(null); // mesaId que se está guardando

  const [maxPorMesa, setMaxPorMesa] = useState(350);
  const [numeroInicial, setNumeroInicial] = useState(1);
  const [reiniciarOrden, setReiniciarOrden] = useState(false);
  const [cortando, setCortando]     = useState(false);
  const [corteResultado, setCorteResultado] = useState(null);
  const [corteError, setCorteError] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const load = () => {
    if (!municipioId) return Promise.resolve();
    const pedidos = [listMesas()];
    if (eleccionId) pedidos.push(getEleccion(eleccionId));
    return Promise.all(pedidos).then(([ms, e]) => {
      setMesas(ms.data);
      const iniciales = {};
      ms.data.forEach((mesa) => { iniciales[mesa.id] = mesa.electores_habilitados ?? 0; });
      setCortes(iniciales);
      if (e) {
        setEleccionNombre(e.data.nombre || '');
        setEleccionFecha(e.data.fecha || '');
        setJuntaNombre(e.data.junta_electoral_nombre || '');
      }
    });
  };

  useEffect(() => {
    setLoading(true);
    load().catch(() => setError('Error cargando la configuración')).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [municipioId, eleccionId]);

  const handleSaveEleccion = async () => {
    if (!eleccionId) return;
    if (!eleccionNombre) { setError('El nombre de la elección es requerido'); return; }
    setSavingEleccion(true);
    setError('');
    try {
      await updateEleccion(eleccionId, {
        nombre: eleccionNombre,
        fecha: eleccionFecha || null,
        junta_electoral_nombre: juntaNombre,
      });
      notify('Elección actualizada');
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSavingEleccion(false);
    }
  };

  const handleSaveCorte = async (mesa) => {
    setSavingMesa(mesa.id);
    setError('');
    try {
      await updateMesa(mesa.id, {
        establecimiento_id: mesa.establecimiento_id,
        numero: mesa.numero,
        electores_habilitados: cortes[mesa.id] || 0,
      });
      notify(`Corte de la mesa ${mesa.numero} actualizado`);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar el corte de mesa');
    } finally {
      setSavingMesa(null);
    }
  };

  const handleCortarMesas = async () => {
    if (!maxPorMesa || maxPorMesa < 1) { setCorteError('Ingresá un máximo válido'); return; }
    if (!numeroInicial || numeroInicial < 1) { setCorteError('Ingresá un número de mesa inicial válido'); return; }
    if (!confirm(
      `Esto va a reordenar TODO el padrón de esta elección alfabéticamente y reasignar la mesa ` +
      `y el número de orden de cada elector, en bloques de hasta ${maxPorMesa}, numerando las mesas ` +
      `a partir de la ${numeroInicial}. ` +
      'Las mesas armadas a mano (o por curso) quedan sin electores. ¿Confirmás?'
    )) return;

    setCortando(true);
    setCorteError('');
    setCorteResultado(null);
    try {
      const r = await cortar(maxPorMesa, numeroInicial, reiniciarOrden);
      setCorteResultado(r.data);
      notify('Corte de mesa aplicado');
      await load();
    } catch (e) {
      setCorteError(e.response?.data?.error || 'Error al cortar mesas');
    } finally {
      setCortando(false);
    }
  };

  if (loading) return <div className="spinner" style={{ marginTop: 80 }} />;

  return (
    <div>
      {error   && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Elección</h3>
        <p style={{ fontSize: '.85rem', color: 'var(--gray-500)', marginBottom: 16 }}>
          Nombre, fecha y encabezado de la Junta Electoral de la elección actualmente
          seleccionada (arriba, en el selector del costado) — propios de esta elección, no del
          municipio: un mismo municipio puede tener otra elección con otros valores. Se muestran
          en el encabezado del padrón y en el troquel de la Constancia de Emisión de Voto (y de
          las próximas actas que lo reusen).
        </p>
        {!eleccionId ? (
          <p style={{ color: 'var(--gray-500)' }}>No hay ninguna elección seleccionada.</p>
        ) : (
          <>
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Nombre de la elección</label>
                <input
                  className="form-control"
                  value={eleccionNombre}
                  onChange={(e) => setEleccionNombre(e.target.value)}
                  placeholder="Ej: Elección 2027"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha</label>
                <input
                  type="date"
                  className="form-control"
                  value={eleccionFecha}
                  onChange={(e) => setEleccionFecha(e.target.value)}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Nombre de la Junta Electoral</label>
              <input
                className="form-control"
                value={juntaNombre}
                onChange={(e) => setJuntaNombre(e.target.value)}
                placeholder="Ej: Junta Electoral Municipal"
              />
            </div>
            <button className="btn btn-primary" onClick={handleSaveEleccion} disabled={savingEleccion}>
              {savingEleccion ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        )}
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Armar mesas automáticamente</h3>
        <p style={{ fontSize: '.85rem', color: 'var(--gray-500)', marginBottom: 16 }}>
          Ordena todo el padrón de esta elección alfabéticamente (apellido, nombre), le asigna el
          número de orden a cada elector, y arma las mesas cortando cada tantos electores como
          indiques acá. Las mesas quedan bajo el establecimiento "Sin asignar" — reasignalas a la
          escuela real después desde Mesas.
        </p>
        {corteError && <div className="alert alert-danger">{corteError}</div>}
        <div className="form-row" style={{ alignItems: 'flex-end' }}>
          <div className="form-group">
            <label className="form-label">Máximo de electores por mesa</label>
            <input
              type="number"
              min="1"
              className="form-control"
              style={{ width: 160 }}
              value={maxPorMesa}
              onChange={(e) => setMaxPorMesa(Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Número de mesa inicial</label>
            <input
              type="number"
              min="1"
              className="form-control"
              style={{ width: 160 }}
              value={numeroInicial}
              onChange={(e) => setNumeroInicial(Number(e.target.value))}
            />
          </div>
          <button className="btn btn-primary" onClick={handleCortarMesas} disabled={cortando}>
            {cortando ? 'Aplicando...' : 'Aplicar corte'}
          </button>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={reiniciarOrden}
            onChange={(e) => setReiniciarOrden(e.target.checked)}
          />
          <span style={{ fontSize: '.85rem' }}>
            Reiniciar el orden en 1 en cada mesa (si no se marca, el orden es correlativo en todo
            el padrón: la mesa 2 sigue donde terminó la 1)
          </span>
        </label>
        {corteResultado && (
          <div className="alert alert-success" style={{ marginTop: 12 }}>
            {corteResultado.total_electores} electores repartidos en {corteResultado.total_mesas} mesa
            {corteResultado.total_mesas === 1 ? '' : 's'} de hasta {corteResultado.max_por_mesa} cada una,
            numeradas de la {corteResultado.numero_inicial} a la {corteResultado.numero_final}
            ({corteResultado.mesas_creadas} mesa{corteResultado.mesas_creadas === 1 ? '' : 's'} nueva
            {corteResultado.mesas_creadas === 1 ? '' : 's'}
            {corteResultado.mesas_borradas > 0
              ? `, ${corteResultado.mesas_borradas} mesa${corteResultado.mesas_borradas === 1 ? '' : 's'} vieja${corteResultado.mesas_borradas === 1 ? '' : 's'} vacía${corteResultado.mesas_borradas === 1 ? '' : 's'} eliminada${corteResultado.mesas_borradas === 1 ? '' : 's'}`
              : ''}
            ). Orden {corteResultado.reiniciar_orden ? 'reiniciado en 1 en cada mesa' : 'correlativo en todo el padrón'}.
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Corte de mesa</h3>
        <p style={{ fontSize: '.85rem', color: 'var(--gray-500)', marginBottom: 16 }}>
          Cantidad de electores habilitados por mesa, de la elección actual. Se carga a mano,
          mesa por mesa.
        </p>

        {mesas.length === 0 ? (
          <div className="empty"><div className="empty-icon">🪑</div><p>No hay mesas cargadas</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Mesa</th><th>Establecimiento</th><th>Corte de mesa</th><th></th></tr>
              </thead>
              <tbody>
                {mesas.map((m) => (
                  <tr key={m.id}>
                    <td><strong>{m.numero}</strong></td>
                    <td>{m.establecimiento_nombre}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        className="form-control"
                        style={{ width: 120 }}
                        value={cortes[m.id] ?? 0}
                        onChange={(e) => setCortes({ ...cortes, [m.id]: e.target.value })}
                      />
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleSaveCorte(m)}
                        disabled={savingMesa === m.id}
                      >
                        {savingMesa === m.id ? 'Guardando...' : 'Guardar'}
                      </button>
                    </td>
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
