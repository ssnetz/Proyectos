import { useState, useEffect } from 'react';
import { useEstablecimientos, useMesas, useElectores } from '../hooks/useApi';
import './Votacion.css';

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
  }, [mesaId]);

  const toggleVoto = async (elector) => {
    const habilitado = elector.habilitado === undefined ? true : !!Number(elector.habilitado);
    if (!habilitado) return;

    const nuevoVotado = Number(elector.votado) ? 0 : 1;
    setElectores((prev) => prev.map((e) => (e.id === elector.id ? { ...e, votado: nuevoVotado } : e)));
    try {
      await update(elector.id, { votado: nuevoVotado });
    } catch (err) {
      // Si falla, se revierte el cambio optimista.
      setElectores((prev) => prev.map((e) => (e.id === elector.id ? { ...e, votado: elector.votado } : e)));
      setError(err.response?.data?.error || 'Error al actualizar el voto');
    }
  };

  const habilitados = electores.filter((e) => e.habilitado === undefined || !!Number(e.habilitado));
  const votaron = habilitados.filter((e) => Number(e.votado)).length;

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
          {mesaId && !loadingElectores && (
            <div className="votacion-resumen">
              <span className="badge badge-green">{votaron} votaron</span>
              <span className="badge badge-gray">{habilitados.length} habilitados</span>
            </div>
          )}
        </div>

        {loadingElectores ? (
          <div className="spinner" style={{ marginTop: 40 }} />
        ) : !mesaId ? (
          <div className="empty"><div className="empty-icon">✅</div><p>Elegí un establecimiento y una mesa para ver la grilla de votación</p></div>
        ) : electores.length === 0 ? (
          <div className="empty"><div className="empty-icon">👥</div><p>Esta mesa no tiene electores cargados</p></div>
        ) : (
          <>
            <div className="votacion-leyenda">
              <span><i className="votacion-swatch votacion-swatch-no" /> No votó</span>
              <span><i className="votacion-swatch votacion-swatch-si" /> Votó</span>
              <span><i className="votacion-swatch votacion-swatch-inhabilitado" /> Inhabilitado</span>
            </div>
            <div className="votacion-grilla">
              {electores.map((e) => {
                const habilitado = e.habilitado === undefined ? true : !!Number(e.habilitado);
                const votado = !!Number(e.votado);
                const clase = !habilitado ? 'inhabilitado' : votado ? 'votado' : 'no-votado';
                return (
                  <button
                    key={e.id}
                    className={`votacion-tile votacion-tile-${clase}`}
                    onClick={() => toggleVoto(e)}
                    disabled={!habilitado}
                    title={`${e.apellido}, ${e.nombre}${!habilitado ? ' — Elector inhabilitado' : ''}`}
                  >
                    {e.orden ?? '—'}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
