import { request } from './http';

// Phase 5: the Contacts API. Each function returns the `data` from the envelope, or throws an ApiError.
export const contactsApi = {
  list: ({ signal } = {}) => request('/contacts', { signal }),
  create: (contact) => request('/contacts', { method: 'POST', body: contact }),
  update: (id, contact) => request(`/contacts/${id}`, { method: 'PUT', body: contact }),
  setFavourite: (id, isFavourite) => request(`/contacts/${id}/favourite`, { method: 'PUT', body: { isFavourite } }),
  remove: (id) => request(`/contacts/${id}`, { method: 'DELETE' }),
};
