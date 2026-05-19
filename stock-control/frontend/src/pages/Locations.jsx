import { useState, useEffect } from 'react';
import { useLocations } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const emptyForm = { name: '', type: 'dispensario', address: '' };

const typeLabel = { farmacia: 'Farmacia', guardia: 'Guardia', dispensario: 'Dispensario', odontologia: 'Odontología', vacutanorio: 'Vacutanorio', laboratorio: 'Laboratorio', otros: 'Otros' };
const typeBadge = { farmacia: 'badge-blue', guardia: 'badge-red', dispensario: 'badge-green', odontologia: 'badge-purple', vacutanorio: 'badge-yellow', laboratorio: 'badge-orange', otros: 'badge-gray' };

export default function Locations() {
  const locApi  = useLocations();
  const { user } = useAuth();
  const isAdmin  = user?.role === 'admin';

  const [locations, setLocations] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');
  const [modal,     setModal]     = useState(null); // null | 'create' | id
  const [form,      setForm]      = useState(emptyForm);
  const [saving,    setSaving]    = useState(false);

  const load = () =>
    locApi.list().then((r) => setLocations(r.data)).catch(() => setError('Error cargando ubicaciones'));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = () => { setForm(emptyForm); setModal('create'); };
  const openEdit   = (loc) => {
    setForm({ name: loc.name, type: loc.type, address: loc.address || '' });
    setModal(loc.id);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (modal === 'create') {
        await locApi.create(form);
        notify('Ubicación creada');
      } else {
        await locApi.update(modal, form);
        notify('Ubicación actualizada');
      }
      setModal(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (loc) => {
    if (loc.id === 1) return;
    if (!confirm(`¿Desactivar "${loc.name}"?`)) return;
    try {
      await locApi.remove(loc.id);
      notify('Ubicación desactivada');
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al desactivar');
    }
  };

  return (
    <div>
      {error   && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="table-actions">
          <div className="filters">
            <span style={{ fontSize: '.875rem', color: 'var(--gray-400)' }}>
              {locations.length} ubicaciones activas
            </span>
          </div>
          {isAdmin && (
            <button className="btn btn-primary" onClick={openCreate}>+ Nueva dependencia</button>
          )}
        </div>

        {loading ? <div className="spinner" /> : locations.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🏥</div>
            <p>No hay ubicaciones</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Dirección</th>
                  <th style={{ textAlign: 'right' }}>Productos</th>
                  <th style={{ textAlign: 'right' }}>Unidades totales</th>
                  {isAdmin && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => (
                  <tr key={loc.id}>
                    <td><strong>{loc.name}</strong></td>
                    <td>
                      <span className={`badge ${typeBadge[loc.type] ?? 'badge-gray'}`}>
                        {typeLabel[loc.type] ?? loc.type}
                      </span>
                    </td>
                    <td style={{ color: 'var(--gray-400)', fontSize: '.875rem' }}>
                      {loc.address || <span style={{ color: 'var(--gray-600)' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>{loc.product_count}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{loc.total_units}</td>
                    {isAdmin && (
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(loc)}>✏️</button>
                          {loc.id !== 1 && (
                            <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(loc)}>🗑️</button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal !== null && (
        <Modal
          title={modal === 'create' ? 'Nueva ubicación' : 'Editar ubicación'}
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
          <div className="form-group">
            <label className="form-label">Nombre *</label>
            <input
              className="form-control"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: Dispensario Barrio Norte"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <select
              className="form-control"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="farmacia">Farmacia</option>
              <option value="guardia">Guardia</option>
              <option value="dispensario">Dispensario</option>
              <option value="odontologia">Odontología</option>
              <option value="vacutanorio">Vacutanorio</option>
              <option value="laboratorio">Laboratorio</option>
              <option value="otros">Otros</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Dirección</label>
            <input
              className="form-control"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Dirección opcional"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
