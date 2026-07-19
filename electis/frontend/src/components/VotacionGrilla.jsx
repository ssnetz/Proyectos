import '../pages/Votacion.css';

export default function VotacionGrilla({ electores, onToggle, showResumen = true }) {
  if (electores.length === 0) {
    return <div className="empty"><div className="empty-icon">👥</div><p>Esta mesa no tiene electores cargados</p></div>;
  }

  const habilitados = electores.filter((e) => e.habilitado === undefined || !!Number(e.habilitado));
  const votaron = habilitados.filter((e) => Number(e.votado)).length;
  const porcentaje = habilitados.length > 0 ? Math.round((votaron / habilitados.length) * 100) : 0;

  return (
    <>
      {showResumen && (
        <div className="votacion-resumen votacion-resumen-standalone">
          <span className="badge badge-blue">{porcentaje}% votó</span>
          <span className="badge badge-green">{votaron} votaron</span>
          <span className="badge badge-gray">{habilitados.length} habilitados</span>
        </div>
      )}
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
              onClick={() => onToggle(e)}
              disabled={!habilitado}
              title={`${e.apellido}, ${e.nombre}${!habilitado ? ' — Elector inhabilitado' : ''}`}
            >
              {e.orden ?? '—'}
            </button>
          );
        })}
      </div>
    </>
  );
}
