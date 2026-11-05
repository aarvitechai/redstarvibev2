import { request } from './http';

// Phase 12: real Identity + JWT behind the same URLs as the Phase 8 demo (plus register, refresh and logout).
export const authApi = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  register: (name, email, password) => request('/auth/register', { method: 'POST', body: { name, email, password } }),
  me: ({ signal } = {}) => request('/auth/me', { signal }),
};

export const adminApi = {
  summary: ({ signal } = {}) => request('/admin/summary', { signal }),
};
