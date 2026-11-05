import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { itemAdded } from '../store/cartSlice';
import { ADMIN, CUSTOMER, loginAs } from './authHelpers';
import { callDetails, fail, mockFetch, ok } from './fetchMock';
import { renderApp } from './renderWithProviders';

const PRICES = { 1: ['Classic Burger', 8.5], 7: ['Lemon Iced Tea', 2.5] };

// A STATEFUL fake of /api/orders, behaving like the controller: server-side prices, orders per user, rating rules
function fakeOrdersApi({ startStatus = 'Pending', unavailable = [] } = {}) {
  let nextId = 100;
  const orders = [];
  const fetchMock = mockFetch((url, { method, body }) => {
    const u = new URL(url);
    if (u.pathname === '/api/orders' && method === 'POST') {
      const { items } = JSON.parse(body);
      const missing = items.filter((i) => unavailable.includes(i.productId) || !PRICES[i.productId]);
      if (missing.length) return fail(400, 'Some products are no longer available.', { items: [`Some products are no longer available: ${missing.map((m) => m.productId).join(', ')}.`] });
      const lines = items.map((i, n) => {
        const [name, price] = PRICES[i.productId];
        return { id: n + 1, productId: i.productId, productName: name, unitPrice: price, quantity: i.quantity, lineTotal: price * i.quantity, rating: null };
      });
      const order = { id: nextId++, status: startStatus, total: lines.reduce((s, l) => s + l.lineTotal, 0), createdAt: new Date().toISOString(), lines, rowVersion: 'AA==', canRate: startStatus === 'Completed' };
      orders.unshift(order);
      return { status: 201, body: { success: true, data: order, errors: [] } };
    }
    if (u.pathname === '/api/orders/mine') return ok({ items: orders, page: 1, pageSize: 5, totalCount: orders.length, totalPages: orders.length ? 1 : 0, hasNext: false, hasPrevious: false });
    const rate = u.pathname.match(/^\/api\/orders\/(\d+)\/details\/(\d+)\/rating$/);
    if (rate && method === 'PUT') {
      const order = orders.find((o) => o.id === Number(rate[1]));
      if (!order) return fail(404, 'not found');
      if (order.status !== 'Completed') return fail(400, 'You can rate items once the order is completed.');
      order.lines.find((l) => l.id === Number(rate[2])).rating = JSON.parse(body).rating;
      return ok(order);
    }
    return ok([]);
  });
  return { fetchMock, orders };
}

const location = () => screen.getByTestId('location').textContent;

afterEach(() => vi.unstubAllGlobals());

describe('checkout from the cart', () => {
  it('a customer places the order: ONLY ids and quantities are sent, the cart empties, and "My orders" shows it', async () => {
    const user = userEvent.setup();
    const { fetchMock } = fakeOrdersApi();
    loginAs(CUSTOMER);
    const { store } = renderApp('/cart');
    store.dispatch(itemAdded({ id: 1, name: 'Classic Burger', price: 0.01 })); // a tampered price in the browser...
    store.dispatch(itemAdded({ id: 1, name: 'Classic Burger', price: 0.01 }));
    store.dispatch(itemAdded({ id: 7, name: 'Lemon Iced Tea', price: 2.5 }));

    await user.click(await screen.findByRole('button', { name: 'Place order' }));

    await waitFor(() => expect(location()).toBe('/orders?placed=100'));
    const post = (await Promise.all(fetchMock.mock.calls.map((_, i) => callDetails(fetchMock, i)))).findIndex((c) => c.method === 'POST');
    const sent = JSON.parse(await fetchMock.mock.calls[post][0].clone().text());
    expect(sent).toEqual({ items: [{ productId: 1, quantity: 2 }, { productId: 7, quantity: 1 }] }); // no prices at all

    expect(screen.getByRole('status')).toHaveTextContent('Thank you! Order #100 has been placed.');
    const order = await screen.findByRole('listitem', { name: 'Order 100' });
    expect(within(order).getByText('₹19.50')).toBeInTheDocument(); // ...but the SERVER's price was used
    expect(within(order).getByText('Pending')).toBeInTheDocument();
    expect(store.getState().cart.items).toEqual([]);
  });

  it('anonymous users are asked to log in first (and come back to the cart)', () => {
    const { store } = renderApp('/cart');
    store.dispatch(itemAdded({ id: 1, name: 'Classic Burger', price: 8.5 }));
    return waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Place order' })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
    });
  });

  it('admins cannot check out (the API would answer 403 anyway)', async () => {
    loginAs(ADMIN);
    const { store } = renderApp('/cart');
    store.dispatch(itemAdded({ id: 1, name: 'Classic Burger', price: 8.5 }));
    expect(await screen.findByText(/Admin accounts can't place orders/)).toBeInTheDocument();
  });

  it('an unavailable product: the server error is shown and the cart is kept', async () => {
    const user = userEvent.setup();
    fakeOrdersApi({ unavailable: [7] });
    loginAs(CUSTOMER);
    const { store } = renderApp('/cart');
    store.dispatch(itemAdded({ id: 7, name: 'Lemon Iced Tea', price: 2.5 }));

    await user.click(await screen.findByRole('button', { name: 'Place order' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Some products are no longer available: 7.');
    expect(location()).toBe('/cart');
    expect(store.getState().cart.items).toHaveLength(1);
  });
});

describe('My orders', () => {
  it('is for customers only: admins get /unauthorized, anonymous users /login', () => {
    loginAs(ADMIN);
    const { unmount } = renderApp('/orders');
    expect(location()).toBe('/unauthorized');
    unmount();
    renderApp('/orders');
  });

  it('shows "rate once completed" for a pending order, and no stars', async () => {
    const user = userEvent.setup();
    fakeOrdersApi();
    loginAs(CUSTOMER);
    const { store } = renderApp('/cart');
    store.dispatch(itemAdded({ id: 1, name: 'Classic Burger', price: 8.5 }));
    await user.click(await screen.findByRole('button', { name: 'Place order' }));

    expect(await screen.findByText('You can rate the items once the order is completed.')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('a COMPLETED order can be rated, and the list refetches with the saved rating (tag invalidation)', async () => {
    const user = userEvent.setup();
    const { fetchMock } = fakeOrdersApi({ startStatus: 'Completed' });
    loginAs(CUSTOMER);
    const { store } = renderApp('/cart');
    store.dispatch(itemAdded({ id: 1, name: 'Classic Burger', price: 8.5 }));
    await user.click(await screen.findByRole('button', { name: 'Place order' }));

    const order = await screen.findByRole('listitem', { name: 'Order 100' });
    const stars = within(order).getByRole('group', { name: 'Rate Classic Burger' });
    await user.click(within(stars).getByRole('radio', { name: '4 stars' }));

    await waitFor(() => expect(within(stars).getByRole('radio', { name: '4 stars' })).toBeChecked());
    const calls = await Promise.all(fetchMock.mock.calls.map((_, i) => callDetails(fetchMock, i)));
    expect(calls.some((c) => c.method === 'PUT' && c.url.endsWith('/api/orders/100/details/1/rating'))).toBe(true);
    expect(calls.filter((c) => c.url.includes('/api/orders/mine')).length).toBeGreaterThanOrEqual(2); // refetched after rating
  });

  it('customers see a "My orders" link; admins do not', () => {
    loginAs(CUSTOMER);
    const { unmount } = renderApp('/');
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'My orders' })).toBeInTheDocument();
    unmount();
    loginAs(ADMIN);
    renderApp('/');
    expect(within(screen.getByRole('navigation', { name: 'Main' })).queryByRole('link', { name: 'My orders' })).not.toBeInTheDocument();
  });
});
