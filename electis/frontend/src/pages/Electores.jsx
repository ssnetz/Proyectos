import { useState, useEffect } from 'react';
import { useElectores, useMesas } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const emptyForm = {
  orden: '', documento: '', tipo: '', apellido: '', nombre: '', sexo: '',
  fecha_nacimiento: '', domicilio: '', mesa_id: '', votado: false,
};

export default function Electores() {
  const { list, create, update, importPadron } = useElectores();
  const { list: listMesas } = useMesas();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [electores, setElectores] = useState([]);
  const [meta, setMeta]         = useState(null);
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [modal, setModal]       = useState(null);
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [q, setQ]               = useState('');
  const [filterMesa, setFilterMesa] = useState('');
  const [page, setPage]         = useState(1);

  const [importOpen, setImportOpen]       = useState(false);
  const [importFile, setImportFile]       = useState(null);
  const [importing, setImporting]         = useState(false);
  const [importResult, setImportResult]   = useState(null);
  const [importError, setImportError]     = useState('');

  const load = (params) => list(params).then((r) => { setElectores(r.data.data); setMeta(r.data.meta); });

  useEffect(() => {
    listMesas().then((r) => setMesas(r.data)).catch(() => setError('Error cargando mesas'));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      const params = { page };
      if (q.trim()) params.q = q.trim();
      if (filterMesa) params.mesa_id = filterMesa;
      load(params).catch(() => setError('Error buscando electores')).finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q, filterMesa, page]);

  const handleQChange = (v) => { setQ(v); setPage(1); };
  const handleFilterMesaChange = (v) => { setFilterMesa(v); setPage(1); };

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = () => { setForm(emptyForm); setModal('create'); setError(''); };
  const openEdit   = (e) => {
    setForm({
      orden: e.orden ?? '', documento: e.documento, tipo: e.tipo || '', apellido: e.apellido, nombre: e.nombre,
      sexo: e.sexo || '', fecha_nacimiento: e.fecha_nacimiento || '', domicilio: e.domicilio || '',
      mesa_id: e.mesa_id || '', votado: !!Number(e.votado),
    });
    setModal(e.id);
    setError('');
  };

  const reload = () => {
    const params = { page };
    if (q.trim()) params.q = q.trim();
    if (filterMesa) params.mesa_id = filterMesa;
    return load(params);
  };

  const handleSave = async () => {
    if (!form.documento || !form.apellido || !form.nombre) { setError('Documento, apellido y nombre son requeridos'); return; }

    setSaving(true);
    setError('');
    try {
      if (modal === 'create') { await create(form); notify('Elector creado'); }
      else { await update(modal, form); notify('Elector actualizado'); }
      setModal(null);
      await reload();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const toggleVotado = async (e) => {
    try {
      await update(e.id, { ...e, votado: Number(e.votado) ? 0 : 1 });
      await reload();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar');
    }
  };

  const openImport = () => {
    setImportFile(null);
    setImportResult(null);
    setImportError('');
    setImportOpen(true);
  };

  const handleImport = async () => {
    if (!importFile) { setImportError('Elegí un archivo CSV'); return; }
    setImporting(true);
    setImportError('');
    try {
      const r = await importPadron(importFile);
      setImportResult(r.data);
      await reload();
      await listMesas().then((res) => setMesas(res.data));
    } catch (e) {
      setImportError(e.response?.data?.error || 'Error al importar el padrón');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      {error   && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="table-actions">
          <div className="filters">
            <div className="search-input">
              <input className="form-control" style={{ width: 260 }} placeholder="Buscar por documento, apellido o nombre..." value={q} onChange={(e) => handleQChange(e.target.value)} />
            </div>
            <select className="form-control" style={{ width: 180 }} value={filterMesa} onChange={(e) => handleFilterMesaChange(e.target.value)}>
              <option value="">Todas las mesas</option>
              {mesas.map((m) => <option key={m.id} value={m.id}>Mesa {m.numero}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isAdmin && <button className="btn btn-ghost" onClick={openImport}>📥 Importar padrón</button>}
            <button className="btn btn-primary" onClick={openCreate}>+ Nuevo elector</button>
          </div>
        </div>

        {meta?.mesa && (
          <div className="alert alert-info" style={{ marginBottom: 16, flexWrap: 'wrap', flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span>
                <strong>Mesa {meta.mesa.numero}</strong> — {meta.mesa.establecimiento_nombre}
              </span>
              <span style={{ marginLeft: 'auto' }}>
                <span className="badge badge-blue">{meta.total} elector{meta.total === 1 ? '' : 'es'} en el padrón</span>
              </span>
            </div>
            {meta.mesa.primer_elector && meta.mesa.ultimo_elector && (
              <div style={{ fontSize: '.8rem' }}>
                Desde <strong>{meta.mesa.primer_elector.apellido}, {meta.mesa.primer_elector.nombre}</strong>{' '}
                hasta <strong>{meta.mesa.ultimo_elector.apellido}, {meta.mesa.ultimo_elector.nombre}</strong>
              </div>
            )}
          </div>
        )}

        {loading ? <div className="spinner" /> : electores.length === 0 ? (
          <div className="empty"><div className="empty-icon">👥</div><p>No hay electores para los filtros seleccionados</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Documento</th><th>Apellido</th><th>Nombre</th><th>Mesa</th><th>Votó</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {electores.map((e) => (
                  <tr key={e.id}>
                    <td>{e.documento}</td>
                    <td><strong>{e.apellido}</strong></td>
                    <td>{e.nombre}</td>
                    <td>{e.mesa_numero ? <span className="badge badge-blue">{e.mesa_numero}</span> : '—'}</td>
                    <td>
                      <button
                        className={`btn btn-sm ${Number(e.votado) ? 'btn-success' : 'btn-ghost'}`}
                        onClick={() => toggleVotado(e)}
                        title="Marcar como votó / no votó"
                      >
                        {Number(e.votado) ? '✅ Sí' : 'No'}
                      </button>
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(e)}>✏️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.pages > 1 && (
          <div className="pagination">
            <span className="pagination-info">
              Página {meta.page} de {meta.pages} — {meta.total} elector{meta.total === 1 ? '' : 'es'}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ← Anterior
              </button>
              <button className="btn btn-ghost btn-sm" disabled={page >= meta.pages} onClick={() => setPage((p) => p + 1)}>
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>

      {modal !== null && (
        <Modal
          title={modal === 'create' ? 'Nuevo elector' : 'Editar elector'}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          }
        >
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">Documento *</label>
              <input className="form-control" value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <input className="form-control" placeholder="Ej: DNI-EB" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">N° de orden</label>
              <input type="number" className="form-control" value={form.orden} onChange={(e) => setForm({ ...form, orden: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Apellido *</label>
              <input className="form-control" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input className="form-control" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Sexo</label>
              <select className="form-control" value={form.sexo} onChange={(e) => setForm({ ...form, sexo: e.target.value })}>
                <option value="">—</option>
                <option value="F">F</option>
                <option value="M">M</option>
                <option value="X">X</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Fecha de nacimiento</label>
              <input type="date" className="form-control" value={form.fecha_nacimiento} onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Domicilio</label>
            <input className="form-control" value={form.domicilio} onChange={(e) => setForm({ ...form, domicilio: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Mesa</label>
            <select className="form-control" value={form.mesa_id} onChange={(e) => setForm({ ...form, mesa_id: e.target.value })}>
              <option value="">Sin asignar</option>
              {mesas.map((m) => <option key={m.id} value={m.id}>Mesa {m.numero}</option>)}
            </select>
          </div>
        </Modal>
      )}

      {importOpen && (
        <Modal
          title="Importar padrón desde CSV"
          onClose={() => setImportOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setImportOpen(false)}>Cerrar</button>
              {!importResult && (
                <button className="btn btn-primary" onClick={handleImport} disabled={importing || !importFile}>
                  {importing ? 'Importando...' : 'Importar'}
                </button>
              )}
            </>
          }
        >
          {importError && <div className="alert alert-danger">{importError}</div>}

          {!importResult ? (
            <>
              <p style={{ fontSize: '.85rem', color: 'var(--gray-500)', marginBottom: 12 }}>
                El CSV necesita las columnas <code>documento</code>, <code>apellido</code>, <code>nombre</code> y <code>mesa_numero</code>
                (opcionales: <code>domicilio</code>, <code>orden</code>, <code>tipo</code>). Las mesas que no existan se crean automáticamente bajo un
                establecimiento genérico "Sin asignar", para repartirlas en las escuelas reales después desde Mesas.
                Los documentos que ya estén cargados en esta elección no se duplican; si la fila trae <code>tipo</code>, se usa
                para completar/actualizar el tipo de documento del elector ya existente.
              </p>
              <div className="form-group">
                <label className="form-label">Archivo CSV</label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="form-control"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </>
          ) : (
            <div>
              <div className="alert alert-success">{importResult.message}</div>
              <ul style={{ fontSize: '.9rem', lineHeight: 1.8, paddingLeft: 18 }}>
                <li>Electores creados: <strong>{importResult.electores_creados}</strong></li>
                <li>Omitidos por duplicado: <strong>{importResult.electores_omitidos_duplicados}</strong></li>
                {importResult.tipos_actualizados > 0 && (
                  <li>Tipos de documento actualizados: <strong>{importResult.tipos_actualizados}</strong></li>
                )}
                <li>Mesas nuevas creadas: <strong>{importResult.mesas_creadas}</strong></li>
                {importResult.total_errores > 0 && (
                  <li>Filas con error: <strong>{importResult.total_errores}</strong></li>
                )}
              </ul>
              {importResult.errores?.length > 0 && (
                <div style={{ maxHeight: 160, overflowY: 'auto', background: 'var(--gray-50)', padding: 10, borderRadius: 8, fontSize: '.8rem' }}>
                  {importResult.errores.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
