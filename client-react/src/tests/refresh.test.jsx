import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { request } from '../services/http';
import { getSession, restoreSession, saveSession } from '../services/session';
import { CUSTOMER, loginAs } from './authHelpers';
import { callDetails, fail, mockFetch, ok } from './fetchMock';
import { renderApp } from './renderWithProviders';

// A fake API that behaves like Phase 12's: access tokens expire, and refresh ROTATES the refresh token.
// Only `freshToken` is accepted; `staleToken` (what the test logs in with) gets a 401.
function fakeJwtApi({ refreshWorks = true, refreshDelay = 20 } = {}) {
  const fresh = { accessToken: 'fresh-access', expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(), refreshToken: 'rotated-refresh', user: CUSTOMER };
  const fetchMock = mockFetch((url, { method, body, headers }) => {
    const path = new URL(url).pathname;
    const auth = headers.get('Authorization');
    if (path === '/api/auth/refresh') {
      return refreshWorks && JSON.parse(body).refreshToken === 'original-refresh'
        ? { ...ok(fresh), delayMs: refreshDelay }
        : { ...fail(401, 'Your session has expired. Please log in again.'), delayMs: refreshDelay };
    }
    if (path === '/api/auth/logout') return { status: 204 };
    if (path === '/api/auth/register' && method === 'POST') {
      const input = JSON.parse(body);
      if (input.email === 'asha@redstar.dev') {
        return { status: 409, body: { success: false, data: null, errors: ['dup'], fieldErrors: { email: ['An account with this email already exists.'] } } };
      }
      return { status: 201, body: { success: true, data: { ...fresh, user: { ...CUSTOMER, name: input.name, email: input.email } }, errors: [] } };
    }
    if (auth !== 'Bearer fresh-access') return fail(401, 'Please log in to continue.'); // the old token has expired
    if (path === '/api/auth/me') return ok(CUSTOMER);
    if (path === '/api/destinations') return ok({ items: [], page: 1, pageSize: 6, totalCount: 0, totalPages: 0, hasNext: false, hasPrevious: false });
    return ok({});
  });
  return fetchMock;
}

const calls = async (fetchMock) => Promise.all(fetchMock.mock.calls.map((_, i) => callDetails(fetchMock, i)));
const refreshCalls = async (fetchMock) => (await calls(fetchMock)).filter((c) => c.url.endsWith('/api/auth/refresh'));
const location = () => screen.getByTestId('location').textContent;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('refresh on 401, then retry (Axios)', () => {
  it('an expired access token is refreshed silently, and the request succeeds', async () => {
    const fetchMock = fakeJwtApi();
    loginAs(CUSTOMER, { refreshToken: 'original-refresh' });

    const me = await request('/auth/me');

    expect(me).toEqual(CUSTOMER);
    const all = await calls(fetchMock);
    expect(all.map((c) => new URL(c.url).pathname)).toEqual(['/api/auth/me', '/api/auth/refresh', '/api/auth/me']); // fail, refresh, retry
    expect(all[2].headers.get('Authorization')).toBe('Bearer fresh-access');
    expect(getSession().refreshToken).toBe('rotated-refresh'); // ROTATED: the old one is never used again
  });

  it('SINGLE-FLIGHT: five requests failing together share ONE refresh call', async () => {
    const fetchMock = fakeJwtApi({ refreshDelay: 50 });
    loginAs(CUSTOMER, { refreshToken: 'original-refresh' });

    const results = await Promise.all(Array.from({ length: 5 }, () => request('/auth/me')));

    expect(results).toHaveLength(5);
    expect(await refreshCalls(fetchMock)).toHaveLength(1); // five refreshes would look like token REUSE to the server
  });

  it('if the refresh also fails, the user is logged out with "session expired"', async () => {
    fakeJwtApi({ refreshWorks: false });
    loginAs(CUSTOMER, { refreshToken: 'stolen-or-expired' });
    renderApp('/account');

    await waitFor(() => expect(location()).toBe('/login'));
    expect(screen.getByRole('status')).toHaveTextContent('Your session has expired. Please log in again.');
    expect(getSession()).toBeNull();
  });
});

describe('refresh on 401, then retry (RTK Query)', () => {
  it('the destinations query recovers with the refreshed token, and Redux gets the new session', async () => {
    const fetchMock = fakeJwtApi();
    loginAs(CUSTOMER, { refreshToken: 'original-refresh' });
    const { store } = renderApp('/destinations');

    expect(await screen.findByText('No destinations match.')).toBeInTheDocument(); // loaded after the retry
    expect(store.getState().auth.session.accessToken).toBe('fresh-access');
    expect(await refreshCalls(fetchMock)).toHaveLength(1);
  });
});

describe('session lifetime with refresh tokens', () => {
  it('refreshes PROACTIVELY a minute before the access token expires', async () => {
    const fetchMock = fakeJwtApi();
    loginAs(CUSTOMER, { minutes: 0.5, refreshToken: 'original-refresh' }); // 30 s left: less than the 60 s margin
    const { store } = renderApp('/');

    await waitFor(() => expect(store.getState().auth.session.accessToken).toBe('fresh-access'));
    expect(await refreshCalls(fetchMock)).toHaveLength(1);
  });

  it('a reload with an EXPIRED access token but a refresh token keeps the user signed in', () => {
    const saved = { ...loginAs(CUSTOMER, { refreshToken: 'original-refresh' }), expiresAt: '2000-01-01T00:00:00Z' };
    saveSession(null);
    localStorage.setItem('redstar.session', JSON.stringify(saved));
    expect(restoreSession()?.user.name).toBe('Asha Verma'); // the first request will refresh the access token
  });

  it('logging out revokes the refresh token on the server', async () => {
    const user = userEvent.setup();
    const fetchMock = fakeJwtApi();
    loginAs(CUSTOMER, { refreshToken: 'original-refresh' });
    renderApp('/');

    await user.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: /Log out/ }));

    const logout = (await calls(fetchMock)).find((c) => c.url.endsWith('/api/auth/logout'));
    expect(logout).toBeDefined();
    const [, init] = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/api/auth/logout')); // fetch(url, init)
    expect(JSON.parse(init.body)).toEqual({ refreshToken: 'original-refresh' });
    expect(getSession()).toBeNull();
  });
});

describe('RegisterPage', () => {
  async function fill(user, { name = 'Neha Patel', email = 'neha@example.com', password = 'Str0ng!Pass', confirm = password } = {}) {
    const form = await screen.findByRole('form', { name: 'Create account' });
    await user.type(within(form).getByLabelText('Name'), name);
    await user.type(within(form).getByLabelText('Email'), email);
    await user.type(within(form).getByLabelText('Password'), password);
    await user.type(within(form).getByLabelText('Confirm password'), confirm);
    await user.click(within(form).getByRole('button', { name: 'Create account' }));
    return form;
  }

  it('creates the account, signs in, and goes home', async () => {
    const user = userEvent.setup();
    fakeJwtApi();
    const { store } = renderApp('/register');

    await fill(user);

    await waitFor(() => expect(location()).toBe('/'));
    expect(store.getState().auth.session.user.name).toBe('Neha Patel');
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Log out (Neha)' })).toBeInTheDocument();
  });

  it('checks the confirmation on the client, before calling the API', async () => {
    const user = userEvent.setup();
    const fetchMock = fakeJwtApi();
    renderApp('/register');
    const form = await fill(user, { confirm: 'different' });

    expect(within(form).getByText('The passwords do not match.')).toBeInTheDocument();
    expect((await calls(fetchMock)).some((c) => c.url.endsWith('/register'))).toBe(false);
  });

  it('shows the server field error for a taken email', async () => {
    const user = userEvent.setup();
    fakeJwtApi();
    renderApp('/register');
    const form = await fill(user, { email: 'asha@redstar.dev' });

    expect(await within(form).findByText('An account with this email already exists.')).toBeInTheDocument();
    expect(location()).toBe('/register');
  });

  it('the login page links to it', async () => {
    renderApp('/login');
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register');
  });
});
