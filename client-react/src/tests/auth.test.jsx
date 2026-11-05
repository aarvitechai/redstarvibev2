import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSession, restoreSession, saveSession } from '../services/session';
import { safeRedirect } from '../utility/redirect';
import { ADMIN, CUSTOMER, loginAs } from './authHelpers';
import { callDetails, fail, mockFetch, ok } from './fetchMock';
import { renderApp } from './renderWithProviders';

const location = () => screen.getByTestId('location').textContent;
const nav = () => screen.getByRole('navigation', { name: 'Main' });

// A fake auth API that behaves like the demo endpoints
function fakeAuthApi({ meStatus = 200 } = {}) {
  return mockFetch((url, { method, body, headers }) => {
    const path = new URL(url).pathname;
    const token = headers.get('Authorization')?.replace('Bearer ', '');
    if (method === 'POST' && path === '/api/auth/login') {
      const { email, password } = JSON.parse(body);
      const user = [ADMIN, CUSTOMER].find((u) => u.email === email);
      if (!user || password !== (user === ADMIN ? 'Admin@123' : 'Customer@123')) return fail(401, 'Invalid email or password.');
      return ok({ accessToken: `demo.${user.id}.9999999999`, expiresAt: new Date(Date.now() + 1_800_000).toISOString(), user });
    }
    if (path === '/api/auth/me') {
      if (!token || meStatus === 401) return fail(401, 'Please log in to continue.');
      return ok(token.startsWith('demo.1.') ? ADMIN : CUSTOMER);
    }
    if (path === '/api/admin/summary') {
      if (!token) return fail(401, 'Please log in to continue.');
      if (!token.startsWith('demo.1.')) return fail(403, "You don't have permission to do that.");
      return ok({ students: 4, contacts: 3, products: 11, categories: 4 });
    }
    return ok([]);
  });
}

async function logIn(user, email, password) {
  const form = await screen.findByRole('form', { name: 'Log in' });
  await user.type(within(form).getByLabelText('Email'), email);
  await user.type(within(form).getByLabelText('Password'), password);
  await user.click(within(form).getByRole('button', { name: 'Log in' }));
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('ProtectedRoute + redirect after login', () => {
  it('anonymous -> /login, then back to the page they wanted after logging in', async () => {
    const user = userEvent.setup();
    fakeAuthApi();
    renderApp('/account');

    expect(location()).toBe('/login'); // redirected
    expect(screen.getByText('/account')).toBeInTheDocument(); // "Log in to continue to /account"

    await logIn(user, 'asha@redstar.dev', 'Customer@123');

    await waitFor(() => expect(location()).toBe('/account')); // sent back where they were going
    expect(await screen.findByText(/Server says: Asha Verma \(Customer\)/)).toBeInTheDocument();
  });

  it('a wrong password shows the server message and does NOT redirect or loop', async () => {
    const user = userEvent.setup();
    fakeAuthApi();
    renderApp('/login');

    await logIn(user, 'asha@redstar.dev', 'nope');

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(location()).toBe('/login');
    expect(screen.getByLabelText('Email')).toHaveValue('asha@redstar.dev'); // kept for a retry
    expect(getSession()).toBeNull();
  });

  it('visiting /login while already logged in redirects away (no login <-> page loop)', () => {
    loginAs(CUSTOMER);
    renderApp('/login');
    expect(location()).toBe('/');
  });

  it('a customer opening /admin by URL gets /unauthorized (403), not /login (401)', () => {
    loginAs(CUSTOMER);
    renderApp('/admin');
    expect(location()).toBe('/unauthorized');
    expect(screen.getByRole('heading', { level: 1, name: "You don't have access to this page" })).toBeInTheDocument();
    expect(screen.getByText('/admin')).toBeInTheDocument();
  });

  it('an admin can open /admin', async () => {
    fakeAuthApi();
    loginAs(ADMIN);
    renderApp('/admin');
    expect(location()).toBe('/admin');
    expect(await screen.findByText('11')).toBeInTheDocument(); // products, from the API
  });
});

describe('role-based UI (convenience, not security)', () => {
  it('anonymous: "Log in", no Account or Admin links', () => {
    renderApp('/');
    expect(within(nav()).getByRole('link', { name: 'Log in' })).toBeInTheDocument();
    expect(within(nav()).queryByRole('link', { name: 'Account' })).not.toBeInTheDocument();
    expect(within(nav()).queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('customer: Account, no Admin; admin: both', () => {
    loginAs(CUSTOMER);
    const { unmount } = renderApp('/');
    expect(within(nav()).getByRole('link', { name: 'Account' })).toBeInTheDocument();
    expect(within(nav()).queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    unmount();

    loginAs(ADMIN);
    renderApp('/');
    expect(within(nav()).getByRole('link', { name: 'Admin' })).toBeInTheDocument();
  });

  it('THE LESSON: a customer calling the admin API directly is refused by the SERVER (403)', async () => {
    const user = userEvent.setup();
    const fetchMock = fakeAuthApi();
    loginAs(CUSTOMER);
    renderApp('/account');

    await user.click(await screen.findByRole('button', { name: 'GET /api/admin/summary' }));

    expect(await screen.findByRole('status')).toHaveTextContent("403: You don't have permission to do that.");
    const calls = await Promise.all(fetchMock.mock.calls.map((_, i) => callDetails(fetchMock, i)));
    expect(calls.find((c) => c.url.endsWith('/api/admin/summary')).headers.get('Authorization')).toMatch(/^Bearer demo\.2\./);
    expect(location()).toBe('/account'); // a 403 is not "logged out"
  });

  it('Log out clears the session and protected pages redirect to /login', async () => {
    const user = userEvent.setup();
    fakeAuthApi();
    loginAs(CUSTOMER);
    renderApp('/account');

    await user.click(within(nav()).getByRole('button', { name: 'Log out (Asha)' }));

    expect(getSession()).toBeNull();
    expect(location()).toBe('/login');
  });
});

describe('session lifetime', () => {
  it('is saved to localStorage, and restored on the next page load', () => {
    const saved = loginAs(CUSTOMER);
    saveSession(null);
    localStorage.setItem('redstar.session', JSON.stringify(saved)); // as if the browser was reloaded

    expect(restoreSession()).toEqual(saved);
    expect(getSession().user.name).toBe('Asha Verma');
  });

  it('an expired or corrupted saved session is discarded on load', () => {
    localStorage.setItem('redstar.session', JSON.stringify({ ...loginAs(CUSTOMER), expiresAt: '2000-01-01T00:00:00Z' }));
    expect(restoreSession()).toBeNull();
    expect(localStorage.getItem('redstar.session')).toBeNull();

    localStorage.setItem('redstar.session', '{not json');
    expect(restoreSession()).toBeNull();
  });

  it('logs out automatically when the token expires, and the protected page sends the user to /login', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fakeAuthApi();
    loginAs(CUSTOMER, { minutes: 1 });
    renderApp('/account');
    expect(location()).toBe('/account');

    await act(() => vi.advanceTimersByTimeAsync(61_000));

    expect(getSession()).toBeNull();
    expect(location()).toBe('/login');
  });

  it('a 401 from the API (token revoked server-side) logs out and says why', async () => {
    fakeAuthApi({ meStatus: 401 });
    loginAs(CUSTOMER);
    renderApp('/account');

    await waitFor(() => expect(location()).toBe('/login'));
    expect(screen.getByRole('status')).toHaveTextContent('Your session has expired. Please log in again.');
    expect(getSession()).toBeNull();
  });
});

describe('safeRedirect (no open redirects, no loops)', () => {
  it.each([
    [{ pathname: '/account', search: '?tab=1' }, '/account?tab=1'],
    ['/products?category=pizza', '/products?category=pizza'],
    ['https://evil.example/phish', '/'], // another site
    ['//evil.example', '/'], // protocol-relative URL: also another site
    ['/login', '/'], // would loop
    [undefined, '/'],
  ])('%j -> %s', (from, expected) => {
    expect(safeRedirect(from)).toBe(expected);
  });
});
