import { useState, useEffect } from 'react';
import { useMunicipios, useMesas, useElecciones } from '../hooks/useApi';
import { useMunicipio } from '../context/MunicipioContext';
import { useEleccion } from '../context/EleccionContext';

// Datos variables que antes estaban fijos en el código de la Constancia de
// Emisión de Voto (y que van a reusarse en otras actas): el encabezado de
// la Junta Electoral, la fecha/nombre de la elección, y el corte de mesa
// (cuántos electores tiene cada mesa), que hoy se carga a mano mesa por
// mesa.

export default function Configuracion() {
  const { get: getMunicipio, update: updateMunicipio } = useMunicipios();
  const { list: listMesas, update: updateMesa } = useMesas();
  const { get: getEleccion, update: updateEleccion } = useElecciones();
  const { selectedId: municipioId } = useMunicipio();
  const { selectedId: eleccionId } = useEleccion();

  const [municipio, setMunicipio]     = useState(null);
  const [juntaNombre, setJuntaNombre] = useState('');
  const [savingJunta, setSavingJunta] = useState(false);

  const [eleccionNombre, setEleccionNombre] = useState('');
  const [eleccionFecha, setEleccionFecha]   = useState('');
  const [savingEleccion, setSavingEleccion] = useState(false);

  const [mesas, setMesas]         = useState([]);
  const [cortes, setCortes]       = useState({}); // mesaId -> valor en edición
  const [savingMesa, setSavingMesa] = useState(null); // mesaId que se está guardando

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const load = () => {
    if (!municipioId) return Promise.resolve();
    const pedidos = [getMunicipio(municipioId), listMesas()];
    if (eleccionId) pedidos.push(getEleccion(eleccionId));
    return Promise.all(pedidos).then(([m, ms, e]) => {
      setMunicipio(m.data);
      setJuntaNombre(m.data.junta_electoral_nombre || '');
      setMesas(ms.data);
      const iniciales = {};
      ms.data.forEach((mesa) => { iniciales[mesa.id] = mesa.electores_habilitados ?? 0; });
      setCortes(iniciales);
      if (e) {
        setEleccionNombre(e.data.nombre || '');
        setEleccionFecha(e.data.fecha || '');
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
      await updateEleccion(eleccionId, { nombre: eleccionNombre, fecha: eleccionFecha || null });
      notify('Elección actualizada');
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSavingEleccion(false);
    }
  };

  const handleSaveJunta = async () => {
    if (!municipio) return;
    setSavingJunta(true);
    setError('');
    try {
      await updateMunicipio(municipio.id, {
        nombre: municipio.nombre,
        provincia: municipio.provincia,
        seccion_electoral: municipio.seccion_electoral,
        activo: municipio.activo,
        junta_electoral_nombre: juntaNombre,
      });
      notify('Nombre de la Junta Electoral actualizado');
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSavingJunta(false);
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

  if (loading) return <div className="spinner" style={{ marginTop: 80 }} />;

  return (
    <div>
      {error   && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Elección</h3>
        <p style={{ fontSize: '.85rem', color: 'var(--gray-500)', marginBottom: 16 }}>
          Nombre y fecha de la elección actualmente seleccionada (arriba, en el selector del
          costado). Se muestran tanto en el encabezado del padrón como en el troquel de la
          Constancia de Emisión de Voto.
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
            <button className="btn btn-primary" onClick={handleSaveEleccion} disabled={savingEleccion}>
              {savingEleccion ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        )}
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Junta Electoral</h3>
        <p style={{ fontSize: '.85rem', color: 'var(--gray-500)', marginBottom: 16 }}>
          Texto que encabeza el troquel de la Constancia de Emisión de Voto (y de las próximas
          actas que reusen el mismo encabezado), para este municipio.
        </p>
        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Nombre de la Junta Electoral</label>
            <input
              className="form-control"
              value={juntaNombre}
              onChange={(e) => setJuntaNombre(e.target.value)}
              placeholder="Ej: Junta Electoral Municipal"
            />
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleSaveJunta} disabled={savingJunta}>
          {savingJunta ? 'Guardando...' : 'Guardar'}
        </button>
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
