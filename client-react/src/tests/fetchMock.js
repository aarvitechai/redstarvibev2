import { vi } from 'vitest';

// A fake fetch that behaves like the real one where it matters:
//  - accepts either fetch(url, init) or fetch(Request), which is what Axios's fetch adapter sends
//  - resolves with a real Response (status + JSON body + headers)
//  - rejects with an AbortError when the request's signal is aborted
// `handler(url, { method, body, headers })` returns { status, body, delayMs, headers } for each request.
export function mockFetch(handler) {
  const fetchMock = vi.fn(async (input, init = {}) => {
    const isRequest = typeof input === 'object' && input !== null && 'url' in input;
    const url = isRequest ? input.url : String(input);
    const method = (isRequest ? input.method : init.method) ?? 'GET';
    const headers = new Headers(isRequest ? input.headers : init.headers);
    // Don't read MULTIPART bodies (file uploads): in this test environment reading a FormData stream never finishes.
    // Handlers that care can still check the Content-Type header.
    const isMultipart = headers.get('Content-Type')?.startsWith('multipart/form-data');
    const body = isMultipart ? '[multipart]' : isRequest ? (await input.clone().text()) || undefined : init.body;
    const signal = init.signal ?? (isRequest ? input.signal : undefined);

    const { status = 200, body: resBody, delayMs = 0, headers: resHeaders = {} } = handler(url, { method, body, headers });

    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new DOMException('The operation was aborted.', 'AbortError'));
      const timer = setTimeout(() => {
        const responseHeaders = { 'Content-Type': 'application/json', ...resHeaders };
        resolve(status === 204 ? new Response(null, { status, headers: resHeaders }) : new Response(JSON.stringify(resBody), { status, headers: responseHeaders }));
      }, delayMs);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      });
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

// Read what a recorded call sent, whichever form fetch was called with
export async function callDetails(fetchMock, index) {
  const [input, init = {}] = fetchMock.mock.calls[index];
  const isRequest = typeof input === 'object' && 'url' in input;
  return {
    url: isRequest ? input.url : String(input),
    method: (isRequest ? input.method : init.method) ?? 'GET',
    headers: new Headers(isRequest ? input.headers : init.headers),
    signal: init.signal ?? (isRequest ? input.signal : undefined),
  };
}

export const ok = (data) => ({ status: 200, body: { success: true, data, errors: [] } });
export const fail = (status, message, fieldErrors) => ({
  status,
  body: { success: false, data: null, errors: [message], fieldErrors: fieldErrors ?? null },
});
