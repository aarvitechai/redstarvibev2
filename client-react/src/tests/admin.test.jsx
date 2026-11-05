import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from '../components/layout/ErrorBoundary';
import { makeStore } from '../store';
import { themeToggled } from '../store/themeSlice';
import { ADMIN, CUSTOMER, loginAs } from './authHelpers';
import { callDetails, fail, mockFetch, ok } from './fetchMock';
import { renderApp } from './renderWithProviders';

const categories = [{ id: 1, name: 'Burgers', slug: 'burgers' }, { id: 2, name: 'Pizza', slug: 'pizza' }];

// A STATEFUL fake of the admin endpoints (products + orders), like the real controllers
function fakeAdminApi({ conflictOnUpdate = false } = {}) {
  let nextId = 20;
  let products = [
    { id: 1, name: 'Classic Burger', description: 'Beef', price: 8.5, categoryId: 1, categoryName: 'Burgers', imageUrl: null, isActive: true, rowVersion: 'v1' },
    { id: 4, name: 'Margherita', description: 'Basil', price: 9, categoryId: 2, categoryName: 'Pizza', imageUrl: null, isActive: true, rowVersion: 'v1' },
  ];
  let orders = [
    { id: 7, customerName: 'Asha Verma', customerEmail: 'asha@redstar.dev', status: 'Pending', total: 19.5, itemCount: 3, createdAt: '2026-11-01T10:00:00Z', rowVersion: 'o1', allowedNextStatuses: ['Confirmed', 'Cancelled'] },
  ];
  const next = { Pending: ['Confirmed', 'Cancelled'], Confirmed: ['Ready', 'Cancelled'], Ready: ['Completed', 'Cancelled'], Completed: [], Cancelled: [] };
  const page = (items) => ok({ items, page: 1, pageSize: 10, totalCount: items.length, totalPages: 1, hasNext: false, hasPrevious: false });

  const fetchMock = mockFetch((url, { method, body, headers }) => {
    const u = new URL(url);
    if (u.pathname === '/api/categories') return ok(categories);
    if (u.pathname === '/api/admin/summary') return ok({ students: 4, contacts: 3, products: products.length, categories: 2 });
    if (u.pathname === '/api/admin/products' && method === 'GET') return page(products.toSorted((a, b) => a.name.localeCompare(b.name)));
    if (u.pathname === '/api/admin/products' && method === 'POST') {
      const input = JSON.parse(body);
      const p = { ...input, id: nextId++, categoryName: categories.find((c) => c.id === input.categoryId).name, imageUrl: null, rowVersion: 'v1' };
      products = [...products, p];
      return { status: 201, body: { success: true, data: p, errors: [] } };
    }
    const image = u.pathname.match(/^\/api\/admin\/products\/(\d+)\/image$/);
    if (image && method === 'POST') {
      if (!headers.get('Content-Type')?.startsWith('multipart/form-data')) return fail(400, 'expected multipart');
      products = products.map((p) => (p.id === Number(image[1]) ? { ...p, imageUrl: `/images/products/${p.id}.png`, rowVersion: 'v2' } : p));
      return ok(products.find((p) => p.id === Number(image[1])));
    }
    const one = u.pathname.match(/^\/api\/admin\/products\/(\d+)$/);
    if (one && method === 'PUT') {
      if (conflictOnUpdate) return fail(409, 'Someone else changed this product while you were editing. Reload it and apply your changes again.');
      const input = JSON.parse(body);
      products = products.map((p) => (p.id === Number(one[1]) ? { ...p, ...input, rowVersion: 'v2' } : p));
      return ok(products.find((p) => p.id === Number(one[1])));
    }
    if (one && method === 'DELETE') {
      products = products.map((p) => (p.id === Number(one[1]) ? { ...p, isActive: false } : p));
      return { status: 204 };
    }
    if (u.pathname === '/api/orders' && method === 'GET') {
      const status = u.searchParams.get('status');
      return page(orders.filter((o) => !status || o.status === status));
    }
    const statusMatch = u.pathname.match(/^\/api\/orders\/(\d+)\/status$/);
    if (statusMatch && method === 'PUT') {
      const { status, rowVersion } = JSON.parse(body);
      const order = orders.find((o) => o.id === Number(statusMatch[1]));
      if (rowVersion !== order.rowVersion) return fail(409, 'Someone else changed this order. Reload it and try again.');
      const updated = { ...order, status, rowVersion: `${order.rowVersion}x`, allowedNextStatuses: next[status] };
      orders = orders.map((o) => (o.id === updated.id ? updated : o));
      return ok(updated);
    }
    return ok([]);
  });
  return { fetchMock, products: () => products, orders: () => orders, bumpOrder: () => { orders = orders.map((o) => ({ ...o, rowVersion: 'changed-elsewhere' })); } };
}

const calls = async (fetchMock) => Promise.all(fetchMock.mock.calls.map((_, i) => callDetails(fetchMock, i)));

afterEach(() => vi.unstubAllGlobals());

describe('admin area (lazy-loaded, admin only)', () => {
  it('loads the overview, and the sub-navigation links to products and orders', async () => {
    fakeAdminApi();
    loginAs(ADMIN);
    renderApp('/admin');

    const nav = await screen.findByRole('navigation', { name: 'Admin' }); // after the lazy chunk loaded
    expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Products' })).toHaveAttribute('href', '/admin/products');
    expect(await screen.findByRole('link', { name: /Products\s*2/ })).toBeInTheDocument(); // the product count from the API
  });

  it('customers are kept out (UX; the API also answers 403)', () => {
    loginAs(CUSTOMER);
    renderApp('/admin/products');
    expect(screen.getByTestId('location').textContent).toBe('/unauthorized');
  });
});

describe('admin products (Project 9)', () => {
  async function openNew(user) {
    await user.click(await screen.findByRole('button', { name: 'New product' }));
    const dialog = screen.getByRole('dialog', { name: 'New product' });
    await within(dialog).findByLabelText('Name'); // the form appears once the categories are loaded
    return dialog;
  }

  it('creates a product WITH an image: POST, then a multipart upload; the table refreshes and a toast confirms', async () => {
    const user = userEvent.setup();
    const { fetchMock } = fakeAdminApi();
    loginAs(ADMIN);
    renderApp('/admin/products');

    const dialog = await openNew(user);
    expect(within(dialog).getByLabelText('Name')).toHaveFocus(); // focus moved into the modal
    await user.type(within(dialog).getByLabelText('Name'), 'Masala Dosa');
    await user.type(within(dialog).getByLabelText('Price (₹)'), '6.75');
    await user.selectOptions(within(dialog).getByLabelText('Category'), 'Pizza');
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'dosa.png', { type: 'image/png' });
    await user.upload(within(dialog).getByLabelText(/Image/), png);
    await user.click(within(dialog).getByRole('button', { name: 'Create product' }));

    expect(await screen.findByText('Created "Masala Dosa".')).toBeInTheDocument(); // toast
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const row = await screen.findByRole('row', { name: 'Masala Dosa' });
    // The thumbnail is DECORATIVE (alt=""), so its role is "presentation", not "img": select the element itself
    await waitFor(() => expect(row.querySelector('img')).toHaveAttribute('src', 'http://localhost:5240/images/products/20.png'));

    const all = await calls(fetchMock);
    const post = all.find((c) => c.method === 'POST' && c.url.endsWith('/api/admin/products'));
    expect(post).toBeDefined();
    const upload = all.find((c) => c.url.endsWith('/api/admin/products/20/image'));
    expect(upload.headers.get('Content-Type')).toMatch(/^multipart\/form-data; boundary=/); // set by the browser, not by us
  });

  it('validates on the client first (no request), including the image type', async () => {
    const user = userEvent.setup({ applyAccept: false }); // let the "wrong" file through the accept= filter, to test OUR check
    const { fetchMock } = fakeAdminApi();
    loginAs(ADMIN);
    renderApp('/admin/products');

    const dialog = await openNew(user);
    await user.upload(within(dialog).getByLabelText(/Image/), new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' }));
    expect(within(dialog).getByText('Choose a JPEG, PNG or WebP image.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Create product' })).toBeDisabled();

    await user.upload(within(dialog).getByLabelText(/Image/), new File([new Uint8Array(10)], 'ok.png', { type: 'image/png' }));
    await user.click(within(dialog).getByRole('button', { name: 'Create product' }));
    expect(await within(dialog).findByText('Name is required.')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose a category.')).toBeInTheDocument();
    expect((await calls(fetchMock)).some((c) => c.method === 'POST')).toBe(false);
  });

  it('edits with the rowVersion it loaded', async () => {
    const user = userEvent.setup();
    const { fetchMock } = fakeAdminApi();
    loginAs(ADMIN);
    renderApp('/admin/products');

    await user.click(within(await screen.findByRole('row', { name: 'Margherita' })).getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit Margherita' });
    expect(await within(dialog).findByLabelText('Category')).toHaveValue('2'); // the REAL category is kept (the bug)
    await user.clear(within(dialog).getByLabelText('Price (₹)'));
    await user.type(within(dialog).getByLabelText('Price (₹)'), '9.5');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Saved "Margherita".')).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([r]) => r.method === 'PUT');
    expect(JSON.parse(await put[0].clone().text())).toMatchObject({ price: 9.5, rowVersion: 'v1' });
    expect(await screen.findByText('₹9.50')).toBeInTheDocument();
  });

  it('a 409 (someone else saved first) shows a toast and closes the form', async () => {
    const user = userEvent.setup();
    fakeAdminApi({ conflictOnUpdate: true });
    loginAs(ADMIN);
    renderApp('/admin/products');

    await user.click(within(await screen.findByRole('row', { name: 'Margherita' })).getByRole('button', { name: 'Edit' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText(/Someone else changed this product/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('delete asks for confirmation, then the row shows Inactive', async () => {
    const user = userEvent.setup();
    fakeAdminApi();
    loginAs(ADMIN);
    renderApp('/admin/products');

    await user.click(within(await screen.findByRole('row', { name: 'Classic Burger' })).getByRole('button', { name: 'Delete' }));
    const confirm = screen.getByRole('dialog', { name: 'Delete product?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('"Classic Burger" is no longer for sale.')).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByRole('row', { name: 'Classic Burger' })).getByText('Inactive')).toBeInTheDocument());
  });

  it('Escape closes the modal and gives focus back to the button that opened it', async () => {
    const user = userEvent.setup();
    fakeAdminApi();
    loginAs(ADMIN);
    renderApp('/admin/products');
    const opener = await screen.findByRole('button', { name: 'New product' });

    await user.click(opener);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});

describe('admin orders', () => {
  it('moves an order to a next status the SERVER allows, and the table refreshes', async () => {
    const user = userEvent.setup();
    const { fetchMock } = fakeAdminApi();
    loginAs(ADMIN);
    renderApp('/admin/orders');

    const row = await screen.findByRole('row', { name: 'Order 7' });
    expect(within(row).getAllByRole('option').map((o) => o.textContent)).toEqual(['Confirmed', 'Cancelled']); // from allowedNextStatuses
    await user.click(within(row).getByRole('button', { name: 'Update' }));

    expect(await screen.findByText('Order #7 is now Confirmed.')).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByRole('row', { name: 'Order 7' })).getAllByRole('option').map((o) => o.textContent)).toEqual(['Ready', 'Cancelled']));
    const put = fetchMock.mock.calls.find(([r]) => r.method === 'PUT');
    expect(JSON.parse(await put[0].clone().text())).toEqual({ status: 'Confirmed', rowVersion: 'o1' });
  });

  it('a 409 from another admin: toast, then the list is refetched', async () => {
    const user = userEvent.setup();
    const api = fakeAdminApi();
    loginAs(ADMIN);
    renderApp('/admin/orders');
    const row = await screen.findByRole('row', { name: 'Order 7' });

    api.bumpOrder(); // another admin saved meanwhile
    await user.click(within(row).getByRole('button', { name: 'Update' }));

    expect(await screen.findByText('Someone else changed this order. The list has been refreshed.')).toBeInTheDocument();
  });

  it('filters by status (the URL holds it)', async () => {
    const user = userEvent.setup();
    fakeAdminApi();
    loginAs(ADMIN);
    renderApp('/admin/orders');
    await screen.findByRole('row', { name: 'Order 7' });

    await user.selectOptions(screen.getByLabelText('Status'), 'Completed');
    expect(screen.getByTestId('location').textContent).toBe('/admin/orders?status=Completed');
    expect(await screen.findByText('No orders with status Completed.')).toBeInTheDocument();
  });
});

describe('polish (plan 14.8)', () => {
  it('the theme choice survives a reload', () => {
    const store = makeStore();
    renderApp('/', { store });
    act(() => {
      store.dispatch(themeToggled());
    });
    expect(localStorage.getItem('redstar.theme')).toBe('dark'); // written by ThemeSync's effect
    expect(makeStore().getState().theme.mode).toBe('dark'); // a "reloaded" app reads it back
  });

  it('the ErrorBoundary shows a fallback instead of a blank page, and can retry', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let explode = true;
    function Bomb() {
      if (explode) throw new Error('boom');
      return <p>Recovered</p>;
    }
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong on this page');
    explode = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });
});
