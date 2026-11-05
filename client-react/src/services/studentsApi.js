import { request } from './http';

// It accepts an AbortSignal, so the caller can cancel a request that's no longer needed.
export function fetchStudents({ search = '', signal } = {}) {
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  const query = params.size ? `?${params}` : '';
  return request(`/students${query}`, { signal });
}
