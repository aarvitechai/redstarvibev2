import { request } from './http';

// Phase 7: the read-only catalogue (Project 3). Filters go to the API as the same query string the page keeps in its URL.
export const productsApi = {
  categories: ({ signal } = {}) => request('/categories', { signal }),

  list: ({ category, search, sort } = {}, { signal } = {}) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (search?.trim()) params.set('search', search.trim());
    if (sort && sort !== 'name') params.set('sort', sort);
    const query = params.size ? `?${params}` : '';
    return request(`/products${query}`, { signal });
  },

  get: (id, { signal } = {}) => request(`/products/${id}`, { signal }),
};
