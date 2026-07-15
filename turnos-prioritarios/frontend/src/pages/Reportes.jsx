import { useState, useEffect, useMemo } from 'react';
import { useTurnos, useProfesionales, useInstituciones } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { generarReportePDF, generarListadoProfesionalesPDF } from '../utils/pdfReportes';

const prioridadBadge = { alta: 'badge-red', media: 'badge-yellow', baja: 'badge-gray' };
const estadoBadge = { pendiente: 'badge-yellow', confirmado: 'badge-blue', atendido: 'badge-green', cancelado: 'badge-red' };
const estadoDescripciones = {
  pendiente: 'Turnos pendientes', confirmado: 'Turnos confirmados',
  atendido: 'Turnos atendidos', cancelado: 'Turnos cancelados', todos: 'Todos los turnos',
};

function addDias(iso, dias) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export default function Reportes() {
  const { list: listTurnos } = useTurnos();
  const { list: listProfesionales } = useProfesionales();
  const { list: listInstituciones } = useInstituciones();
  const { user } = useAuth();

  const today = new Date().toISOString().slice(0, 10);

  const [profesionales, setProfesionales] = useState([]);
  const [instituciones, setInstituciones] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generando, setGenerando] = useState(false);

  const [agruparPor, setAgruparPor] = useState('profesional');
  const [profesionalId, setProfesionalId] = useState('');
  const [especialidad, setEspecialidad] = useState('');
  const [institucionId, setInstitucionId] = useState('');
  const [estado, setEstado] = useState('pendiente');
  const [desde, setDesde] = useState(today);
  const [hasta, setHasta] = useState(addDias(today, 30));

  const [profQ, setProfQ] = useState('');
  const [profEspecialidad, setProfEspecialidad] = useState('');
  const [profSoloActivos, setProfSoloActivos] = useState(true);
  const [generandoProf, setGenerandoProf] = useState(false);

  useEffect(() => {
    Promise.all([listProfesionales(), listInstituciones()])
      .then(([p, i]) => { setProfesionales(p.data); setInstituciones(i.data); })
      .catch(() => setError('Error cargando datos base'));
  }, []);

  const especialidades = useMemo(() => {
    const set = new Set(profesionales.map((p) => p.especialidad).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [profesionales]);

  const cargar = () => {
    if (!desde || !hasta) return;
    const params = { desde, hasta };
    if (estado !== 'todos') params.estado = estado;
    if (agruparPor === 'profesional' && profesionalId) params.profesional_id = profesionalId;
    if (agruparPor === 'especialidad' && especialidad) params.especialidad = especialidad;
    if (institucionId) params.institucion_id = institucionId;

    setLoading(true);
    setError('');
    listTurnos(params)
      .then((r) => setTurnos(r.data))
      .catch(() => setError('Error cargando turnos'))
      .finally(() => setLoading(false));
  };

  useEffect(cargar, [agruparPor, profesionalId, especialidad, institucionId, estado, desde, hasta]);

  const grupos = useMemo(() => {
    const map = new Map();
    for (const t of turnos) {
      const key = agruparPor === 'especialidad' ? (t.profesional_especialidad || 'Sin especialidad') : `${t.profesional_id}`;
      const titulo = agruparPor === 'especialidad'
        ? (t.profesional_especialidad || 'Sin especialidad')
        : `${t.profesional_apellidos}, ${t.profesional_nombres}`;
      if (!map.has(key)) map.set(key, { titulo, cantidad: 0 });
      map.get(key).cantidad++;
    }
    return [...map.values()].sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));
  }, [turnos, agruparPor]);

  const handleDescargar = () => {
    if (turnos.length === 0) { setError('No hay turnos para generar el reporte con estos filtros'); return; }
    setGenerando(true);
    setError('');
    try {
      generarReportePDF({
        turnos,
        agruparPor,
        desde,
        hasta,
        estadoDescripcion: estadoDescripciones[estado] || estadoDescripciones.todos,
        generadoPor: user?.username,
      });
    } catch (e) {
      setError('Error al generar el PDF');
    } finally {
      setGenerando(false);
    }
  };

  const profesionalesFiltrados = useMemo(() => {
    const q = profQ.trim().toLowerCase();
    return profesionales
      .filter((p) => {
        if (profSoloActivos && !Number(p.activo)) return false;
        if (profEspecialidad && p.especialidad !== profEspecialidad) return false;
        if (q) {
          const hay = `${p.apellidos} ${p.nombres} ${p.matricula} ${p.especialidad || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.apellidos.localeCompare(b.apellidos, 'es'));
  }, [profesionales, profQ, profEspecialidad, profSoloActivos]);

  const handleDescargarProfesionales = () => {
    if (profesionalesFiltrados.length === 0) { setError('No hay profesionales para generar el listado con estos filtros'); return; }
    setGenerandoProf(true);
    setError('');
    try {
      const partes = [profEspecialidad || 'Todas las especialidades', profSoloActivos ? 'Solo activos' : 'Activos e inactivos'];
      if (profQ.trim()) partes.push(`Búsqueda: "${profQ.trim()}"`);
      generarListadoProfesionalesPDF({
        profesionales: profesionalesFiltrados,
        filtroDescripcion: partes.join(' · '),
        generadoPor: user?.username,
      });
    } catch (e) {
      setError('Error al generar el PDF');
    } finally {
      setGenerandoProf(false);
    }
  };

  return (
    <div>
      {error && <div className="alert alert-danger">{error}</div>}

      <div style={{ fontSize: '.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--gray-400)', margin: '4px 0 10px' }}>
        Turnos prioritarios
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Reporte de turnos prioritarios</span>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Agrupar por</label>
            <select
              className="form-control"
              value={agruparPor}
              onChange={(e) => { setAgruparPor(e.target.value); setProfesionalId(''); setEspecialidad(''); }}
            >
              <option value="profesional">Profesional</option>
              <option value="especialidad">Especialidad</option>
            </select>
          </div>

          {agruparPor === 'profesional' ? (
            <div className="form-group">
              <label className="form-label">Profesional</label>
              <select className="form-control" value={profesionalId} onChange={(e) => setProfesionalId(e.target.value)}>
                <option value="">Todos los profesionales</option>
                {profesionales.map((p) => (
                  <option key={p.id} value={p.id}>{p.apellidos}, {p.nombres} — {p.especialidad}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Especialidad</label>
              <select className="form-control" value={especialidad} onChange={(e) => setEspecialidad(e.target.value)}>
                <option value="">Todas las especialidades</option>
                {especialidades.map((esp) => (
                  <option key={esp} value={esp}>{esp}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Institución</label>
            <select className="form-control" value={institucionId} onChange={(e) => setInstitucionId(e.target.value)}>
              <option value="">Todas las instituciones</option>
              {instituciones.map((i) => (
                <option key={i.id} value={i.id}>{i.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Desde</label>
            <input type="date" className="form-control" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Hasta</label>
            <input type="date" className="form-control" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Estado</label>
            <select className="form-control" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="pendiente">Pendientes</option>
              <option value="confirmado">Confirmados</option>
              <option value="atendido">Atendidos</option>
              <option value="cancelado">Cancelados</option>
              <option value="todos">Todos los estados</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-primary" onClick={handleDescargar} disabled={generando || loading || turnos.length === 0}>
            {generando ? 'Generando...' : '📄 Descargar PDF'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            Vista previa {!loading && `— ${turnos.length} turno${turnos.length === 1 ? '' : 's'} en ${grupos.length} grupo${grupos.length === 1 ? '' : 's'}`}
          </span>
        </div>

        {loading ? <div className="spinner" /> : turnos.length === 0 ? (
          <div className="empty"><div className="empty-icon">📄</div><p>No hay turnos para los filtros seleccionados</p></div>
        ) : (
          <>
            <div className="table-wrap" style={{ marginBottom: 20 }}>
              <table>
                <thead>
                  <tr><th>{agruparPor === 'especialidad' ? 'Especialidad' : 'Profesional'}</th><th>Cantidad de turnos</th></tr>
                </thead>
                <tbody>
                  {grupos.map((g) => (
                    <tr key={g.titulo}>
                      <td>{g.titulo}</td>
                      <td><span className="badge badge-blue">{g.cantidad}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th><th>Hora</th><th>Paciente</th><th>Profesional</th><th>Institución</th>
                    <th>Prioridad</th><th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {turnos.map((t) => (
                    <tr key={t.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{t.fecha}</td>
                      <td>{t.hora?.slice(0, 5)}</td>
                      <td>{t.persona_apellidos ? `${t.persona_apellidos}, ${t.persona_nombres}` : '—'}</td>
                      <td>{t.profesional_apellidos}, {t.profesional_nombres}<div style={{ fontSize: '.75rem', color: 'var(--gray-400)' }}>{t.profesional_especialidad}</div></td>
                      <td>{t.institucion_nombre}</td>
                      <td><span className={`badge ${prioridadBadge[t.prioridad]}`}>{t.prioridad}</span></td>
                      <td><span className={`badge ${estadoBadge[t.estado]}`}>{t.estado}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div style={{ fontSize: '.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--gray-400)', margin: '28px 0 10px' }}>
        Profesionales
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Listado de profesionales</span>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Buscar</label>
            <input
              className="form-control"
              placeholder="Apellido, nombre, matrícula o especialidad..."
              value={profQ}
              onChange={(e) => setProfQ(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Especialidad</label>
            <select className="form-control" value={profEspecialidad} onChange={(e) => setProfEspecialidad(e.target.value)}>
              <option value="">Todas las especialidades</option>
              {especialidades.map((esp) => (
                <option key={esp} value={esp}>{esp}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ justifyContent: 'flex-end' }}>
            <label className="form-label">&nbsp;</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, cursor: 'pointer' }}>
              <input type="checkbox" checked={profSoloActivos} onChange={(e) => setProfSoloActivos(e.target.checked)} />
              Solo profesionales activos
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button
            className="btn btn-primary"
            onClick={handleDescargarProfesionales}
            disabled={generandoProf || profesionalesFiltrados.length === 0}
          >
            {generandoProf ? 'Generando...' : '📄 Descargar PDF'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Vista previa — {profesionalesFiltrados.length} profesional{profesionalesFiltrados.length === 1 ? '' : 'es'}</span>
        </div>

        {profesionalesFiltrados.length === 0 ? (
          <div className="empty"><div className="empty-icon">🩺</div><p>No hay profesionales para los filtros seleccionados</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Apellidos</th><th>Nombres</th><th>Matrícula</th><th>Especialidad</th><th>Celular</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {profesionalesFiltrados.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.apellidos}</strong></td>
                    <td>{p.nombres}</td>
                    <td>{p.matricula}</td>
                    <td>{p.especialidad || '—'}</td>
                    <td>{p.celular || '—'}</td>
                    <td>{Number(p.activo) ? <span className="badge badge-green">Activo</span> : <span className="badge badge-red">Inactivo</span>}</td>
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
