import { API_URL } from '../constants/config';
import { request } from './http';

export const PRODUCTS_PAGE_SIZE = 9;

// Image paths come back relative (/images/products/x.png). They live on the API's origin, not the client's.
export const imageSrc = (imageUrl) => (imageUrl ? new URL(imageUrl, API_URL).href : null);

// Phase 7: the read-only catalogue (Project 3). Filters go to the API as the same query string the page keeps in its URL.
export const productsApi = {
  categories: ({ signal } = {}) => request('/categories', { signal }),

  // Phase 11: the API is PAGED and returns { items, page, pageSize, totalCount, totalPages, hasNext, hasPrevious }
  list: ({ category, search, sort, page = 1, pageSize = PRODUCTS_PAGE_SIZE } = {}, { signal } = {}) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (category) params.set('category', category);
    if (search?.trim()) params.set('search', search.trim());
    if (sort && sort !== 'name') params.set('sort', sort);
    const query = params.size ? `?${params}` : '';
    return request(`/products${query}`, { signal });
  },

  get: (id, { signal } = {}) => request(`/products/${id}`, { signal }),
};
