import axios from 'axios';

const api = axios.create({ baseURL: '/stock-control/api' });

// Attach JWT token from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sc_token');
  if (token) {
    config.headers = config.headers ?? {};
    config.headers['Authorization'] = `Bearer ${token}`;
    // X-Token: fallback para XAMPP/Apache que bloquea el header Authorization
    config.headers['X-Token'] = token;
  }
  return config;
});

// On 401, clean up token and emit event (no redirect brusco)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sc_token');
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(error);
  }
);

export function useProducts() {
  const list = (params) => api.get('/products.php', { params });
  const get   = (id)     => api.get('/products.php', { params: { id } });
  const create = (data)  => api.post('/products.php', data);
  const update = (id, data) => api.put(`/products.php?id=${id}`, data);
  const remove = (id)    => api.delete(`/products.php?id=${id}`);
  return { list, get, create, update, remove };
}

export function useMovements() {
  const list   = (params) => api.get('/movements.php', { params });
  const create = (data)   => api.post('/movements.php', data);
  return { list, create };
}

export function useSuppliers() {
  const list   = ()           => api.get('/suppliers.php');
  const get    = (id)         => api.get('/suppliers.php', { params: { id } });
  const create = (data)       => api.post('/suppliers.php', data);
  const update = (id, data)   => api.put(`/suppliers.php?id=${id}`, data);
  const remove = (id)         => api.delete(`/suppliers.php?id=${id}`);
  return { list, get, create, update, remove };
}

export function useCategories() {
  const list   = ()         => api.get('/categories.php');
  const create = (data)     => api.post('/categories.php', data);
  const update = (id, data) => api.put(`/categories.php?id=${id}`, data);
  const remove = (id)       => api.delete(`/categories.php?id=${id}`);
  return { list, create, update, remove };
}

export function useDashboard() {
  const get = () => api.get('/dashboard.php');
  return { get };
}

export function useUsers() {
  const list   = ()           => api.get('/users.php');
  const create = (data)       => api.post('/users.php', data);
  const update = (id, data)   => api.put(`/users.php?id=${id}`, data);
  const remove = (id)         => api.delete(`/users.php?id=${id}`);
  return { list, create, update, remove };
}

export function usePersonas() {
  const list   = (params)     => api.get('/personas.php', { params });
  const get    = (id)         => api.get('/personas.php', { params: { id } });
  const create = (data)       => api.post('/personas.php', data);
  const update = (id, data)   => api.put(`/personas.php?id=${id}`, data);
  const remove = (id)         => api.delete(`/personas.php?id=${id}`);
  return { list, get, create, update, remove };
}

export function useLocations() {
  const list = (params) => api.get('/locations.php', { params });
  return { list };
}

export function useDispensas() {
  const list   = (params)     => api.get('/dispensas.php', { params });
  const get    = (ref)        => api.get('/dispensas.php', { params: { ref } });
  const create = (data)       => api.post('/dispensas.php', data);
  return { list, get, create };
}
