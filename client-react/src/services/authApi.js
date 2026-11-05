import { request } from './http';

// Phase 8 talks to the DEMO auth endpoints. Phase 12 keeps the same URLs and response shapes (real JWT inside).
export const authApi = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  me: ({ signal } = {}) => request('/auth/me', { signal }),
};

export const adminApi = {
  summary: ({ signal } = {}) => request('/admin/summary', { signal }),
};
