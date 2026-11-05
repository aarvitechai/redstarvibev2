import { API_URL } from '../constants/config';

// Phase 4: plain fetch. Phase 6 replaces this with an Axios instance and interceptors.
// It accepts an AbortSignal, so the caller can cancel a request that's no longer needed.
export async function fetchStudents({ search = '', signal } = {}) {
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  const query = params.size ? `?${params}` : '';

  const response = await fetch(`${API_URL}/students${query}`, { signal });
  const body = await response.json().catch(() => null);

  // Real status code AND the envelope: fail on !ok, and show the server's message when there is one
  if (!response.ok || !body?.success) {
    throw new Error(body?.errors?.[0] ?? `Request failed (${response.status})`);
  }
  return body.data;
}
