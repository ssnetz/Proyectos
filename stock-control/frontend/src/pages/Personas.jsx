import { useState, useEffect, useCallback } from 'react';
import { usePersonas } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const TIPOS_DOC = [
  { value: '1', label: 'DNI' },
  { value: '2', label: 'LC' },
  { value: '3', label: 'LE' },
  { value: '4', label: 'CI' },
  { value: '9', label: 'Otro' },
];

const emptyForm = {
  tipo_documento: '1', documento: '', apellido: '', nombre: '',
  sexo: '', calle: '', numeracion: '', departamento: '', piso: '', barrio: '', cuit_cuil: '',
};

export default function Personas() {
  const api     = usePersonas();
  const { user } = useAuth();
  const isAdmin  = user?.role === 'admin';

  const [personas, setPersonas] = useState([]);
  const [total, setTotal]       = useState(0);
  const [pages, setPages]       = useState(1);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const [search, setSearch]     = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [modal, setModal]       = useState(null);
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);

  const load = useCallback((p = page, s = search) => {
    return api.list({ search: s, page: p, limit: 50 }).then((r) => {
      setPersonas(r.data.data);
      setTotal(r.data.total);
      setPages(r.data.pages);
    });
  }, [page, search]);

  useEffect(() => {
    setLoading(true);
    load(page, search).catch(() => setError('Error cargando personas')).finally(() => setLoading(false));
  }, [page, search]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setSearch(searchInput); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3500); };

  const openCreate = () => { setForm(emptyForm); setModal('create'); setError(''); };
  const openEdit   = (p) => {
    setForm({
      tipo_documento: p.tipo_documento || '1',
      documento: p.documento, apellido: p.apellido, nombre: p.nombre || '',
      sexo: p.sexo || '', calle: p.calle || '', numeracion: p.numeracion || '',
      departamento: p.departamento || '', piso: p.piso || '',
      barrio: p.barrio || '', cuit_cuil: p.cuit_cuil || '',
    });
    setModal(p.id);
    setError('');
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (modal === 'create') {
        await api.create(form);
        notify('Persona creada correctamente');
      } else {
        await api.update(modal, form);
        notify('Persona actualizada');
      }
      setModal(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p) => {
    if (!confirm(`¿Desactivar a ${p.apellido} ${p.nombre}?`)) return;
    try {
      await api.remove(p.id);
      notify('Persona desactivada');
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al desactivar');
    }
  };

  const tipoLabel = (t) => TIPOS_DOC.find((d) => d.value === t)?.label ?? t;

  const f = (field) => ({ value: form[field], onChange: (e) => setForm({ ...form, [field]: e.target.value }) });

  return (
    <div>
      {error   && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="table-actions">
          <div className="filters">
            <div className="search-input">
              <input
                className="form-control"
                placeholder="Buscar por DNI, apellido o nombre..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={{ width: 280 }}
              />
            </div>
            <span style={{ fontSize: '.875rem', color: 'var(--gray-500)' }}>
              {total.toLocaleString('es-AR')} personas
            </span>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>+ Nueva persona</button>
        </div>

        {loading ? <div className="spinner" /> : personas.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">👥</div>
            <p>{search ? 'Sin resultados para la búsqueda' : 'No hay personas registradas'}</p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tipo</th><th>Documento</th><th>Apellido y nombre</th>
                    <th>Sexo</th><th>Barrio</th><th>CUIT/CUIL</th><th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {personas.map((p) => (
                    <tr key={p.id}>
                      <td><span className="badge badge-gray">{tipoLabel(p.tipo_documento)}</span></td>
                      <td><code style={{ fontSize: '.85rem' }}>{p.documento}</code></td>
                      <td>
                        <strong>{p.apellido}</strong>
                        {p.nombre && <span style={{ color: 'var(--gray-500)' }}>, {p.nombre}</span>}
                      </td>
                      <td style={{ color: 'var(--gray-500)' }}>{p.sexo || '—'}</td>
                      <td style={{ fontSize: '.85rem' }}>{p.barrio || '—'}</td>
                      <td style={{ fontSize: '.8rem', color: 'var(--gray-500)' }}>{p.cuit_cuil || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)} title="Editar">✏️</button>
                          {isAdmin && (
                            <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(p)} title="Desactivar">🗑️</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '12px 0' }}>
                <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>← Anterior</button>
                <span style={{ fontSize: '.875rem', color: 'var(--gray-500)', lineHeight: '30px' }}>
                  Página {page} de {pages}
                </span>
                <button className="btn btn-ghost btn-sm" disabled={page === pages} onClick={() => setPage(page + 1)}>Siguiente →</button>
              </div>
            )}
          </>
        )}
      </div>

      {modal !== null && (
        <Modal
          title={modal === 'create' ? 'Nueva persona' : 'Editar persona'}
          onClose={() => setModal(null)}
          size="modal-lg"
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

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tipo documento</label>
              <select className="form-control" {...f('tipo_documento')}>
                {TIPOS_DOC.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Nro. documento *</label>
              <input className="form-control" {...f('documento')} />
            </div>
            <div className="form-group">
              <label className="form-label">Sexo</label>
              <select className="form-control" {...f('sexo')}>
                <option value="">—</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Apellido *</label>
              <input className="form-control" {...f('apellido')} />
            </div>
            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input className="form-control" {...f('nombre')} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 3 }}>
              <label className="form-label">Calle</label>
              <input className="form-control" {...f('calle')} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Número</label>
              <input className="form-control" {...f('numeracion')} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Dpto.</label>
              <input className="form-control" {...f('departamento')} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Piso</label>
              <input className="form-control" {...f('piso')} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Barrio</label>
              <input className="form-control" {...f('barrio')} />
            </div>
            <div className="form-group">
              <label className="form-label">CUIT/CUIL</label>
              <input className="form-control" {...f('cuit_cuil')} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
