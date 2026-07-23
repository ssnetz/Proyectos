import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePadronImprimir } from '../hooks/useApi';
import { Encabezado } from './PadronComun';
import './PadronComun.css';
import './PadronSinTroquel.css';

// Listado simple del padrón por mesa, sin la constancia de emisión de voto
// troquelada (igual al modelo "PADRONES_SIN_TROQUEL"): una fila angosta por
// elector en vez de la ficha de media hoja de PadronImprimir, así entran
// muchos más electores por página. Comparte hoja y encabezado con
// PadronImprimir (ver PadronComun); solo cambia el cuerpo.
const PAGE_HEIGHT_PX = Math.round(13.8 * 96);
const FOOTER_HEIGHT_PX = 14;

// Argentina no usa punto de miles en el DNI de un elector individual en el
// padrón oficial, pero el listado sin troquel sí lo trae así en el modelo
// (ej. "28.023.579").
function formatDocumento(doc) {
  const s = String(doc ?? '');
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function Fila({ elector }) {
  const habilitado = elector.habilitado === undefined || elector.habilitado === null
    ? true
    : !!Number(elector.habilitado);
  const esInhabilitadoAuto = !habilitado
    && (!elector.observaciones || elector.observaciones.trim().toLowerCase() === 'elector inhabilitado');
  const observacionCustom = elector.observaciones && !esInhabilitadoAuto ? elector.observaciones : '';

  const datos = [elector.apellido, elector.nombre].filter(Boolean).join(' ')
    + (elector.domicilio ? `, ${elector.domicilio}` : '')
    + (elector.tipo ? `, ${elector.tipo}` : '');

  return (
    <tr className="lista-fila">
      <td className="lista-col-orden">{elector.orden ?? '—'}</td>
      <td className="lista-col-matricula">{formatDocumento(elector.documento)}</td>
      <td className="lista-col-voto" />
      <td>
        {datos}
        {esInhabilitadoAuto && <span className="lista-inhabilitado"> — ELECTOR INHABILITADO</span>}
        {observacionCustom && <span className="lista-inhabilitado"> — {observacionCustom}</span>}
      </td>
    </tr>
  );
}

function Tabla({ electores }) {
  return (
    <table className="lista-tabla">
      <thead>
        <tr>
          <th className="lista-col-orden">Nro Orden</th>
          <th className="lista-col-matricula">Nro Matrícula</th>
          <th className="lista-col-voto">Voto</th>
          <th>Apellido Nombres, Domicilio, Tipo Matrícula</th>
        </tr>
      </thead>
      <tbody>
        {electores.map((e) => <Fila key={e.documento} elector={e} />)}
      </tbody>
    </table>
  );
}

export default function PadronSinTroquel() {
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

  // Igual que en PadronImprimir: se mide el alto real ya renderizado (con
  // los datos reales) del encabezado + fila de título de la tabla, y de una
  // fila de datos, para calcular cuántas filas entran por hoja.
  useLayoutEffect(() => {
    if (!data || porHoja || data.electores.length === 0) return;
    const encabezado = probeRef.current?.querySelector('.padron-encabezado');
    const thead = probeRef.current?.querySelector('thead');
    const fila = probeRef.current?.querySelector('.lista-fila');
    if (!encabezado || !thead || !fila) return;
    const cabeceraH = encabezado.getBoundingClientRect().height + thead.getBoundingClientRect().height;
    const filaH = fila.getBoundingClientRect().height;
    const disponible = PAGE_HEIGHT_PX - cabeceraH - FOOTER_HEIGHT_PX;
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
          <Tabla electores={[electores[0]]} />
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
            <Tabla electores={grupo} />
            <div className="padron-pie">Hoja {i + 1} de {hojas.length}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
