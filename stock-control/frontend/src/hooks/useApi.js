import axios from 'axios';

const api = axios.create({ baseURL: '/stock-control/api' });

// Attach JWT token from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sc_token');
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
      localStorage.removeItem('sc_token');
      // Redirect to login (works even without React Router context)
      window.location.href = '/stock-control/login';
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

export function useBeneficiarios() {
  const list   = (params)     => api.get('/beneficiarios.php', { params });
  const get    = (id)         => api.get('/beneficiarios.php', { params: { id } });
  const create = (data)       => api.post('/beneficiarios.php', data);
  const update = (id, data)   => api.put(`/beneficiarios.php?id=${id}`, data);
  const remove = (id)         => api.delete(`/beneficiarios.php?id=${id}`);
  return { list, get, create, update, remove };
}

export function useDispensas() {
  const list   = (params)     => api.get('/dispensas.php', { params });
  const get    = (id)         => api.get('/dispensas.php', { params: { id } });
  const create = (data)       => api.post('/dispensas.php', data);
  return { list, get, create };
}
