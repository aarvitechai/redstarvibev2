import { API_URL } from '../constants/config';

// One error type for every API failure. Forms read `fieldErrors` to show messages next to their inputs.
export class ApiError extends Error {
  constructor(message, { status = 0, fieldErrors = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors; // e.g. { email: ["Email '...' is already in use."] }
  }
}

// The single place that knows how to talk to our API: base URL, JSON, the envelope, and errors.
// Phase 6 replaces this with an Axios instance and interceptors; callers won't need to change.
export async function request(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    signal,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) return null; // No Content (DELETE)

  const envelope = await response.json().catch(() => null);
  if (!response.ok || !envelope?.success) {
    throw new ApiError(envelope?.errors?.[0] ?? `Request failed (${response.status})`, {
      status: response.status,
      fieldErrors: envelope?.fieldErrors ?? null,
    });
  }
  return envelope.data;
}
