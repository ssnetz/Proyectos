import axios from 'axios';

const api = axios.create({ baseURL: '/electis/api' });

// Attach JWT token from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('el_token');
  if (token) {
    config.headers = config.headers ?? {};
    config.headers['Authorization'] = `Bearer ${token}`;
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
export function useMesas()           { return crud('mesas'); }
export function useFiscales()        { return crud('fiscales'); }
export function useElectores()       { return crud('electores', { softDelete: true }); }
export function useUsuarios()        { return crud('usuarios'); }

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
