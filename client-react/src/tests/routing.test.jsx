import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { callDetails, fail, mockFetch, ok } from './fetchMock';
import { renderApp } from './renderWithProviders';

const categories = [
  { id: 1, name: 'Burgers', slug: 'burgers' },
  { id: 2, name: 'Pizza', slug: 'pizza' },
];
const all = [
  { id: 1, name: 'Classic Burger', description: 'Beef', price: 8.5, categoryId: 1, categoryName: 'Burgers', categorySlug: 'burgers' },
  { id: 4, name: 'Margherita', description: 'Basil', price: 9, categoryId: 2, categoryName: 'Pizza', categorySlug: 'pizza' },
  { id: 6, name: 'Paneer Tikka Pizza', description: 'Paneer', price: 11, categoryId: 2, categoryName: 'Pizza', categorySlug: 'pizza' },
];

// A fake catalogue API that filters like the real one
function fakeCatalog() {
  return mockFetch((url) => {
    const u = new URL(url);
    if (u.pathname === '/api/categories') return ok(categories);
    const detail = u.pathname.match(/^\/api\/products\/(\d+)$/);
    if (detail) {
      const p = all.find((x) => x.id === Number(detail[1]));
      return p ? ok(p) : fail(404, 'Product not found');
    }
    if (u.pathname === '/api/products') {
      const cat = u.searchParams.get('category');
      const q = u.searchParams.get('search')?.toLowerCase();
      let list = all.filter((p) => (!cat || p.categorySlug === cat) && (!q || p.name.toLowerCase().includes(q)));
      if (u.searchParams.get('sort') === 'priceDesc') list = list.toSorted((a, b) => b.price - a.price);
      // Phase 11: the API returns a PAGE
      return ok({ items: list, page: 1, pageSize: 9, totalCount: list.length, totalPages: 1, hasNext: false, hasPrevious: false });
    }
    return fail(404, 'not mocked');
  });
}

const location = () => screen.getByTestId('location').textContent;
const productNames = async () => {
  const list = await screen.findByRole('list', { name: 'Products' });
  await waitFor(() => expect(list).toHaveAttribute('aria-busy', 'false'));
  return within(list).queryAllByRole('link').map((a) => within(a).getByText((_, el) => el.tagName === 'STRONG').textContent);
};

afterEach(() => vi.unstubAllGlobals());

describe('routing basics', () => {
  it('Link navigates WITHOUT a page reload, and NavLink marks the active page', async () => {
    const user = userEvent.setup();
    fakeCatalog();
    renderApp('/');
    expect(screen.getByRole('heading', { level: 1, name: 'RedStarVibe' })).toBeInTheDocument();

    const nav = screen.getByRole('navigation', { name: 'Main' });
    await user.click(within(nav).getByRole('link', { name: 'Students' }));

    expect(location()).toBe('/students');
    expect(screen.getByRole('heading', { level: 1, name: 'Students' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Students' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Products' })).not.toHaveAttribute('aria-current');
  });

  it('React 19 <title> sets the document title per page', async () => {
    fakeCatalog();
    renderApp('/contacts');
    await waitFor(() => expect(document.title).toBe('Contacts · RedStarVibe'));
  });

  it('an unknown URL hits the catch-all 404, inside the normal layout', () => {
    renderApp('/no/such/page');
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByText('/no/such/page')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument(); // the header still shows
  });
});

describe('Product Filter (Project 3): the URL is the state', () => {
  it('a deep link with filters renders those exact results', async () => {
    const fetchMock = fakeCatalog();
    renderApp('/products?category=pizza&sort=priceDesc');

    expect(await productNames()).toEqual(['Paneer Tikka Pizza', 'Margherita']);
    expect(screen.getByRole('heading', { level: 1, name: 'Pizza' })).toBeInTheDocument();
    expect(screen.getByLabelText('Sort')).toHaveValue('priceDesc');
    const urls = await Promise.all(fetchMock.mock.calls.map((_, i) => callDetails(fetchMock, i).then((c) => c.url)));
    expect(urls).toContain('http://localhost:5240/api/products?page=1&pageSize=9&category=pizza&sort=priceDesc'); // Phase 11: paged
  });

  it('clicking a category updates the URL and keeps the other filters', async () => {
    const user = userEvent.setup();
    fakeCatalog();
    renderApp('/products?sort=priceDesc');
    await productNames();

    const cats = screen.getByRole('navigation', { name: 'Categories' });
    await user.click(await within(cats).findByRole('link', { name: 'Burgers' }));

    expect(location()).toBe('/products?sort=priceDesc&category=burgers');
    expect(await productNames()).toEqual(['Classic Burger']);
    expect(within(cats).getByRole('link', { name: 'Burgers' })).toHaveAttribute('aria-current', 'page');
  });

  it('search is debounced into ?q=, without a history entry per pause', async () => {
    fakeCatalog();
    renderApp('/products');
    await productNames();

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'paneer' } });
    expect(location()).toBe('/products'); // not yet: it waits for the pause
    await waitFor(() => expect(location()).toBe('/products?q=paneer'));
    expect(await productNames()).toEqual(['Paneer Tikka Pizza']);
  });

  it('"Clear filters" resets the URL, and the search box follows', async () => {
    const user = userEvent.setup();
    fakeCatalog();
    renderApp('/products?category=pizza&q=pan');
    await productNames();
    expect(screen.getByLabelText('Search')).toHaveValue('pan');

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(location()).toBe('/products');
    expect(screen.getByLabelText('Search')).toHaveValue('');
    expect(await productNames()).toHaveLength(3);
  });

  it('an unknown category says so', async () => {
    fakeCatalog();
    renderApp('/products?category=sushi');
    expect(await screen.findByText('There is no category called "sushi".')).toBeInTheDocument();
  });
});

describe('Product detail (useParams + nested layout)', () => {
  it('opens a product, and "Back to results" returns to the SAME filtered list', async () => {
    const user = userEvent.setup();
    fakeCatalog();
    renderApp('/products?category=pizza');
    await productNames();

    await user.click(screen.getByRole('link', { name: /Margherita/ }));
    expect(location()).toBe('/products/4');
    expect(await screen.findByRole('heading', { level: 1, name: 'Margherita' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Categories' })).toBeInTheDocument(); // the nested layout stays

    await user.click(screen.getByRole('link', { name: '← Back to results' }));
    expect(location()).toBe('/products?category=pizza');
  });

  it('a pasted detail link (no history) falls back to the full list', async () => {
    fakeCatalog();
    renderApp('/products/4');
    await screen.findByRole('heading', { level: 1, name: 'Margherita' });
    expect(screen.getByRole('link', { name: '← Back to results' })).toHaveAttribute('href', '/products');
  });

  it.each([
    ['/products/999', 'There is no product with id "999".'], // the API says 404
    ['/products/abc', 'There is no product with id "abc".'], // invalid: no request at all
  ])('%s shows "Product not found"', async (url, message) => {
    const fetchMock = fakeCatalog();
    renderApp(url);
    expect(await screen.findByRole('heading', { level: 1, name: 'Product not found' })).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
    if (url.endsWith('abc')) {
      const urls = await Promise.all(fetchMock.mock.calls.map((_, i) => callDetails(fetchMock, i).then((c) => c.url)));
      expect(urls.some((u) => u.includes('/products/abc'))).toBe(false);
    }
  });
});

describe('Phase 11: paged products', () => {
  it('Next goes to ?page=2, and changing the category goes back to page 1', async () => {
    const user = userEvent.setup();
    const page = (n) => ({ items: [all[n - 1]], page: n, pageSize: 1, totalCount: 3, totalPages: 3, hasNext: n < 3, hasPrevious: n > 1 });
    mockFetch((url) => {
      const u = new URL(url);
      if (u.pathname === '/api/categories') return ok(categories);
      return ok(page(Number(u.searchParams.get('page') ?? 1)));
    });
    renderApp('/products?sort=priceDesc');

    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next →' }));
    expect(location()).toBe('/products?sort=priceDesc&page=2');
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();

    await user.click(within(screen.getByRole('navigation', { name: 'Categories' })).getByRole('link', { name: 'Pizza' }));
    expect(location()).toBe('/products?sort=priceDesc&category=pizza'); // page removed
  });

  it('shows the product image from the API origin', async () => {
    mockFetch((url) => {
      const u = new URL(url);
      if (u.pathname === '/api/categories') return ok(categories);
      return ok({ items: [{ ...all[0], imageUrl: '/images/products/abc.png' }], page: 1, pageSize: 9, totalCount: 1, totalPages: 1, hasNext: false, hasPrevious: false });
    });
    const { container } = renderApp('/products');
    await screen.findByText('1 product');
    expect(container.querySelector('img').getAttribute('src')).toBe('http://localhost:5240/images/products/abc.png');
  });
});
