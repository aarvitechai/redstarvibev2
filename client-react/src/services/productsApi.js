import { API_URL } from '../constants/config';
import { request } from './http';

export const PRODUCTS_PAGE_SIZE = 9;

// Image paths come back relative (/images/products/x.png). They live on the API's origin, not the client's.
// Phase 15: API_URL may itself be RELATIVE ("/api", behind a reverse proxy that serves client and API on one origin).
// new URL(path, "/api") THROWS (a relative base has no origin), so resolve the API URL against the page first.
export const resolveImageUrl = (imageUrl, apiUrl, pageOrigin) =>
  imageUrl ? new URL(imageUrl, new URL(apiUrl, pageOrigin)).href : null;
export const imageSrc = (imageUrl) => resolveImageUrl(imageUrl, API_URL, window.location.origin);

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
