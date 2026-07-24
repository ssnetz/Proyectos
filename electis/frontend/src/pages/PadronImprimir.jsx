import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import JsBarcode from 'jsbarcode';
import { usePadronImprimir } from '../hooks/useApi';
import './PadronImprimir.css';

// Se imprime siempre sobre una hoja troquelada (papel pre-cortado con 8
// posiciones fijas): a diferencia de PadronSinTroquel, acá NO se puede medir
// el alto renderizado para decidir cuántos electores entran por hoja — el
// troquel es un corte físico fijo, y un cálculo dinámico que dé 7 o 9 por
// cualquier variación de fuente/navegador desalinearía todo el impreso
// contra el papel. Este número no cambia nunca.
const ELECTORES_POR_HOJA = 8;

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function formatFecha(fecha) {
  if (!fecha) return '';
  const [y, m, d] = fecha.split('-').map(Number);
  return `${d} DE ${MESES[m - 1].toUpperCase()} DE ${y}`;
}

const LEYENDA = `(*) NO SABE LEER NI ESCRIBIR / (F,M) FEMENINO, MASCULINO / (LD) LIBRETA DUPLICADA / (LT) LIBRETA TRIPLICADA /
(LC) LIBRETA CUADRUPLICADA / (DNI) DOC.NAC.DE IDENTIDAD / (DNID,DNIT,DNIC) DOC.NAC.DE IDENTIDAD DUP./TRIP./CUADRUP. /
(DNI-EA,DNI-EB,...) DOC.NAC.DE IDENT. EJEMPLAR "A","B"...`;

function FotoPlaceholder() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" />
    </svg>
  );
}

function Encabezado({ mesa, municipio, eleccion }) {
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

function Barcode({ value }) {
  const svgRef = useRef(null);

  useLayoutEffect(() => {
    if (!svgRef.current || !value) return;
    JsBarcode(svgRef.current, value, {
      format: 'CODE128',
      displayValue: false,
      margin: 0,
      height: 16,
      width: 1.1,
    });
  }, [value]);

  return <svg ref={svgRef} className="padron-barcode-svg" />;
}

function Ticket({ elector, mesa, municipio, eleccion }) {
  const habilitado = elector.habilitado === undefined || elector.habilitado === null
    ? true
    : !!Number(elector.habilitado);
  const esInhabilitadoAuto = !habilitado
    && (!elector.observaciones || elector.observaciones.trim().toLowerCase() === 'elector inhabilitado');
  const observacionCustom = elector.observaciones && !esInhabilitadoAuto ? elector.observaciones : '';

  return (
    <div className="padron-fila">
      <div className="padron-mitad-izq">
        <div className="padron-nombre">{elector.apellido}, {elector.nombre}</div>
        <div className="padron-domicilio">{elector.domicilio || ''}</div>
        <div className="padron-orden-doc">
          <div>ORDEN <strong>{elector.orden ?? '—'}</strong></div>
          <div>DOC <strong>{elector.documento}</strong></div>
          <div className="col-tipo"><strong>{elector.tipo || ''}</strong></div>
          <div className="col-clase"><strong>{elector.fecha_nacimiento ? elector.fecha_nacimiento.slice(0, 4) : ''}</strong></div>
        </div>
        <div className="padron-detalle">
          <div className="padron-foto"><FotoPlaceholder /></div>
          <div className="padron-obs">
            <div className="padron-col-label">OBSERVACIONES</div>
            <div className={`padron-obs-box${habilitado ? '' : ' padron-obs-box-inhabilitado'}`}>
              {esInhabilitadoAuto && (
                <span className="padron-obs-inhabilitado">ELECTOR<br />INHABILITADO</span>
              )}
              {observacionCustom && <span className="padron-obs-texto">{observacionCustom}</span>}
            </div>
          </div>
          <div className="padron-firma-col">
            <div className="padron-col-label">FIRMA DEL VOTANTE</div>
            <div className="padron-firma-box" />
          </div>
        </div>
      </div>

      <div className="padron-mitad-der">
        <div className="padron-der-header">
          <div>JUNTA ELECTORAL MUNICIPAL</div>
          <div>{(eleccion?.nombre || '').toUpperCase()} — {formatFecha(eleccion?.fecha)}</div>
        </div>
        <div className="padron-constancia-title">CONSTANCIA DE EMISIÓN DE VOTO</div>
        <div className="padron-nro-orden">
          <div>NRO ORDEN: <strong>{elector.orden ?? '—'}</strong></div>
          <div className="padron-barcode"><Barcode value={elector.documento} /></div>
        </div>
        <div className="padron-nombre-der">{elector.apellido}, {elector.nombre}</div>
        <div className="padron-datos-der"><div>DOCUMENTO</div><div>{elector.documento}</div></div>
        <div className="padron-datos-der"><div>DISTRITO</div><div>{municipio?.provincia || ''}</div></div>
        <div className="padron-datos-der"><div>SECCION</div><div>{municipio?.seccion_electoral || ''}</div></div>
        <div className="padron-circ-mesa">
          <div>CIRC.</div><div>{mesa?.circuito || ''}</div>
          <div>MESA</div><div>{mesa?.numero}</div>
        </div>
        <div className="padron-mesa-autoridad">
          <div className="autoridad-box" />
          <div className="padron-col-label">FIRMA<br />AUTORIDAD<br />DE MESA</div>
        </div>
      </div>
    </div>
  );
}

export default function PadronImprimir() {
  const { mesaId } = useParams();
  const navigate = useNavigate();
  const { get } = usePadronImprimir();

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    setData(null);
    setLoading(true);
    get(mesaId)
      .then((r) => setData(r.data))
      .catch(() => setError('Error cargando el padrón de esta mesa'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesaId]);

  if (loading) return <div className="spinner" style={{ marginTop: 80 }} />;
  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!data) return null;

  const { mesa, municipio, eleccion, electores } = data;

  const hojas = [];
  for (let i = 0; i < electores.length; i += ELECTORES_POR_HOJA) {
    hojas.push(electores.slice(i, i + ELECTORES_POR_HOJA));
  }
  if (hojas.length === 0) hojas.push([]);

  return (
    <div>
      <div className="padron-toolbar">
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>← Volver</button>
        <button className="btn btn-primary" onClick={() => window.print()}>🖨️ Imprimir</button>
        <span style={{ color: 'var(--gray-500)', fontSize: '.85rem' }}>
          Mesa {mesa.numero} — {mesa.establecimiento_nombre} — {electores.length} electores — {hojas.length} hoja{hojas.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="padron-imprimible">
        {hojas.map((grupo, i) => (
          <div className="padron-hoja" key={i}>
            <Encabezado mesa={mesa} municipio={municipio} eleccion={eleccion} />

            {grupo.map((elector) => (
              <Ticket key={elector.documento} elector={elector} mesa={mesa} municipio={municipio} eleccion={eleccion} />
            ))}

            <div className="padron-pie">Hoja {i + 1} de {hojas.length}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
