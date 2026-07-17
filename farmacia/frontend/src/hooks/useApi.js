import axios from 'axios';

// withCredentials es obligatorio acá: el backend usa sesión PHP (cookie),
// no JWT, así que cada request necesita mandar la cookie de sesión.
const api = axios.create({ baseURL: '/farmacia/api', withCredentials: true });

// En 401 avisamos a AuthContext (evento en vez de import directo para no
// crear una dependencia circular entre el hook y el contexto).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(error);
  }
);

export function useMedicamentos() {
  return {
    list: (params) => api.get('/medicamentos.php', { params }),
    get: (id) => api.get('/medicamentos.php', { params: { id } }),
    distribucion: (id) => api.get('/medicamentos.php', { params: { id, distribucion: 1 } }),
    create: (data) => api.post('/medicamentos.php', data),
    update: (id, data) => api.put(`/medicamentos.php?id=${id}`, data),
    remove: (id) => api.delete(`/medicamentos.php?id=${id}`),
  };
}

export function useLotes() {
  return {
    list: (params) => api.get('/lotes.php', { params }),
    get: (id) => api.get('/lotes.php', { params: { id } }),
    create: (data) => api.post('/lotes.php', data),
    remove: (id) => api.delete(`/lotes.php?id=${id}`),
  };
}

export function useMovimientos() {
  return {
    list: (params) => api.get('/movimientos.php', { params }),
    create: (data) => api.post('/movimientos.php', data),
  };
}

export function usePersonas() {
  return {
    list: (params) => api.get('/personas.php', { params }),
    get: (id) => api.get('/personas.php', { params: { id } }),
    create: (data) => api.post('/personas.php', data),
    update: (id, data) => api.put(`/personas.php?id=${id}`, data),
    remove: (id) => api.delete(`/personas.php?id=${id}`),
  };
}

export function useDispensas() {
  return {
    list: (params) => api.get('/dispensas.php', { params }),
    get: (ref) => api.get('/dispensas.php', { params: { ref } }),
    create: (data) => api.post('/dispensas.php', data),
  };
}

export function useProveedores() {
  return {
    list: () => api.get('/proveedores.php'),
    get: (id) => api.get('/proveedores.php', { params: { id } }),
    create: (data) => api.post('/proveedores.php', data),
    update: (id, data) => api.put(`/proveedores.php?id=${id}`, data),
    remove: (id) => api.delete(`/proveedores.php?id=${id}`),
  };
}

export function useCategorias() {
  return {
    list: () => api.get('/categorias.php'),
    create: (data) => api.post('/categorias.php', data),
    update: (id, data) => api.put(`/categorias.php?id=${id}`, data),
    remove: (id) => api.delete(`/categorias.php?id=${id}`),
  };
}

export function useUbicaciones() {
  return {
    list: (params) => api.get('/ubicaciones.php', { params }),
    stockByLocation: (params) => api.get('/ubicaciones.php', { params: { stock: 1, ...params } }),
    create: (data) => api.post('/ubicaciones.php', data),
    update: (id, data) => api.put(`/ubicaciones.php?id=${id}`, data),
    remove: (id) => api.delete(`/ubicaciones.php?id=${id}`),
  };
}

export function useUsuarios() {
  return {
    list: () => api.get('/usuarios.php'),
    create: (data) => api.post('/usuarios.php', data),
    update: (id, data) => api.put(`/usuarios.php?id=${id}`, data),
    remove: (id) => api.delete(`/usuarios.php?id=${id}`),
  };
}

export function useDashboard() {
  return { get: () => api.get('/dashboard.php') };
}

export function useReportes() {
  return { get: (params) => api.get('/reportes.php', { params }) };
}

export function useFacturas() {
  return {
    list: () => api.get('/facturas.php'),
    get: (id) => api.get('/facturas.php', { params: { id } }),
    create: (data) => api.post('/facturas.php', data),
    remove: (id) => api.delete(`/facturas.php?id=${id}`),
  };
}
