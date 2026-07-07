import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const STATUS_LABELS = { borrador: 'Borrador', cerrada: 'Cerrada', pagada: 'Pagada' };
const STATUS_BADGES = { borrador: 'badge-blue', cerrada: 'badge-gray', pagada: 'badge-green' };

const emptyForm = { numero_op: '', supplier_id: '', fecha: new Date().toISOString().slice(0, 10), estado: 'borrador', notas: '' };

export default function OrdenesPago() {
  const { user } = useAuth();
  const isAdmin  = user?.role === 'admin';

  const [ops, setOps]               = useState([]);
  const [suppliers, setSuppliers]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState(null);
  const [form, setForm]             = useState(emptyForm);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  // Modal selector de cargas
  const [showCargas, setShowCargas]         = useState(false);
  const [cargasDisp, setCargasDisp]         = useState([]);
  const [cargasSel, setCargasSel]           = useState({});
  const [loadingCargas, setLoadingCargas]   = useState(false);
  const [filterText, setFilterText]         = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 7) + '-01';
  const [cargasFrom, setCargasFrom]         = useState(firstOfMonth);
  const [cargasTo, setCargasTo]             = useState(today);

  // Detalle de OP
  const [showDetalle, setShowDetalle]       = useState(false);
  const [detalleOp, setDetalleOp]           = useState(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  const load = () =>
    axios.get('/fuel-control/backend/api/ordenes_pago.php')
      .then(r => { setOps(r.data); setLoading(false); });

  useEffect(() => {
    axios.get('/fuel-control/backend/api/suppliers.php?all=1').then(r => setSuppliers(r.data));
    load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, fecha: new Date().toISOString().slice(0, 10) });
    setError('');
    setShowForm(true);
  };

  const openEdit = (op) => {
    setEditing(op.id);
    setForm({ numero_op: op.numero_op, supplier_id: op.supplier_id, fecha: op.fecha, estado: op.estado, notas: op.notas ?? '' });
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, supplier_id: parseInt(form.supplier_id), created_by: user.username };
      if (editing) {
        await axios.put(`/fuel-control/backend/api/ordenes_pago.php?id=${editing}`, payload);
      } else {
        await axios.post('/fuel-control/backend/api/ordenes_pago.php', payload);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (op) => {
    if (!confirm(`¿Eliminar OP ${op.numero_op}? Las cargas quedarán sin asignar.`)) return;
    await axios.delete(`/fuel-control/backend/api/ordenes_pago.php?id=${op.id}`);
    load();
  };

  // Abrir modal de cargas disponibles
  const openCargasModal = async (opId, supplierId, from, to) => {
    const f = from || cargasFrom;
    const t = to   || cargasTo;
    setShowCargas({ opId, supplierId });
    setLoadingCargas(true);
    setCargasDisp([]);
    setCargasSel({});
    setFilterText('');
    const r = await axios.get('/fuel-control/backend/api/ordenes_pago.php', {
      params: { unassigned: 1, supplier_id: supplierId, from: f, to: t }
    });
    setCargasDisp(r.data);
    setLoadingCargas(false);
  };

  const recargarCargas = () => openCargasModal(showCargas.opId, showCargas.supplierId, cargasFrom, cargasTo);

  const toggleCarga = (id) => setCargasSel(s => ({ ...s, [id]: !s[id] }));
  const toggleAll   = (ids, val) => {
    const upd = {};
    ids.forEach(id => { upd[id] = val; });
    setCargasSel(s => ({ ...s, ...upd }));
  };

  const asignarCargas = async () => {
    const ids = Object.entries(cargasSel).filter(([, v]) => v).map(([k]) => parseInt(k));
    if (!ids.length) return;
    await axios.post('/fuel-control/backend/api/ordenes_pago.php?action=assign', {
      op_id: showCargas.opId, fueling_ids: ids
    });
    setShowCargas(false);
    load();
  };

  // Desasignar una carga del detalle
  const desasignarCarga = async (fuelingId) => {
    if (!confirm('¿Quitar esta carga de la orden de pago?')) return;
    await axios.post('/fuel-control/backend/api/ordenes_pago.php?action=unassign', { fueling_ids: [fuelingId] });
    openDetalle(detalleOp.id);
    load();
  };

  const openDetalle = async (opId) => {
    setShowDetalle(true);
    setLoadingDetalle(true);
    const r = await axios.get(`/fuel-control/backend/api/ordenes_pago.php?id=${opId}`);
    setDetalleOp(r.data);
    setLoadingDetalle(false);
  };

  const fmt = (n) => Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2 });

  const cargasFiltradas = cargasDisp.filter(c =>
    !filterText ||
    c.vehicle_name?.toLowerCase().includes(filterText.toLowerCase()) ||
    c.plate?.toLowerCase().includes(filterText.toLowerCase()) ||
    c.fuel_type?.toLowerCase().includes(filterText.toLowerCase())
  );

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-actions">
        <button className="btn btn-primary" onClick={openNew}>+ Nueva orden de pago</button>
      </div>

      {/* Tabla de OPs */}
      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>N° OP</th>
                <th>Proveedor</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th className="num">Cargas</th>
                <th className="num">Litros</th>
                <th className="num">Monto total</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ops.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--gray-500)', padding: 24 }}>Sin órdenes de pago</td></tr>
              )}
              {ops.map(op => (
                <tr key={op.id}>
                  <td><strong>{op.numero_op}</strong></td>
                  <td>{op.supplier_name}</td>
                  <td>{op.fecha}</td>
                  <td><span className={`badge ${STATUS_BADGES[op.estado]}`}>{STATUS_LABELS[op.estado]}</span></td>
                  <td className="num">{op.total_cargas ?? 0}</td>
                  <td className="num">{fmt(op.total_litros)} L</td>
                  <td className="num">${fmt(op.total_monto)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm btn-icon" title="Ver detalle" onClick={() => openDetalle(op.id)}>👁️</button>
                      <button className="btn btn-ghost btn-sm btn-icon" title="Agregar cargas" onClick={() => openCargasModal(op.id, op.supplier_id)}>➕</button>
                      <button className="btn btn-ghost btn-sm btn-icon" title="Editar" onClick={() => openEdit(op)}>✏️</button>
                      {isAdmin && <button className="btn btn-ghost btn-sm btn-icon" title="Eliminar" onClick={() => handleDelete(op)}>🗑️</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal nueva/editar OP */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Editar orden de pago' : 'Nueva orden de pago'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">N° Orden de Pago *</label>
                  <input className="form-input" required value={form.numero_op}
                    placeholder="Ej: OP-2024-001"
                    onChange={e => setForm(f => ({ ...f, numero_op: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha *</label>
                  <input className="form-input" type="date" required value={form.fecha}
                    onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Proveedor *</label>
                  <select className="form-input" required value={form.supplier_id}
                    onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
                    <option value="">Seleccioná un proveedor</option>
                    {suppliers.filter(s => s.active).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <select className="form-input" value={form.estado}
                    onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                    <option value="borrador">Borrador</option>
                    <option value="cerrada">Cerrada</option>
                    <option value="pagada">Pagada</option>
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Notas</label>
                  <textarea className="form-input" rows={2} value={form.notas}
                    onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : editing ? 'Guardar' : 'Crear OP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal selector de cargas sin OP */}
      {showCargas && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 780 }}>
            <div className="modal-header">
              <h2 className="modal-title">➕ Agregar cargas a la orden</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCargas(false)}>✕</button>
            </div>
            <div style={{ padding: '0 0 10px', fontSize: 13, color: 'var(--gray-500)' }}>
              Se muestran solo las cargas <strong>sin orden de pago asignada</strong>. Filtrá por período y seleccioná las que pertenecen a esta OP.
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="date" className="form-input form-input-sm" style={{ width: 140 }}
                value={cargasFrom} onChange={e => setCargasFrom(e.target.value)} />
              <span style={{ fontSize: 12 }}>al</span>
              <input type="date" className="form-input form-input-sm" style={{ width: 140 }}
                value={cargasTo} onChange={e => setCargasTo(e.target.value)} />
              <button className="btn btn-primary btn-sm" onClick={recargarCargas}>Buscar</button>
              <input
                className="form-input form-input-sm"
                placeholder="Filtrar por vehículo, patente o tipo..."
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                style={{ flex: 1, minWidth: 160 }}
              />
            </div>
            {loadingCargas && <div className="spinner" />}
            {!loadingCargas && cargasDisp.length === 0 && (
              <div style={{ padding: 20, color: 'var(--gray-500)', textAlign: 'center' }}>
                No hay cargas sin asignar para este proveedor.
              </div>
            )}
            {!loadingCargas && cargasDisp.length > 0 && (
              <>
                <div className="table-wrapper" style={{ maxHeight: 400, overflowY: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}>
                          <input type="checkbox"
                            checked={cargasFiltradas.length > 0 && cargasFiltradas.every(c => cargasSel[c.id])}
                            onChange={e => toggleAll(cargasFiltradas.map(c => c.id), e.target.checked)} />
                        </th>
                        <th>Fecha</th>
                        <th>Vehículo</th>
                        <th>Patente</th>
                        <th>Tipo</th>
                        <th className="num">Litros</th>
                        <th className="num">Monto</th>
                        <th>Estación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cargasFiltradas.map(c => (
                        <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => toggleCarga(c.id)}>
                          <td><input type="checkbox" checked={!!cargasSel[c.id]} onChange={() => toggleCarga(c.id)} onClick={e => e.stopPropagation()} /></td>
                          <td>{c.fueled_at?.slice(0, 10)}</td>
                          <td>{c.vehicle_name}</td>
                          <td>{c.plate}</td>
                          <td>{c.fuel_type}</td>
                          <td className="num">{fmt(c.liters)} L</td>
                          <td className="num">${fmt(c.total_cost)}</td>
                          <td>{c.station || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: '12px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                    {Object.values(cargasSel).filter(Boolean).length} seleccionadas de {cargasFiltradas.length} mostradas
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost" onClick={() => setShowCargas(false)}>Cancelar</button>
                    <button className="btn btn-primary" onClick={asignarCargas}
                      disabled={!Object.values(cargasSel).filter(Boolean).length}>
                      Agregar seleccionadas
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal detalle OP */}
      {showDetalle && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 820 }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {detalleOp ? `OP ${detalleOp.numero_op} — ${detalleOp.supplier_name}` : 'Detalle'}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowDetalle(false)}>✕</button>
            </div>
            {loadingDetalle && <div className="spinner" />}
            {!loadingDetalle && detalleOp && (
              <>
                <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Fecha', value: detalleOp.fecha },
                    { label: 'Estado', value: <span className={`badge ${STATUS_BADGES[detalleOp.estado]}`}>{STATUS_LABELS[detalleOp.estado]}</span> },
                    { label: 'Cargas', value: detalleOp.cargas?.length ?? 0 },
                    { label: 'Total litros', value: `${fmt(detalleOp.cargas?.reduce((a, c) => a + Number(c.liters), 0))} L` },
                    { label: 'Total monto', value: `$${fmt(detalleOp.cargas?.reduce((a, c) => a + Number(c.total_cost), 0))}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="card" style={{ padding: '8px 16px', minWidth: 120 }}>
                      <div style={{ fontSize: 10, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{label}</div>
                      <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>{value}</div>
                    </div>
                  ))}
                </div>
                {detalleOp.notas && (
                  <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--gray-600)' }}>
                    <strong>Notas:</strong> {detalleOp.notas}
                  </div>
                )}
                <div className="table-wrapper" style={{ maxHeight: 380, overflowY: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Vehículo</th>
                        <th>Patente</th>
                        <th>Tipo combustible</th>
                        <th className="num">Litros</th>
                        <th className="num">Monto</th>
                        <th>Estación</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detalleOp.cargas ?? []).length === 0 && (
                        <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--gray-500)', padding: 16 }}>Sin cargas asignadas</td></tr>
                      )}
                      {(detalleOp.cargas ?? []).map(c => (
                        <tr key={c.id}>
                          <td>{c.fueled_at?.slice(0, 10)}</td>
                          <td>{c.vehicle_name}</td>
                          <td>{c.plate}</td>
                          <td>{c.fuel_type}</td>
                          <td className="num">{fmt(c.liters)} L</td>
                          <td className="num">${fmt(c.total_cost)}</td>
                          <td>{c.station || '—'}</td>
                          <td>
                            <button className="btn btn-ghost btn-sm btn-icon" title="Quitar de esta OP"
                              onClick={() => desasignarCarga(c.id)}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {(detalleOp.cargas ?? []).length > 0 && (
                      <tfoot>
                        <tr>
                          <td colSpan={4}><strong>TOTAL</strong></td>
                          <td className="num"><strong>{fmt(detalleOp.cargas.reduce((a, c) => a + Number(c.liters), 0))} L</strong></td>
                          <td className="num"><strong>${fmt(detalleOp.cargas.reduce((a, c) => a + Number(c.total_cost), 0))}</strong></td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-ghost btn-sm" onClick={() => openCargasModal(detalleOp.id, detalleOp.supplier_id)}>
                    ➕ Agregar más cargas
                  </button>
                  <button className="btn btn-ghost" onClick={() => setShowDetalle(false)}>Cerrar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
