import { apiClient } from './apiClient';

export { ApiError, isAbortError } from './apiClient';

// Phase 6: the same signature as Phase 5's fetch version, now on Axios.
// This is WHY API calls live in a service layer: the transport changed, and not one component had to.
export async function request(path, { method = 'GET', body, signal } = {}) {
  const response = await apiClient.request({ url: path, method, data: body, signal });
  return response.status === 204 ? null : response.data.data; // unwrap the envelope
}
