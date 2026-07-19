import { useState, useEffect, useRef } from 'react';
import { useEstablecimientos, useMesas, useElectores } from '../hooks/useApi';
import VotacionGrilla from '../components/VotacionGrilla';
import './Votacion.css';

// Cada cuánto se refresca sola la grilla mientras está abierta, para reflejar
// los votos que van marcando otros (el fiscal desde el celular, u otro
// operador viendo la misma mesa) sin depender de recargar la página a mano.
const POLL_MS = 4000;

export default function Votacion() {
  const { list: listEstablecimientos } = useEstablecimientos();
  const { list: listMesas } = useMesas();
  const { list: listElectores, update } = useElectores();

  const [establecimientos, setEstablecimientos] = useState([]);
  const [mesas, setMesas]                       = useState([]);
  const [electores, setElectores]               = useState([]);

  const [establecimientoId, setEstablecimientoId] = useState('');
  const [mesaId, setMesaId]                       = useState('');

  const [loadingMesas, setLoadingMesas]         = useState(false);
  const [loadingElectores, setLoadingElectores] = useState(false);
  const [error, setError]                       = useState('');

  // Electores con un toggle en curso: al mezclar los datos que trae el
  // polling no se pisa su estado local optimista hasta que la propia
  // respuesta del click vuelva.
  const pendingRef = useRef(new Set());

  useEffect(() => {
    listEstablecimientos().then((r) => setEstablecimientos(r.data)).catch(() => setError('Error cargando establecimientos'));
  }, []);

  useEffect(() => {
    setMesaId('');
    setElectores([]);
    if (!establecimientoId) { setMesas([]); return; }
    setLoadingMesas(true);
    listMesas({ establecimiento_id: establecimientoId })
      .then((r) => setMesas(r.data))
      .catch(() => setError('Error cargando mesas'))
      .finally(() => setLoadingMesas(false));
  }, [establecimientoId]);

  useEffect(() => {
    if (!mesaId) { setElectores([]); return; }
    setLoadingElectores(true);
    setError('');
    listElectores({ mesa_id: mesaId, todos: 1 })
      .then((r) => setElectores(r.data.data))
      .catch(() => setError('Error cargando los electores de la mesa'))
      .finally(() => setLoadingElectores(false));

    const interval = setInterval(() => {
      listElectores({ mesa_id: mesaId, todos: 1 })
        .then((r) => {
          setElectores((prev) => {
            const prevById = new Map(prev.map((e) => [e.id, e]));
            return r.data.data.map((e) => (pendingRef.current.has(e.id) ? prevById.get(e.id) ?? e : e));
          });
        })
        .catch(() => {}); // silencioso: no interrumpir la grilla por un refresh fallido
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [mesaId]);

  const toggleVoto = async (elector) => {
    const habilitado = elector.habilitado === undefined ? true : !!Number(elector.habilitado);
    if (!habilitado) return;

    const nuevoVotado = Number(elector.votado) ? 0 : 1;
    pendingRef.current.add(elector.id);
    setElectores((prev) => prev.map((e) => (e.id === elector.id ? { ...e, votado: nuevoVotado } : e)));
    try {
      await update(elector.id, { votado: nuevoVotado });
    } catch (err) {
      // Si falla, se revierte el cambio optimista.
      setElectores((prev) => prev.map((e) => (e.id === elector.id ? { ...e, votado: elector.votado } : e)));
      setError(err.response?.data?.error || 'Error al actualizar el voto');
    } finally {
      pendingRef.current.delete(elector.id);
    }
  };

  return (
    <div>
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        <div className="votacion-filtros">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Establecimiento</label>
            <select className="form-control" value={establecimientoId} onChange={(e) => setEstablecimientoId(e.target.value)}>
              <option value="">Elegí un establecimiento...</option>
              {establecimientos.map((es) => (
                <option key={es.id} value={es.id}>{es.nombre}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Mesa</label>
            <select
              className="form-control"
              value={mesaId}
              onChange={(e) => setMesaId(e.target.value)}
              disabled={!establecimientoId || loadingMesas}
            >
              <option value="">{loadingMesas ? 'Cargando...' : 'Elegí una mesa...'}</option>
              {mesas.map((m) => (
                <option key={m.id} value={m.id}>Mesa {m.numero}</option>
              ))}
            </select>
          </div>
        </div>

        {loadingElectores ? (
          <div className="spinner" style={{ marginTop: 40 }} />
        ) : !mesaId ? (
          <div className="empty"><div className="empty-icon">✅</div><p>Elegí un establecimiento y una mesa para ver la grilla de votación</p></div>
        ) : (
          <VotacionGrilla electores={electores} onToggle={toggleVoto} />
        )}
      </div>
    </div>
  );
}
