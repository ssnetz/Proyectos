import axios from 'axios';

const api = axios.create({ baseURL: '/stock-control/api' });

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
