import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import JsBarcode from 'jsbarcode';
import { usePadronImprimir } from '../hooks/useApi';
import { formatFecha, Encabezado } from './PadronComun';
import './PadronComun.css';
import './PadronImprimir.css';

// El alto disponible se mide en tiempo real (ver más abajo), así que este
// número ya no es una apuesta a ciegas: como la cuenta se hace con el alto
// que el propio navegador terminó renderizando, nunca se pasa del papel
// aunque el objetivo esté cerca del límite físico de 14in. Se deja apenas
// un colchón chico (no la pulgada entera de antes) para usar mejor la hoja.
const PAGE_HEIGHT_PX = Math.round(13.8 * 96);
const FOOTER_HEIGHT_PX = 14;

function FotoPlaceholder() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" />
    </svg>
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
          <div>{municipio?.junta_electoral_nombre || 'JUNTA ELECTORAL MUNICIPAL'}</div>
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
  const [porHoja, setPorHoja] = useState(null);
  const probeRef = useRef(null);

  useEffect(() => {
    setData(null);
    setPorHoja(null);
    setLoading(true);
    get(mesaId)
      .then((r) => setData(r.data))
      .catch(() => setError('Error cargando el padrón de esta mesa'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesaId]);

  // Se mide el alto real ya renderizado del encabezado y de una ficha (con
  // los datos reales, no un valor fijo a ojo) para calcular cuántas fichas
  // entran por hoja. Así se adapta solo a la fuente/renderizado de cada
  // navegador en vez de asumir un número que después no coincide.
  useLayoutEffect(() => {
    if (!data || porHoja || data.electores.length === 0) return;
    const encabezado = probeRef.current?.querySelector('.padron-encabezado');
    const fila = probeRef.current?.querySelector('.padron-fila');
    if (!encabezado || !fila) return;
    const encabezadoH = encabezado.getBoundingClientRect().height;
    const filaH = fila.getBoundingClientRect().height;
    const disponible = PAGE_HEIGHT_PX - encabezadoH - FOOTER_HEIGHT_PX;
    setPorHoja(Math.max(1, Math.floor(disponible / filaH)));
  }, [data, porHoja]);

  if (loading) return <div className="spinner" style={{ marginTop: 80 }} />;
  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!data) return null;

  const { mesa, municipio, eleccion, electores } = data;

  if (electores.length > 0 && !porHoja) {
    return (
      <div ref={probeRef} style={{ position: 'absolute', visibility: 'hidden', left: -9999, top: 0 }}>
        <div className="padron-hoja">
          <Encabezado mesa={mesa} municipio={municipio} eleccion={eleccion} />
          <Ticket elector={electores[0]} mesa={mesa} municipio={municipio} eleccion={eleccion} />
        </div>
      </div>
    );
  }

  const hojas = [];
  const tamanoHoja = porHoja || 1;
  for (let i = 0; i < electores.length; i += tamanoHoja) {
    hojas.push(electores.slice(i, i + tamanoHoja));
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
