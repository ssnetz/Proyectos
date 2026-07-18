import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePadronImprimir } from '../hooks/useApi';
import './PadronImprimir.css';

const POR_HOJA = 8;

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
(LC) LIBRETA CUADRUPLICADA / (LS,L6,...) LIBRETA QUINT.,SEXT.,... / (DNI) DOC.NAC.DE IDENTIDAD /
(DNID) DOC.NAC.DE IDENTIDAD DUPLICADO / (DNIT) DOC.NAC.DE IDENTIDAD TRIPLICADO / (DNIC) DOC.NAC.DE IDENTIDAD CUADRUPLICADO /
(DNIS,DNI6,...) DOC.NAC.DE IDENT. QUINT.,SEXT.,... / (DNIA,DNIB,...) DOC.NAC.DE IDENT. EJEMPLAR A,B,.... /
(DNI-EA,DNI-EB,...) DOC.NAC.DE IDENT. EJEMPLAR "A","B"...`;

function FotoPlaceholder() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" />
    </svg>
  );
}

function Ticket({ elector, mesa, municipio, eleccion }) {
  return (
    <div className="padron-fila">
      <div className="padron-mitad-izq">
        <div className="padron-nombre">{elector.apellido}, {elector.nombre}</div>
        <div className="padron-domicilio">{elector.domicilio || ''}</div>
        <div className="padron-orden-doc">
          <div>ORDEN <strong>{elector.orden ?? '—'}</strong></div>
          <div>DOC <strong>{elector.documento}</strong></div>
          <div><strong>{elector.tipo || ''}</strong></div>
        </div>
        <div className="padron-detalle">
          <div className="padron-foto"><FotoPlaceholder /></div>
          <div className="padron-obs">
            <div className="padron-obs-label">OBSERVACIONES</div>
            <div className="padron-obs-box" />
          </div>
        </div>
        <div className="padron-firma">FIRMA DEL VOTANTE</div>
      </div>

      <div className="padron-mitad-der">
        <div className="padron-der-header">
          <div>JUNTA ELECTORAL MUNICIPAL</div>
          <div>{(eleccion?.nombre || '').toUpperCase()}<br />{formatFecha(eleccion?.fecha)}</div>
        </div>
        <div className="padron-constancia-title">CONSTANCIA DE EMISIÓN DE VOTO</div>
        <div className="padron-nro-orden">
          <div>NRO ORDEN<br /><strong>{elector.orden ?? '—'}</strong></div>
          <div className="padron-barcode">{elector.documento}</div>
        </div>
        <div className="padron-nombre-der">{elector.apellido}, {elector.nombre}</div>
        <div className="padron-datos-der"><div>DOCUMENTO</div><div>{elector.documento}</div></div>
        <div className="padron-datos-der"><div>DISTRITO</div><div>{municipio?.provincia || ''}</div></div>
        <div className="padron-datos-der"><div>SECCION</div><div>{municipio?.seccion_electoral || ''}</div></div>
        <div className="padron-datos-der"><div>CIRC.</div><div>{mesa?.circuito || ''}</div></div>
        <div className="padron-mesa-autoridad">
          <div className="mesa-label">MESA</div>
          <div className="mesa-valor">{mesa?.numero}</div>
          <div className="autoridad">AUTORIDAD DE MESA</div>
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
  for (let i = 0; i < electores.length; i += POR_HOJA) {
    hojas.push(electores.slice(i, i + POR_HOJA));
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
            <div className="padron-encabezado">
              <div className="padron-leyenda">{LEYENDA}</div>
              <div className="padron-titulo">
                <h1>PADRON ELECTORAL</h1>
                <div className="padron-mesa-badge">MESA<br />{String(mesa.numero).padStart(3, '0')}</div>
                <div className="eleccion-nombre">
                  {(eleccion?.nombre || '').toUpperCase()}<br />{formatFecha(eleccion?.fecha)}
                </div>
              </div>
              <div className="padron-seccional">
                SECCIONAL ELECTORAL<br />
                {municipio?.seccion_electoral}<br />
                CIRCUITO {mesa.circuito}<br />
                {(municipio?.nombre || '').toUpperCase()}
              </div>
            </div>

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
