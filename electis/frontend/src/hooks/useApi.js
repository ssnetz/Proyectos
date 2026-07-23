import axios from 'axios';
import { getApiMunicipioId } from '../lib/municipioStore';
import { getApiEleccionId } from '../lib/eleccionStore';

const api = axios.create({ baseURL: '/electis/api' });

// Attach JWT token and the currently selected municipio/elección (como query
// param, así funciona para cualquier método incluido GET/DELETE) en cada
// request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('el_token');
  if (token) {
    config.headers = config.headers ?? {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  const municipioId = getApiMunicipioId();
  const eleccionId = getApiEleccionId();
  if (municipioId) {
    config.params = { ...(config.params || {}), municipio_id: municipioId };
  }
  if (eleccionId) {
    config.params = { ...(config.params || {}), eleccion_id: eleccionId };
  }
  return config;
});

// On 401, clean up token and redirect to /login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('el_token');
      window.location.href = '/electis/login';
    }
    return Promise.reject(error);
  }
);

function crud(endpoint, { softDelete = false } = {}) {
  const list   = (params)   => api.get(`/${endpoint}.php`, { params });
  const get    = (id)       => api.get(`/${endpoint}.php`, { params: { id } });
  const create = (data)     => api.post(`/${endpoint}.php`, data);
  const update = (id, data) => api.put(`/${endpoint}.php?id=${id}`, data);
  const remove = softDelete ? undefined : (id) => api.delete(`/${endpoint}.php?id=${id}`);
  return { list, get, create, update, remove };
}

export function usePartidos()        { return crud('partidos'); }
export function useCargos()          { return crud('cargos'); }
export function useListas()          { return crud('listas'); }
export function useCandidatos()      { return crud('candidatos'); }
export function useEstablecimientos() { return crud('establecimientos'); }
export function useMesas() {
  const base = crud('mesas');
  const regenerarPin = (id) => api.put(`/mesas.php?id=${id}&action=regenerar_pin`);
  return { ...base, regenerarPin };
}
export function useFiscales()        { return crud('fiscales'); }
export function useElectores() {
  const base = crud('electores', { softDelete: true });
  const importPadron = (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/electores_import.php', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  };
  const deletePadron = (password) => api.delete('/electores_import.php', {
    params: { confirmar: 1 },
    data: { password },
  });
  return { ...base, importPadron, deletePadron };
}
export function useUsuarios()        { return crud('usuarios'); }
export function useMunicipios()      { return crud('municipios'); }
export function useElecciones()      { return crud('elecciones'); }

export function useActas() {
  const list   = (params) => api.get('/actas.php', { params });
  const get    = (id)     => api.get('/actas.php', { params: { id } });
  const save   = (data)   => api.post('/actas.php', data);
  return { list, get, save };
}

export function useDashboard() {
  const get = () => api.get('/dashboard.php');
  return { get };
}

export function usePadronImprimir() {
  const get = (mesaId) => api.get('/padron_imprimir.php', { params: { mesa_id: mesaId } });
  return { get };
}
