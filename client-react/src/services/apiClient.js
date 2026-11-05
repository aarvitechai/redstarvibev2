import axios from 'axios';
import { API_TIMEOUT_MS, API_URL } from '../constants/config';
import { networkActivity } from './networkActivity';
import { getAccessToken, notifyUnauthorized } from './session';

export const CORRELATION_HEADER = 'X-Correlation-Id';

// One error type for every API failure. Forms read `fieldErrors`; support can use `correlationId`.
export class ApiError extends Error {
  constructor(message, { status = 0, fieldErrors = null, correlationId = null, code = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.correlationId = correlationId;
    this.code = code;
  }
}

// A cancelled request is not a failure (the user typed again, or the component unmounted)
export const isAbortError = (error) =>
  axios.isCancel(error) || error?.name === 'AbortError' || error?.name === 'CanceledError';

// ONE configured instance. Every service uses it, so base URL, timeout and headers are set in one place.
// adapter: 'fetch' -> Axios uses the browser's fetch (same as Phase 4) instead of XMLHttpRequest.
export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT_MS, // without this, a hung server leaves the spinner on forever
  adapter: 'fetch',
  headers: { Accept: 'application/json' },
});

// ---------- REQUEST interceptor: runs before EVERY request ----------
apiClient.interceptors.request.use((config) => {
  config.headers.set(CORRELATION_HEADER, crypto.randomUUID()); // matches this request with the server's logs
  const token = getAccessToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`); // auth for every call, written once
  networkActivity.start();
  return config;
});

// ---------- RESPONSE interceptor: runs after EVERY response ----------
apiClient.interceptors.response.use(
  (response) => {
    networkActivity.end();
    const envelope = response.data;
    // A 2xx that still says success: false is treated as an error too
    if (response.status !== 204 && envelope && envelope.success === false) {
      throw toApiError(response);
    }
    return response;
  },
  (error) => {
    networkActivity.end();
    if (isAbortError(error)) throw error; // pass cancellations through untouched

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      throw new ApiError('The server took too long to respond. Please try again.', { code: 'timeout' });
    }
    if (!error.response) {
      throw new ApiError('Network error: could not reach the server.', { code: 'network' });
    }

    const apiError = toApiError(error.response);
    if (apiError.status === 401) notifyUnauthorized(apiError); // ONE place handles "session expired"
    throw apiError;
  },
);

function toApiError(response) {
  const envelope = response.data;
  return new ApiError(envelope?.errors?.[0] ?? `Request failed (${response.status})`, {
    status: response.status,
    fieldErrors: envelope?.fieldErrors ?? null,
    correlationId: response.headers?.get?.(CORRELATION_HEADER) ?? response.headers?.[CORRELATION_HEADER.toLowerCase()] ?? null,
  });
}
