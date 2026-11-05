import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ActivityBar from '../components/layout/ActivityBar';
import { ApiError, apiClient, isAbortError } from '../services/apiClient';
import { request } from '../services/http';
import { networkActivity } from '../services/networkActivity';
import { onUnauthorized, setAccessToken } from '../services/session';
import { callDetails, fail, mockFetch, ok } from './fetchMock';

afterEach(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
});

describe('apiClient: request interceptor', () => {
  it('uses the base URL and adds a fresh correlation id to every request', async () => {
    const fetchMock = mockFetch(() => ok([]));
    await request('/students');
    await request('/students');

    const [a, b] = [await callDetails(fetchMock, 0), await callDetails(fetchMock, 1)];
    expect(a.url).toBe('http://localhost:5240/api/students');
    expect(a.headers.get('X-Correlation-Id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.headers.get('X-Correlation-Id')).not.toBe(b.headers.get('X-Correlation-Id'));
  });

  it('adds the Bearer token only when there is one', async () => {
    const fetchMock = mockFetch(() => ok([]));
    await request('/students');
    setAccessToken('abc.def.ghi');
    await request('/students');

    expect((await callDetails(fetchMock, 0)).headers.has('Authorization')).toBe(false);
    expect((await callDetails(fetchMock, 1)).headers.get('Authorization')).toBe('Bearer abc.def.ghi');
  });

  it('sends JSON bodies', async () => {
    const fetchMock = mockFetch((_url, { method, body }) => ok({ method, body: JSON.parse(body) }));
    const data = await request('/contacts', { method: 'POST', body: { name: 'Neha' } });
    expect(data).toEqual({ method: 'POST', body: { name: 'Neha' } });
    expect((await callDetails(fetchMock, 0)).headers.get('Content-Type')).toContain('application/json');
  });
});

describe('apiClient: response interceptor', () => {
  it('unwraps the envelope, and returns null for 204', async () => {
    mockFetch((url) => (url.endsWith('/1') ? { status: 204 } : ok([{ id: 1 }])));
    expect(await request('/contacts')).toEqual([{ id: 1 }]);
    expect(await request('/contacts/1', { method: 'DELETE' })).toBeNull();
  });

  it('maps error responses to ApiError with fieldErrors and the server correlation id', async () => {
    mockFetch(() => ({ ...fail(409, 'dup', { email: ['taken'] }), headers: { 'X-Correlation-Id': 'srv-123' } }));
    const error = await request('/contacts', { method: 'POST', body: {} }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: 'dup', status: 409, fieldErrors: { email: ['taken'] }, correlationId: 'srv-123' });
  });

  it('treats a 200 with success: false as an error too', async () => {
    mockFetch(() => ({ status: 200, body: { success: false, data: null, errors: ['nope'] } }));
    await expect(request('/x')).rejects.toMatchObject({ name: 'ApiError', message: 'nope' });
  });

  it('calls the unauthorized listeners on 401 (one place for "session expired")', async () => {
    mockFetch(() => fail(401, 'Unauthorized'));
    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);
    setAccessToken('expired.token'); // only a request that CARRIED a token means "the session expired"

    await request('/contacts').catch(() => {});
    unsubscribe();
    await request('/contacts').catch(() => {});

    expect(listener).toHaveBeenCalledTimes(1); // the second call came after unsubscribe
    expect(listener.mock.calls[0][0]).toMatchObject({ status: 401 });
  });

  it('does NOT treat a 401 without a token (e.g. a wrong password) as "session expired"', async () => {
    mockFetch(() => fail(401, 'Invalid email or password.'));
    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);
    await request('/auth/login', { method: 'POST', body: {} }).catch(() => {});
    unsubscribe();
    expect(listener).not.toHaveBeenCalled();
  });

  it('turns a dead connection into a friendly network error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(request('/x')).rejects.toMatchObject({ code: 'network', message: 'Network error: could not reach the server.' });
  });

  it('gives up after the timeout', async () => {
    mockFetch(() => ({ ...ok([]), delayMs: 500 }));
    const saved = apiClient.defaults.timeout;
    apiClient.defaults.timeout = 30;
    try {
      await expect(request('/slow')).rejects.toMatchObject({ code: 'timeout' });
    } finally {
      apiClient.defaults.timeout = saved;
    }
  });

  it('lets cancellations through as abort errors (not ApiError)', async () => {
    mockFetch(() => ({ ...ok([]), delayMs: 500 }));
    const controller = new AbortController();
    const pending = request('/x', { signal: controller.signal });
    controller.abort();
    const error = await pending.catch((e) => e);
    expect(isAbortError(error)).toBe(true);
    expect(error).not.toBeInstanceOf(ApiError);
  });
});

describe('network activity (useSyncExternalStore)', () => {
  it('the bar shows while requests are in flight, then hides', async () => {
    mockFetch(() => ({ ...ok([]), delayMs: 50 }));
    render(<ActivityBar />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

    let pending;
    act(() => {
      pending = Promise.all([request('/a'), request('/b')]);
    });
    expect(await screen.findByRole('progressbar', { name: '2 requests in progress' })).toBeInTheDocument();

    await act(() => pending);
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
    expect(networkActivity.getSnapshot()).toBe(0); // balanced: every start() had an end()
  });

  it('stays balanced when requests fail', async () => {
    mockFetch(() => fail(500, 'boom'));
    await Promise.allSettled([request('/a'), request('/b')]);
    expect(networkActivity.getSnapshot()).toBe(0);
  });
});
