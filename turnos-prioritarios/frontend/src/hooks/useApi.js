import axios from 'axios';

const api = axios.create({ baseURL: '/turnos-prioritarios/api' });

// Attach JWT token from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tp_token');
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
      localStorage.removeItem('tp_token');
      // Redirect to login (works even without React Router context)
      window.location.href = '/turnos-prioritarios/login';
    }
    return Promise.reject(error);
  }
);

export function useProfesionales() {
  const list   = (params)   => api.get('/profesionales.php', { params });
  const get    = (id)       => api.get('/profesionales.php', { params: { id } });
  const create = (data)     => api.post('/profesionales.php', data);
  const update = (id, data) => api.put(`/profesionales.php?id=${id}`, data);
  const remove = (id)       => api.delete(`/profesionales.php?id=${id}`);
  return { list, get, create, update, remove };
}

export function useInstituciones() {
  const list   = ()         => api.get('/instituciones.php');
  const get    = (id)       => api.get('/instituciones.php', { params: { id } });
  const create = (data)     => api.post('/instituciones.php', data);
  const update = (id, data) => api.put(`/instituciones.php?id=${id}`, data);
  const remove = (id)       => api.delete(`/instituciones.php?id=${id}`);
  return { list, get, create, update, remove };
}

export function usePersonas() {
  const list   = (params)   => api.get('/personas.php', { params });
  const get    = (id)       => api.get('/personas.php', { params: { id } });
  const create = (data)     => api.post('/personas.php', data);
  const update = (id, data) => api.put(`/personas.php?id=${id}`, data);
  return { list, get, create, update };
}

export function useTurnos() {
  const list   = (params)   => api.get('/turnos.php', { params });
  const get    = (id)       => api.get('/turnos.php', { params: { id } });
  const create = (data)     => api.post('/turnos.php', data);
  const update = (id, data) => api.put(`/turnos.php?id=${id}`, data);
  const cancel = (id)       => api.delete(`/turnos.php?id=${id}`);
  return { list, get, create, update, cancel };
}

export function useUsuarios() {
  const list   = ()         => api.get('/usuarios.php');
  const create = (data)     => api.post('/usuarios.php', data);
  const update = (id, data) => api.put(`/usuarios.php?id=${id}`, data);
  const remove = (id)       => api.delete(`/usuarios.php?id=${id}`);
  return { list, create, update, remove };
}

export function useDashboard() {
  const get = () => api.get('/dashboard.php');
  return { get };
}
