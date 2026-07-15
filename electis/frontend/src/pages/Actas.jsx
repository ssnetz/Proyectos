import { useState, useEffect } from 'react';
import { useActas, useMesas, useListas } from '../hooks/useApi';
import Modal from '../components/Modal';

const estadoBadge = { pendiente: 'badge-yellow', cargada: 'badge-blue', validada: 'badge-green' };

const emptyTotales = {
  electores_votantes: '', votos_blanco: '', votos_nulos: '', votos_recurridos: '', votos_impugnados: '',
  observaciones: '', estado: 'cargada',
};

export default function Actas() {
  const { list: listActas, get: getActa, save: saveActa } = useActas();
  const { list: listMesas } = useMesas();
  const { list: listListas } = useListas();

  const [mesas, setMesas] = useState([]);
  const [listas, setListas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [modalMesa, setModalMesa] = useState(null);
  const [totales, setTotales] = useState(emptyTotales);
  const [votos, setVotos]     = useState({}); // { lista_id: cantidad }
  const [cargandoActa, setCargandoActa] = useState(false);
  const [saving, setSaving]   = useState(false);

  const load = () => Promise.all([listMesas(), listListas()])
    .then(([m, l]) => { setMesas(m.data); setListas(l.data.filter((x) => Number(x.activo))); });

  useEffect(() => {
    load().catch(() => setError('Error cargando datos')).finally(() => setLoading(false));
  }, []);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const cargosAgrupados = () => {
    const map = new Map();
    for (const l of listas) {
      if (!map.has(l.cargo_id)) map.set(l.cargo_id, { nombre: l.cargo_nombre, listas: [] });
      map.get(l.cargo_id).listas.push(l);
    }
    return [...map.values()];
  };

  const openActa = async (mesa) => {
    setModalMesa(mesa);
    setError('');
    setTotales(emptyTotales);
    setVotos({});
    setCargandoActa(true);
    try {
      const r = await listActas({ mesa_id: mesa.id });
      if (r.data.length > 0) {
        const detalle = await getActa(r.data[0].id);
        const a = detalle.data;
        setTotales({
          electores_votantes: a.electores_votantes,
          votos_blanco: a.votos_blanco,
          votos_nulos: a.votos_nulos,
          votos_recurridos: a.votos_recurridos,
          votos_impugnados: a.votos_impugnados,
          observaciones: a.observaciones || '',
          estado: a.estado,
        });
        const votosMap = {};
        a.votos.forEach((v) => { votosMap[v.lista_id] = v.votos; });
        setVotos(votosMap);
      }
    } catch (e) {
      setError('Error cargando el acta de esta mesa');
    } finally {
      setCargandoActa(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await saveActa({
        mesa_id: modalMesa.id,
        electores_votantes: totales.electores_votantes || 0,
        votos_blanco: totales.votos_blanco || 0,
        votos_nulos: totales.votos_nulos || 0,
        votos_recurridos: totales.votos_recurridos || 0,
        votos_impugnados: totales.votos_impugnados || 0,
        observaciones: totales.observaciones,
        estado: totales.estado,
        votos: listas.map((l) => ({ lista_id: l.id, votos: votos[l.id] || 0 })),
      });
      notify(`Acta de la mesa ${modalMesa.numero} guardada`);
      setModalMesa(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar el acta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {error   && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Actas por mesa</span>
        </div>

        {loading ? <div className="spinner" /> : mesas.length === 0 ? (
          <div className="empty"><div className="empty-icon">🗳️</div><p>No hay mesas cargadas todavía</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Mesa</th><th>Establecimiento</th><th>Electores habilitados</th><th>Estado del acta</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {mesas.map((m) => (
                  <tr key={m.id}>
                    <td><strong>{m.numero}</strong></td>
                    <td>{m.establecimiento_nombre}</td>
                    <td>{m.electores_habilitados}</td>
                    <td><span className={`badge ${estadoBadge[m.acta_estado] || 'badge-gray'}`}>{m.acta_estado || 'sin cargar'}</span></td>
                    <td>
                      <button className="btn btn-primary btn-sm" onClick={() => openActa(m)}>
                        {m.acta_estado ? 'Ver / editar acta' : 'Cargar acta'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalMesa && (
        <Modal
          size="modal-lg"
          title={`Acta de la mesa ${modalMesa.numero} — ${modalMesa.establecimiento_nombre}`}
          onClose={() => setModalMesa(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setModalMesa(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || cargandoActa}>
                {saving ? 'Guardando...' : 'Guardar acta'}
              </button>
            </>
          }
        >
          {error && <div className="alert alert-danger">{error}</div>}
          {cargandoActa ? <div className="spinner" /> : (
            <>
              <div className="form-row-3">
                <div className="form-group">
                  <label className="form-label">Electores que votaron</label>
                  <input type="number" min="0" className="form-control" value={totales.electores_votantes} onChange={(e) => setTotales({ ...totales, electores_votantes: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Votos en blanco</label>
                  <input type="number" min="0" className="form-control" value={totales.votos_blanco} onChange={(e) => setTotales({ ...totales, votos_blanco: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Votos nulos</label>
                  <input type="number" min="0" className="form-control" value={totales.votos_nulos} onChange={(e) => setTotales({ ...totales, votos_nulos: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Votos recurridos</label>
                  <input type="number" min="0" className="form-control" value={totales.votos_recurridos} onChange={(e) => setTotales({ ...totales, votos_recurridos: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Votos impugnados</label>
                  <input type="number" min="0" className="form-control" value={totales.votos_impugnados} onChange={(e) => setTotales({ ...totales, votos_impugnados: e.target.value })} />
                </div>
              </div>

              {cargosAgrupados().map((cargo) => (
                <div key={cargo.nombre} className="form-group">
                  <label className="form-label">{cargo.nombre}</label>
                  {cargo.listas.map((l) => (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: l.partido_color || 'var(--gray-300)' }} />
                      <span style={{ flex: 1, fontSize: '.875rem' }}>Lista {l.numero} — {l.partido_nombre}</span>
                      <input
                        type="number" min="0" className="form-control" style={{ width: 100 }}
                        value={votos[l.id] ?? ''}
                        onChange={(e) => setVotos({ ...votos, [l.id]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              ))}

              <div className="form-group">
                <label className="form-label">Observaciones</label>
                <textarea className="form-control" value={totales.observaciones} onChange={(e) => setTotales({ ...totales, observaciones: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Estado del acta</label>
                <select className="form-control" value={totales.estado} onChange={(e) => setTotales({ ...totales, estado: e.target.value })}>
                  <option value="cargada">Cargada</option>
                  <option value="validada">Validada</option>
                </select>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
