import { useEffect, useRef, useState } from 'react';
import { preprocessImage, ocrTicketImage, parseTicket } from '../utils/ticketOcr';

const emptyForm = {
  vehicle_id: '', liters: '', km_recorridos: '', price_per_liter: '',
  fuel_type: '', station: '', notes: '', ticket_number: '',
  fueled_at: new Date().toISOString().slice(0, 16),
};

const API = '/fuel-control/backend/api';

// Proveedor por defecto cuando el OCR no reconoció ninguno en el ticket
// (normaliza acentos/mayúsculas para no depender de cómo esté escrito
// exactamente "Yaguareté" en la lista de proveedores).
function defaultSupplierName(suppliers) {
  const normalizado = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const yaguarete = suppliers.find(s => normalizado(s.name).includes('yaguarete'));
  return yaguarete ? yaguarete.name : '';
}

// Flujo de "sacar foto al ticket y prellenar la carga", usado tanto por la
// página de escritorio (dentro del layout con sidebar) como por el acceso
// móvil restringido con PIN (pantalla standalone). El cliente HTTP se
// recibe por prop para que cada uno use su propia autenticación.
export default function FuelingPhotoCapture({ api }) {
  const fileInputRef = useRef(null);

  const [vehicles, setVehicles]     = useState([]);
  const [fuelTypes, setFuelTypes]   = useState([]);
  const [fuelPrices, setFuelPrices] = useState({});
  const [suppliers, setSuppliers]   = useState([]);

  const [step, setStep]         = useState('capture'); // capture | processing | review
  const [progress, setProgress] = useState(0);
  const [photoPreview, setPhotoPreview] = useState('');
  const [rawText, setRawText]   = useState('');
  const [showRawText, setShowRawText] = useState(false);
  const [warnings, setWarnings] = useState([]);

  const [form, setForm] = useState(emptyForm);
  const [vehicleSearch, setVehicleSearch]     = useState('');
  const [showVehicleDrop, setShowVehicleDrop] = useState(false);

  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.get(`${API}/vehicles.php`).then(r => setVehicles(r.data));
    api.get(`${API}/suppliers.php`).then(r => setSuppliers(r.data));
    api.get(`${API}/fuel_types.php`).then(r => setFuelTypes(r.data));
    api.get(`${API}/fuel_prices.php`).then(r => {
      const map = {};
      r.data.forEach(p => { if (p.price) map[p.fuel_type] = p.price; });
      setFuelPrices(map);
    });
  }, [api]);

  const reset = () => {
    setStep('capture');
    setProgress(0);
    setPhotoPreview('');
    setRawText('');
    setShowRawText(false);
    setWarnings([]);
    setForm(emptyForm);
    setVehicleSearch('');
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setSuccess('');
    setStep('processing');
    setProgress(0);
    try {
      const { canvas, previewUrl } = await preprocessImage(file);
      setPhotoPreview(previewUrl);
      const text = await ocrTicketImage(canvas, setProgress);
      setRawText(text);

      const parsed = parseTicket(text, { vehicles, fuelTypes, suppliers });
      const w = [];
      if (!parsed.vehicle_id) w.push('No pudimos reconocer la patente: elegí el vehículo manualmente.');
      if (!parsed.liters) w.push('No pudimos leer los litros: completalos a mano.');
      if (!parsed.fueled_at) w.push('No pudimos leer la fecha: revisá que sea correcta.');
      setWarnings(w);

      const defaultType = parsed.fuel_type || (fuelTypes.length > 0 ? fuelTypes[0].name : '');
      setForm({
        vehicle_id:      parsed.vehicle_id || '',
        liters:          parsed.liters ?? '',
        km_recorridos:   '',
        price_per_liter: parsed.price_per_liter ?? (fuelPrices[defaultType] ?? ''),
        fuel_type:       defaultType,
        station:         parsed.station || defaultSupplierName(suppliers),
        notes:           '',
        ticket_number:   parsed.ticket_number || '',
        fueled_at:       parsed.fueled_at || new Date().toISOString().slice(0, 16),
      });
      const v = vehicles.find(v => String(v.id) === String(parsed.vehicle_id));
      setVehicleSearch(v ? `${v.name} — ${v.plate}` : (parsed.plate_guess || ''));
      setStep('review');
    } catch (err) {
      setError('No se pudo procesar la foto. Probá sacarla de nuevo con mejor luz.');
      setStep('capture');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        vehicle_id:      parseInt(form.vehicle_id),
        liters:          parseFloat(form.liters),
        km_recorridos:   form.km_recorridos ? parseFloat(form.km_recorridos) : null,
        price_per_liter: form.price_per_liter ? parseFloat(form.price_per_liter) : null,
      };
      await api.post(`${API}/fueling.php`, payload);
      setSuccess('¡Carga guardada! Podés sacar otra foto.');
      reset();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {step === 'capture' && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>⛽📷</div>
          <p style={{ color: 'var(--gray-500)', marginBottom: 24 }}>
            Sacale una foto al ticket de carga y completamos el formulario automáticamente.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleFile}
          />
          <button
            type="button"
            className="btn btn-primary btn-full"
            style={{ padding: '16px 20px', fontSize: '1rem' }}
            onClick={() => fileInputRef.current?.click()}
          >
            📷 Sacar foto al ticket
          </button>
        </div>
      )}

      {step === 'processing' && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          {photoPreview && (
            <img src={photoPreview} alt="Ticket" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, marginBottom: 20 }} />
          )}
          <div className="spinner" />
          <p style={{ color: 'var(--gray-500)', marginTop: 12 }}>Leyendo ticket... {progress}%</p>
        </div>
      )}

      {step === 'review' && (
        <div className="card">
          {photoPreview && (
            <img src={photoPreview} alt="Ticket" style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 8, marginBottom: 16, display: 'block', margin: '0 auto 16px' }} />
          )}

          {warnings.length > 0 && (
            <div className="alert alert-error">
              {warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">Vehículo *</label>
              <input
                className="form-input"
                placeholder="Buscar por nombre o patente..."
                value={vehicleSearch}
                autoComplete="off"
                onChange={e => { setVehicleSearch(e.target.value); setForm(f => ({ ...f, vehicle_id: '' })); setShowVehicleDrop(true); }}
                onFocus={() => setShowVehicleDrop(true)}
                onBlur={() => setTimeout(() => setShowVehicleDrop(false), 150)}
              />
              <input type="text" required value={form.vehicle_id} onChange={() => {}}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }} />
              {showVehicleDrop && (
                <div style={{ position: 'absolute', zIndex: 100, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, width: '100%', maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.18)', top: '100%', left: 0 }}>
                  {vehicles.filter(v => v.active && (
                    `${v.name} ${v.plate}`.toLowerCase().includes(vehicleSearch.toLowerCase())
                  )).map(v => (
                    <div key={v.id}
                      style={{ padding: '10px 12px', cursor: 'pointer', fontSize: 14 }}
                      onMouseDown={() => {
                        setForm(f => ({ ...f, vehicle_id: v.id }));
                        setVehicleSearch(`${v.name} — ${v.plate}`);
                        setShowVehicleDrop(false);
                      }}>
                      <strong>{v.name}</strong> <span style={{ color: 'var(--gray-500)' }}>{v.plate}</span>
                    </div>
                  ))}
                  {vehicles.filter(v => v.active && `${v.name} ${v.plate}`.toLowerCase().includes(vehicleSearch.toLowerCase())).length === 0 && (
                    <div style={{ padding: '10px 12px', color: 'var(--gray-400)', fontSize: 14 }}>Sin resultados</div>
                  )}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Tipo de combustible *</label>
              <select className="form-input" value={form.fuel_type}
                onChange={e => {
                  const tipo = e.target.value;
                  setForm(f => ({ ...f, fuel_type: tipo, price_per_liter: fuelPrices[tipo] ?? f.price_per_liter }));
                }}>
                <option value="">— Seleccionar —</option>
                {fuelTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Litros *</label>
              <input className="form-input" type="number" step="0.01" required value={form.liters}
                onChange={e => setForm(f => ({ ...f, liters: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Precio por litro</label>
              <input className="form-input" type="number" step="0.0001" value={form.price_per_liter}
                onChange={e => setForm(f => ({ ...f, price_per_liter: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Fecha y hora *</label>
              <input className="form-input" type="datetime-local" required value={form.fueled_at}
                onChange={e => setForm(f => ({ ...f, fueled_at: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Estación</label>
              <select className="form-input" value={form.station}
                onChange={e => setForm(f => ({ ...f, station: e.target.value }))}>
                <option value="">— Seleccionar proveedor —</option>
                {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">N° Ticket / Remito</label>
              <input className="form-input" value={form.ticket_number}
                onChange={e => setForm(f => ({ ...f, ticket_number: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Km Recorridos</label>
              <input className="form-input" type="number" step="0.1" value={form.km_recorridos}
                onChange={e => setForm(f => ({ ...f, km_recorridos: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Notas</label>
              <textarea className="form-input" rows="2" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            {rawText && (
              <div className="form-group">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowRawText(s => !s)}>
                  {showRawText ? 'Ocultar' : 'Ver'} texto reconocido
                </button>
                {showRawText && (
                  <pre style={{ marginTop: 8, padding: 10, background: 'var(--gray-50)', borderRadius: 8, fontSize: 11, whiteSpace: 'pre-wrap', maxHeight: 160, overflowY: 'auto' }}>
                    {rawText}
                  </pre>
                )}
              </div>
            )}

            <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
              <button type="button" className="btn btn-ghost" onClick={reset}>Sacar otra foto</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar carga'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
