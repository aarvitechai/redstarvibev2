import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

const API = 'http://localhost:5240/api';
const categories = [
  { id: 1, name: 'Burgers', slug: 'burgers' },
  { id: 2, name: 'Pizza', slug: 'pizza' },
];
const all = [
  { id: 1, name: 'Classic Burger', description: 'Beef', price: 8.5, categoryId: 1, categoryName: 'Burgers', categorySlug: 'burgers' },
  { id: 4, name: 'Margherita', description: 'Basil', price: 9, categoryId: 2, categoryName: 'Pizza', categorySlug: 'pizza' },
  { id: 6, name: 'Paneer Tikka Pizza', description: 'Paneer', price: 11, categoryId: 2, categoryName: 'Pizza', categorySlug: 'pizza' },
];
const ok = <T>(data: T) => ({ success: true, data, errors: [] });

let fixture: ComponentFixture<App>;
let el: HTMLElement;
let router: Router;
let http: HttpTestingController;

// Answer every pending API request the way the real catalogue would
function answerApi() {
  for (const req of http.match(() => true)) {
    if (req.cancelled) continue;
    const url = req.request.url;
    if (url === `${API}/categories`) req.flush(ok(categories));
    else if (url === `${API}/products`) {
      const cat = req.request.params.get('category');
      const q = req.request.params.get('search')?.toLowerCase();
      let list = all.filter((p) => (!cat || p.categorySlug === cat) && (!q || p.name.toLowerCase().includes(q)));
      if (req.request.params.get('sort') === 'priceDesc') list = [...list].sort((a, b) => b.price - a.price);
      req.flush(ok({ items: list, page: 1, pageSize: 9, totalCount: list.length, totalPages: 1, hasNext: false, hasPrevious: false })); // Phase 11: paged
    } else {
      const p = all.find((x) => url === `${API}/products/${x.id}`);
      if (p) req.flush(ok(p));
      else req.flush({ success: false, data: null, errors: ['Not found'] }, { status: 404, statusText: 'Not Found' });
    }
  }
}

// NOT fixture.whenStable(): it waits for pending HTTP requests, and here WE decide when those finish
async function settle() {
  for (let i = 0; i < 4; i++) {
    fixture.detectChanges();
    answerApi();
    await new Promise((r) => setTimeout(r, 0));
  }
  fixture.detectChanges();
}
async function go(url: string) {
  await router.navigateByUrl(url);
  await settle();
}
const productNames = () => Array.from(el.querySelectorAll('ul[aria-label="Products"] strong')).map((s) => s.textContent);
const h1 = () => el.querySelector('main h1')?.textContent?.trim();
const link = (root: ParentNode, text: string) =>
  Array.from(root.querySelectorAll('a')).find((a) => a.textContent!.trim() === text) as HTMLAnchorElement;

beforeEach(async () => {
  TestBed.configureTestingModule({
    providers: [provideRouter(routes, withComponentInputBinding()), provideHttpClient(), provideHttpClientTesting()],
  });
  http = TestBed.inject(HttpTestingController);
  router = TestBed.inject(Router);
  fixture = TestBed.createComponent(App);
  el = fixture.nativeElement;
  await go('/');
});

describe('App routing', () => {
  it('renders the shell with the home page at /', () => {
    expect(el.querySelector('header')?.textContent).toContain('RedStarVibe');
    expect(h1()).toBe('RedStarVibe');
    expect(TestBed.inject(Title).getTitle()).toBe('Home · RedStarVibe');
  });

  it('routerLink navigates without a reload, and routerLinkActive marks the current page', async () => {
    const nav = el.querySelector('nav[aria-label="Main"]')!;
    link(nav, 'Students').click();
    await settle();
    await vi.waitFor(() => expect(router.url).toBe('/students'));
    await settle();

    expect(h1()).toBe('Students');
    expect(link(nav, 'Students').getAttribute('aria-current')).toBe('page');
    expect(link(nav, 'Students').classList).toContain('active');
    expect(link(nav, 'Products').getAttribute('aria-current')).toBeNull();
    expect(TestBed.inject(Title).getTitle()).toBe('Students · RedStarVibe'); // the route's `title`
  });

  it('an unknown URL hits the lazy-loaded ** route', async () => {
    await go('/no/such/page');
    expect(h1()).toBe('Page not found');
    expect(el.querySelector('main code')?.textContent).toBe('/no/such/page');
  });
});

describe('Product Filter (query params as inputs)', () => {
  it('a deep link with filters renders exactly those results', async () => {
    await go('/products?category=pizza&sort=priceDesc');
    expect(productNames()).toEqual(['Paneer Tikka Pizza', 'Margherita']);
    expect(h1()).toBe('Pizza');
    expect((el.querySelector('select') as HTMLSelectElement).value).toBe('priceDesc');
    expect(TestBed.inject(Title).getTitle()).toBe('Pizza · RedStarVibe');
  });

  it('a category link changes only the category (queryParamsHandling: merge)', async () => {
    await go('/products?sort=priceDesc');
    link(el.querySelector('nav[aria-label="Categories"]')!, 'Burgers').click();
    await vi.waitFor(() => expect(router.url).toBe('/products?sort=priceDesc&category=burgers'));
    await settle();

    expect(productNames()).toEqual(['Classic Burger']);
    expect(link(el.querySelector('nav[aria-label="Categories"]')!, 'Burgers').getAttribute('aria-current')).toBe('page');
  });

  it('search is debounced into ?q=, and Clear filters resets the URL and the box (linkedSignal)', async () => {
    await go('/products');
    const box = el.querySelector('input[type="search"]') as HTMLInputElement;
    box.value = 'paneer';
    box.dispatchEvent(new Event('input'));
    expect(router.url).toBe('/products'); // not yet

    await vi.waitFor(() => expect(router.url).toBe('/products?q=paneer'), { timeout: 2000 });
    await settle();
    expect(productNames()).toEqual(['Paneer Tikka Pizza']);

    (Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.includes('Clear filters')) as HTMLButtonElement).click();
    await vi.waitFor(() => expect(router.url).toBe('/products'));
    await settle();
    expect((el.querySelector('input[type="search"]') as HTMLInputElement).value).toBe('');
    expect(productNames()).toHaveLength(3);
  });

  it('an unknown category says so', async () => {
    await go('/products?category=sushi');
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('There is no category called "sushi".');
  });
});

describe('Product detail (:id as an input)', () => {
  it('opens a product, keeps the nested layout, and Back returns to the same filtered list', async () => {
    await go('/products?category=pizza');
    // A card holds several texts, so find it by its href
    (el.querySelector('a[href="/products/4"]') as HTMLAnchorElement).click();
    await vi.waitFor(() => expect(router.url).toBe('/products/4'));
    await settle();

    expect(h1()).toBe('Margherita');
    expect(el.querySelector('nav[aria-label="Categories"]')).not.toBeNull(); // nested layout still there
    expect(TestBed.inject(Title).getTitle()).toBe('Margherita · RedStarVibe');
    expect(link(el, '← Back to results').getAttribute('href')).toBe('/products?category=pizza');
  });

  it('a pasted detail link (no navigation state) falls back to the full list', async () => {
    await go('/products/4');
    expect(link(el, '← Back to results').getAttribute('href')).toBe('/products');
  });

  it.each([
    ['/products/999', 'There is no product with id "999".'],
    ['/products/abc', 'There is no product with id "abc".'],
  ])('%s shows "Product not found"', async (url, message) => {
    await go(url);
    expect(h1()).toBe('Product not found');
    expect(el.textContent).toContain(message);
  });
});
