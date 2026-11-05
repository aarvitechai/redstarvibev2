import { vi } from 'vitest';

// A fake fetch that behaves like the real one where it matters:
//  - resolves with a real Response (status + JSON body)
//  - rejects with an AbortError when the request's signal is aborted
// `handler(url, init)` returns { status, body, delayMs } for each request. init has method and body.
export function mockFetch(handler) {
  const fetchMock = vi.fn((url, init = {}) => {
    const { signal } = init;
    const { status = 200, body, delayMs = 0 } = handler(String(url), { method: 'GET', ...init });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => resolve(status === 204 ? new Response(null, { status }) : new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })),
        delayMs,
      );
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      });
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export const ok = (data) => ({ status: 200, body: { success: true, data, errors: [] } });
export const fail = (status, message) => ({ status, body: { success: false, data: null, errors: [message] } });
