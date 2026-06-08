import axios from 'axios';

const api = axios.create({
  baseURL: '/stock-control/api',
  withCredentials: true,
});

// On 401: dispatch logout event — AuthContext handles it
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
  const list        = (params)   => api.get('/medicamentos.php', { params });
  const get         = (id)       => api.get('/medicamentos.php', { params: { id } });
  const distribucion = (id)      => api.get('/medicamentos.php', { params: { id, distribucion: 1 } });
  const create      = (data)     => api.post('/medicamentos.php', data);
  const update      = (id, data) => api.put(`/medicamentos.php?id=${id}`, data);
  const remove      = (id)       => api.delete(`/medicamentos.php?id=${id}`);
  return { list, get, distribucion, create, update, remove };
}

// Alias for backwards compatibility
export function useProducts() {
  return useMedicamentos();
}

export function useLotes() {
  const list   = (params)   => api.get('/lotes.php', { params });
  const get    = (id)       => api.get('/lotes.php', { params: { id } });
  const create = (data)     => api.post('/lotes.php', data);
  const remove = (id)       => api.delete(`/lotes.php?id=${id}`);
  return { list, get, create, remove };
}

export function useMovimientos() {
  const list   = (params) => api.get('/movimientos.php', { params });
  const create = (data)   => api.post('/movimientos.php', data);
  return { list, create };
}

// Alias for backwards compatibility
export function useMovements() {
  return useMovimientos();
}

export function usePersonas() {
  const list   = (params)     => api.get('/personas.php', { params });
  const get    = (id)         => api.get('/personas.php', { params: { id } });
  const create = (data)       => api.post('/personas.php', data);
  const update = (id, data)   => api.put(`/personas.php?id=${id}`, data);
  const remove = (id)         => api.delete(`/personas.php?id=${id}`);
  return { list, get, create, update, remove };
}

export function useDispensas() {
  const list   = (params) => api.get('/dispensas.php', { params });
  const get    = (ref)    => api.get('/dispensas.php', { params: { ref } });
  const create = (data)   => api.post('/dispensas.php', data);
  return { list, get, create };
}

export function useProveedores() {
  const list   = ()           => api.get('/proveedores.php');
  const get    = (id)         => api.get('/proveedores.php', { params: { id } });
  const create = (data)       => api.post('/proveedores.php', data);
  const update = (id, data)   => api.put(`/proveedores.php?id=${id}`, data);
  const remove = (id)         => api.delete(`/proveedores.php?id=${id}`);
  return { list, get, create, update, remove };
}

// Alias
export function useSuppliers() {
  return useProveedores();
}

export function useCategorias() {
  const list   = ()           => api.get('/categorias.php');
  const create = (data)       => api.post('/categorias.php', data);
  const update = (id, data)   => api.put(`/categorias.php?id=${id}`, data);
  const remove = (id)         => api.delete(`/categorias.php?id=${id}`);
  return { list, create, update, remove };
}

// Alias
export function useCategories() {
  return useCategorias();
}

export function useUbicaciones() {
  const list            = (params)   => api.get('/ubicaciones.php', { params });
  const stockByLocation = (params)   => api.get('/ubicaciones.php', { params: { stock: 1, ...params } });
  const create          = (data)     => api.post('/ubicaciones.php', data);
  const update          = (id, data) => api.put(`/ubicaciones.php?id=${id}`, data);
  const remove          = (id)       => api.delete(`/ubicaciones.php?id=${id}`);
  return { list, stockByLocation, create, update, remove };
}

// Alias
export function useLocations() {
  return useUbicaciones();
}

export function useUsuarios() {
  const list   = ()           => api.get('/usuarios.php');
  const create = (data)       => api.post('/usuarios.php', data);
  const update = (id, data)   => api.put(`/usuarios.php?id=${id}`, data);
  const remove = (id)         => api.delete(`/usuarios.php?id=${id}`);
  return { list, create, update, remove };
}

// Alias
export function useUsers() {
  return useUsuarios();
}

export function useDashboard() {
  const get = () => api.get('/dashboard.php');
  return { get };
}

export function useReportes() {
  const get = (params) => api.get('/reportes.php', { params });
  return { get };
}

export function useFacturas() {
  const list   = ()           => api.get('/facturas.php');
  const get    = (id)         => api.get('/facturas.php', { params: { id } });
  const create = (data)       => api.post('/facturas.php', data);
  const remove = (id)         => api.delete(`/facturas.php?id=${id}`);
  return { list, get, create, remove };
}
