// Piezas compartidas entre las dos vistas imprimibles del padrón por mesa:
// PadronImprimir (con troquel/constancia) y PadronSinTroquel (listado simple).
// Ambas usan la misma hoja oficio/legal y el mismo encabezado.

export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function formatFecha(fecha) {
  if (!fecha) return '';
  const [y, m, d] = fecha.split('-').map(Number);
  return `${d} DE ${MESES[m - 1].toUpperCase()} DE ${y}`;
}

export const LEYENDA = `(*) NO SABE LEER NI ESCRIBIR / (F,M) FEMENINO, MASCULINO / (LD) LIBRETA DUPLICADA / (LT) LIBRETA TRIPLICADA /
(LC) LIBRETA CUADRUPLICADA / (DNI) DOC.NAC.DE IDENTIDAD / (DNID,DNIT,DNIC) DOC.NAC.DE IDENTIDAD DUP./TRIP./CUADRUP. /
(DNI-EA,DNI-EB,...) DOC.NAC.DE IDENT. EJEMPLAR "A","B"...`;

export function Encabezado({ mesa, municipio, eleccion }) {
  return (
    <div className="padron-encabezado">
      <div className="padron-leyenda">{LEYENDA}</div>
      <div className="padron-titulo">
        <div className="padron-titulo-linea1">
          PADRON ELECTORAL <span className="padron-mesa-badge">MESA {String(mesa.numero).padStart(3, '0')}</span>
        </div>
        <div className="padron-titulo-linea2">
          {(eleccion?.nombre || '').toUpperCase()} — {formatFecha(eleccion?.fecha)}
        </div>
      </div>
      <div className="padron-seccional">
        SECCIONAL ELECTORAL {municipio?.seccion_electoral} · CIRCUITO {mesa.circuito}<br />
        {(municipio?.nombre || '').toUpperCase()}
      </div>
    </div>
  );
}
