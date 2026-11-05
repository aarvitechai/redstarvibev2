import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGetDestinationsQuery } from '../store/api/destinationsApi';
import { getAccessToken as getSessionToken } from '../services/session';
import { CUSTOMER, loginAs } from './authHelpers';
import { callDetails, fail, mockFetch, ok } from './fetchMock';
import { renderApp, renderWithProviders } from './renderWithProviders';

// A STATEFUL fake of /api/destinations: paging, search, visited filter and writes, like the real controller.
// With it, a test can show that a mutation really makes the list refetch fresh data.
function fakeDestinationsApi({ visitedStatus = 200, visitedDelay = 0 } = {}) {
  let nextId = 15;
  let items = [
    'Cape Town', 'Cusco', 'Hampi', 'Hanoi', 'Istanbul', 'Jaipur', 'Kerala Backwaters',
    'Kyoto', 'Leh', 'Lisbon', 'Marrakesh', 'Queenstown', 'Reykjavik', 'Varanasi',
  ].map((name, i) => ({ id: i + 1, name, country: 'Somewhere', description: '', rating: 4, isVisited: false, createdAt: '2026-01-01T00:00:00Z' }));

  const fetchMock = mockFetch((url, { method, body, headers }) => {
    const u = new URL(url);
    const authed = headers.get('Authorization')?.startsWith('Bearer ');
    const write = method !== 'GET';
    if (write && !authed) return fail(401, 'Please log in to continue.');

    const visitedMatch = u.pathname.match(/^\/api\/destinations\/(\d+)\/visited$/);
    if (visitedMatch && method === 'PUT') {
      if (visitedStatus !== 200) return { ...fail(visitedStatus, 'Server refused'), delayMs: visitedDelay };
      const d = items.find((x) => x.id === Number(visitedMatch[1]));
      d.isVisited = JSON.parse(body).isVisited;
      return { ...ok(d), delayMs: visitedDelay };
    }
    const idMatch = u.pathname.match(/^\/api\/destinations\/(\d+)$/);
    if (idMatch && method === 'DELETE') {
      items = items.filter((x) => x.id !== Number(idMatch[1]));
      return { status: 204 };
    }
    if (u.pathname === '/api/destinations' && method === 'POST') {
      const input = JSON.parse(body);
      if (items.some((x) => x.name.toLowerCase() === input.name.toLowerCase())) {
        return { status: 409, body: { success: false, data: null, errors: ['dup'], fieldErrors: { name: [`${input.name} is already in your list.`] } } };
      }
      const d = { ...input, id: nextId++, createdAt: '2026-01-02T00:00:00Z' };
      items.push(d);
      return { status: 201, body: { success: true, data: d, errors: [] } };
    }
    if (u.pathname === '/api/destinations' && method === 'GET') {
      const page = Number(u.searchParams.get('page') ?? 1);
      const pageSize = Number(u.searchParams.get('pageSize') ?? 6);
      const q = u.searchParams.get('search')?.toLowerCase();
      const all = items.filter((d) => !q || d.name.toLowerCase().includes(q)).toSorted((a, b) => a.name.localeCompare(b.name));
      const totalPages = Math.ceil(all.length / pageSize);
      return ok({ items: all.slice((page - 1) * pageSize, page * pageSize), page, pageSize, totalCount: all.length, totalPages, hasNext: page < totalPages, hasPrevious: page > 1 });
    }
    return fail(404, 'not mocked');
  });
  return fetchMock;
}

const listGets = async (fetchMock) => {
  const calls = await Promise.all(fetchMock.mock.calls.map((_, i) => callDetails(fetchMock, i)));
  return calls.filter((c) => c.method === 'GET' && new URL(c.url).pathname === '/api/destinations');
};
const names = () => within(screen.getByRole('list', { name: 'Destinations' })).getAllByRole('listitem').map((li) => li.getAttribute('aria-label'));
const location = () => screen.getByTestId('location').textContent;

beforeEach(() => vi.useRealTimers());
afterEach(() => vi.unstubAllGlobals());

describe('queries: caching, de-duplication, paging', () => {
  it('loads page 1, shows the range, and PREFETCHES page 2 before Next is clicked', async () => {
    const fetchMock = fakeDestinationsApi();
    renderApp('/destinations');

    expect(await screen.findByText('Showing 1–6 of 14')).toBeInTheDocument();
    expect(names()).toEqual(['Cape Town', 'Cusco', 'Hampi', 'Hanoi', 'Istanbul', 'Jaipur']);
    await waitFor(async () => expect((await listGets(fetchMock)).map((c) => new URL(c.url).searchParams.get('page'))).toEqual(['1', '2']));

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Next →' }));
    expect(location()).toBe('/destinations?page=2');
    expect(screen.getByText('Showing 7–12 of 14')).toBeInTheDocument(); // instantly: it came from the cache
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('two components asking for the same data share ONE request', async () => {
    const fetchMock = fakeDestinationsApi();
    function Count() {
      const { data } = useGetDestinationsQuery({ page: 1 });
      return <p>{data ? `total ${data.totalCount}` : 'loading'}</p>;
    }
    renderWithProviders(<><Count /><Count /><Count /></>);

    await waitFor(() => expect(screen.getAllByText('total 14')).toHaveLength(3));
    expect(await listGets(fetchMock)).toHaveLength(1); // de-duplicated by the cache key { page: 1 }
  });

  it('leaving and coming back uses the cache (no new request, no "Loading…")', async () => {
    const user = userEvent.setup();
    const fetchMock = fakeDestinationsApi();
    renderApp('/destinations');
    await screen.findByText('Showing 1–6 of 14');
    await waitFor(async () => expect(await listGets(fetchMock)).toHaveLength(2)); // page 1 + the prefetched page 2

    const nav = screen.getByRole('navigation', { name: 'Main' });
    await user.click(within(nav).getByRole('link', { name: 'Students' }));
    expect(screen.queryByText('Showing 1–6 of 14')).not.toBeInTheDocument(); // the page unmounted...
    await user.click(within(nav).getByRole('link', { name: 'Destinations' }));

    expect(screen.getByText('Showing 1–6 of 14')).toBeInTheDocument(); // ...and is back instantly, with no "Loading…"
    expect(await listGets(fetchMock)).toHaveLength(2); // still 2: served from the cache (keepUnusedDataFor: 60 s)
  });

  it('prepareHeaders adds the token only when logged in', async () => {
    const fetchMock = fakeDestinationsApi();
    renderApp('/destinations');
    await screen.findByText('Showing 1–6 of 14');
    expect((await listGets(fetchMock))[0].headers.has('Authorization')).toBe(false);
  });
});

describe('mutations + tags: the list stays in sync without "reload" code', () => {
  it('adding invalidates LIST, so the list refetches and shows the new item', async () => {
    const user = userEvent.setup();
    const fetchMock = fakeDestinationsApi();
    loginAs(CUSTOMER);
    renderApp('/destinations');
    await screen.findByText('Showing 1–6 of 14');

    const form = screen.getByRole('form', { name: 'Add destination' });
    await user.type(within(form).getByLabelText('Name'), 'Agra');
    await user.type(within(form).getByLabelText('Country'), 'India');
    await user.click(within(form).getByRole('button', { name: 'Add destination' }));

    await waitFor(() => expect(screen.getByText('Showing 1–6 of 15')).toBeInTheDocument());
    expect(names()[0]).toBe('Agra'); // fresh data from the server, sorted by the server
    const posts = (await Promise.all(fetchMock.mock.calls.map((_, i) => callDetails(fetchMock, i)))).filter((c) => c.method === 'POST');
    expect(posts[0].headers.get('Authorization')).toBe(`Bearer ${getSessionToken()}`); // prepareHeaders read the token from Redux
  });

  it('deleting invalidates the item and LIST', async () => {
    const user = userEvent.setup();
    fakeDestinationsApi();
    loginAs(CUSTOMER);
    renderApp('/destinations');
    await screen.findByText('Showing 1–6 of 14');

    const card = screen.getByRole('listitem', { name: 'Cusco' });
    await user.click(within(card).getByRole('button', { name: 'Delete' }));
    await user.click(within(card).getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => expect(screen.getByText('Showing 1–6 of 13')).toBeInTheDocument());
    expect(names()).not.toContain('Cusco');
  });

  it('a 409 from the server shows on the Name field', async () => {
    const user = userEvent.setup();
    fakeDestinationsApi();
    loginAs(CUSTOMER);
    renderApp('/destinations');
    await screen.findByText('Showing 1–6 of 14');

    const form = screen.getByRole('form', { name: 'Add destination' });
    await user.type(within(form).getByLabelText('Name'), 'Kyoto');
    await user.type(within(form).getByLabelText('Country'), 'Japan');
    await user.click(within(form).getByRole('button', { name: 'Add destination' }));

    expect(await within(form).findByText('Kyoto is already in your list.')).toBeInTheDocument();
  });

  it('OPTIMISTIC visited: the checkbox flips before the server answers', async () => {
    const user = userEvent.setup();
    fakeDestinationsApi({ visitedDelay: 500 });
    loginAs(CUSTOMER);
    const { store } = renderApp('/destinations');
    await screen.findByText('Showing 1–6 of 14');

    const box = within(screen.getByRole('listitem', { name: 'Hampi' })).getByRole('checkbox', { name: 'Visited' });
    await user.click(box);
    await waitFor(() => expect(box).toBeChecked()); // the cache was patched...
    const [mutation] = Object.values(store.getState().api.mutations);
    expect(mutation.status).toBe('pending'); // ...while the PUT is still in flight
  });

  it('OPTIMISTIC ROLLBACK: if the server refuses, the checkbox goes back', async () => {
    const user = userEvent.setup();
    fakeDestinationsApi({ visitedStatus: 500, visitedDelay: 50 });
    loginAs(CUSTOMER);
    renderApp('/destinations');
    await screen.findByText('Showing 1–6 of 14');

    const box = within(screen.getByRole('listitem', { name: 'Hampi' })).getByRole('checkbox', { name: 'Visited' });
    await user.click(box);
    await waitFor(() => expect(box).toBeChecked()); // optimistic
    await waitFor(() => expect(box).not.toBeChecked()); // patch.undo() after the 500
  });
});

describe('auth integration', () => {
  it('anonymous users see no add form and cannot tick boxes (UX; the API also returns 401)', async () => {
    fakeDestinationsApi();
    renderApp('/destinations');
    await screen.findByText('Showing 1–6 of 14');
    expect(screen.queryByRole('form', { name: 'Add destination' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('listitem', { name: 'Hampi' })).getByRole('checkbox')).toBeDisabled();
  });

  it('a 401 for a request that carried a token logs out and clears the cache', async () => {
    const user = userEvent.setup();
    loginAs(CUSTOMER);
    const { store } = renderApp('/destinations');
    mockFetch((url, { method }) => (method === 'PUT' ? fail(401, 'Please log in to continue.') : ok({ items: [{ id: 1, name: 'Hampi', country: 'India', description: '', rating: 4, isVisited: false }], page: 1, pageSize: 6, totalCount: 1, totalPages: 1, hasNext: false, hasPrevious: false })));
    await act(() => store.dispatch({ type: 'noop' }));
    await screen.findByText('Showing 1–1 of 1');

    await user.click(within(screen.getByRole('listitem', { name: 'Hampi' })).getByRole('checkbox'));

    await waitFor(() => expect(store.getState().auth.session).toBeNull());
    expect(store.getState().auth.logoutReason).toBe('expired');
  });
});
