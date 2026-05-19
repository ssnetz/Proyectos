import axios from 'axios';

const api = axios.create({ baseURL: '/stock-control/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sc_token');
  if (token) {
    config.headers = config.headers ?? {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sc_token');
      window.location.href = '/stock-control/login';
    }
    return Promise.reject(error);
  }
);

export function useProducts() {
  const list   = (params)     => api.get('/products.php', { params });
  const get    = (id)         => api.get('/products.php', { params: { id } });
  const create = (data)       => api.post('/products.php', data);
  const update = (id, data)   => api.put(`/products.php?id=${id}`, data);
  const remove = (id)         => api.delete(`/products.php?id=${id}`);
  return { list, get, create, update, remove };
}

export function useMovements() {
  const list   = (params) => api.get('/movements.php', { params });
  const create = (data)   => api.post('/movements.php', data);
  return { list, create };
}

export function useLocations() {
  const list   = (params)     => api.get('/locations.php', { params });
  const get    = (id)         => api.get('/locations.php', { params: { id } });
  const create = (data)       => api.post('/locations.php', data);
  const update = (id, data)   => api.put(`/locations.php?id=${id}`, data);
  const remove = (id)         => api.delete(`/locations.php?id=${id}`);
  return { list, get, create, update, remove };
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
  const list   = ()           => api.get('/categories.php');
  const create = (data)       => api.post('/categories.php', data);
  const update = (id, data)   => api.put(`/categories.php?id=${id}`, data);
  const remove = (id)         => api.delete(`/categories.php?id=${id}`);
  return { list, create, update, remove };
}

export function useDashboard() {
  const get = () => api.get('/dashboard.php');
  return { get };
}

export function useInventory() {
  const list = (params) => api.get('/inventory.php', { params });
  const save = (data)   => api.post('/inventory.php', data);
  return { list, save };
}

export function useLots() {
  const list   = (params) => api.get('/lots.php', { params });
  const create = (data)   => api.post('/lots.php', data);
  return { list, create };
}

export function useUsers() {
  const list   = ()           => api.get('/users.php');
  const create = (data)       => api.post('/users.php', data);
  const update = (id, data)   => api.put(`/users.php?id=${id}`, data);
  const remove = (id)         => api.delete(`/users.php?id=${id}`);
  return { list, create, update, remove };
}
