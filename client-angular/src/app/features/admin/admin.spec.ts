import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { App } from '../../app';
import { routes } from '../../app.routes';
import { SessionData } from '../../core/auth/session';
import { appInterceptors } from '../../core/http/interceptors';
import { THEME_KEY, ThemeService } from '../../core/theme/theme.service';
import { AdminOrder, AdminProduct } from './admin-api';

const API = 'http://localhost:5240/api';
const admin: SessionData = {
  accessToken: 'admin-token', refreshToken: null, expiresAt: new Date(Date.now() + 1_800_000).toISOString(),
  user: { id: 'a1', name: 'Admin User', email: 'admin@redstar.dev', roles: ['Admin'] },
};
const categories = [{ id: 1, name: 'Burgers', slug: 'burgers' }, { id: 2, name: 'Pizza', slug: 'pizza' }];
const NEXT: Record<string, string[]> = { Pending: ['Confirmed', 'Cancelled'], Confirmed: ['Ready', 'Cancelled'], Ready: ['Completed', 'Cancelled'], Completed: [], Cancelled: [] };

let fixture: ComponentFixture<App>;
let el: HTMLElement;
let router: Router;
let http: HttpTestingController;
let products: AdminProduct[];
let orders: AdminOrder[];
let conflictOnUpdate: boolean;
let log: { method: string; url: string; body: unknown }[];

const page = <T>(items: T[]) => ({ success: true, errors: [], data: { items, page: 1, pageSize: 10, totalCount: items.length, totalPages: 1, hasNext: false, hasPrevious: false } });
const ok = <T>(data: T) => ({ success: true, data, errors: [] });

// A STATEFUL fake of the admin endpoints, answered through HttpTestingController
function answerApi() {
  for (const req of http.match(() => true)) {
    if (req.cancelled) continue;
    const { method, url, body } = req.request;
    log.push({ method, url, body });
    const one = url.match(/\/admin\/products\/(\d+)$/);
    const image = url.match(/\/admin\/products\/(\d+)\/image$/);
    const status = url.match(/\/orders\/(\d+)\/status$/);
    if (url === `${API}/categories`) req.flush(ok(categories));
    else if (url === `${API}/admin/summary`) req.flush(ok({ students: 4, contacts: 3, products: products.length, categories: 2 }));
    else if (url === `${API}/admin/products` && method === 'GET') req.flush(page([...products].sort((a, b) => a.name.localeCompare(b.name))));
    else if (url === `${API}/admin/products` && method === 'POST') {
      const input = body as AdminProduct;
      const p: AdminProduct = { ...input, id: 20, categoryName: categories.find((c) => c.id === input.categoryId)!.name, imageUrl: null, rowVersion: 'v1' };
      products = [...products, p];
      req.flush(ok(p), { status: 201, statusText: 'Created' });
    } else if (image) {
      const id = Number(image[1]);
      products = products.map((p) => (p.id === id ? { ...p, imageUrl: `/images/products/${id}.png`, rowVersion: 'v2' } : p));
      req.flush(ok(products.find((p) => p.id === id)));
    } else if (one && method === 'PUT') {
      if (conflictOnUpdate) {
        req.flush({ success: false, data: null, errors: ['Someone else changed this product while you were editing.'] }, { status: 409, statusText: 'Conflict' });
        continue;
      }
      const id = Number(one[1]);
      products = products.map((p) => (p.id === id ? { ...p, ...(body as object), rowVersion: 'v2' } : p));
      req.flush(ok(products.find((p) => p.id === id)));
    } else if (one && method === 'DELETE') {
      products = products.map((p) => (p.id === Number(one[1]) ? { ...p, isActive: false } : p));
      req.flush(null, { status: 204, statusText: 'No Content' });
    } else if (url === `${API}/orders` && method === 'GET') {
      const s = req.request.params.get('status');
      req.flush(page(orders.filter((o) => !s || o.status === s)));
    } else if (status) {
      const { status: next, rowVersion } = body as { status: string; rowVersion: string };
      const order = orders.find((o) => o.id === Number(status[1]))!;
      if (rowVersion !== order.rowVersion) {
        req.flush({ success: false, data: null, errors: ['Someone else changed this order.'] }, { status: 409, statusText: 'Conflict' });
        continue;
      }
      const updated = { ...order, status: next, rowVersion: `${order.rowVersion}x`, allowedNextStatuses: NEXT[next] } as AdminOrder;
      orders = orders.map((o) => (o.id === updated.id ? updated : o));
      req.flush(ok(updated));
    } else req.flush(ok([]));
  }
}

async function settle() {
  for (let i = 0; i < 8; i++) {
    fixture.detectChanges();
    TestBed.tick();
    answerApi();
    await new Promise((r) => setTimeout(r, 0));
  }
  fixture.detectChanges();
}

async function start(url: string, session: SessionData = admin) {
  localStorage.clear();
  localStorage.setItem('redstar.session', JSON.stringify(session));
  products = [
    { id: 1, name: 'Classic Burger', description: 'Beef', price: 8.5, categoryId: 1, categoryName: 'Burgers', imageUrl: null, isActive: true, rowVersion: 'v1' },
    { id: 4, name: 'Margherita', description: 'Basil', price: 9, categoryId: 2, categoryName: 'Pizza', imageUrl: null, isActive: true, rowVersion: 'v1' },
  ];
  orders = [{ id: 7, customerName: 'Asha Verma', customerEmail: 'asha@redstar.dev', status: 'Pending', total: 19.5, itemCount: 3, createdAt: '2026-11-01T10:00:00Z', rowVersion: 'o1', allowedNextStatuses: ['Confirmed', 'Cancelled'] }];
  conflictOnUpdate = false;
  log = [];
  TestBed.configureTestingModule({
    providers: [provideRouter(routes, withComponentInputBinding()), provideHttpClient(withInterceptors(appInterceptors)), provideHttpClientTesting()],
  });
  http = TestBed.inject(HttpTestingController);
  router = TestBed.inject(Router);
  fixture = TestBed.createComponent(App);
  el = fixture.nativeElement;
  document.body.appendChild(el); // attached, so focus() really works
  await router.navigateByUrl(url);
  await settle();
}

const button = (root: ParentNode, text: string) => Array.from(root.querySelectorAll('button')).find((b) => b.textContent!.trim() === text) as HTMLButtonElement | undefined;
const row = (name: string) => el.querySelector(`tr[aria-label="${name}"]`) as HTMLElement | null;
const dialog = () => el.querySelector('[role="dialog"]') as HTMLElement | null;
const toasts = () => Array.from(el.querySelectorAll('app-toasts [role="status"], app-toasts [role="alert"]')).map((t) => t.textContent!.trim());
function type(root: ParentNode, id: string, value: string) {
  const input = root.querySelector(`#${id}`) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

afterEach(() => {
  el?.remove();
  localStorage.clear();
});

describe('Angular admin area', () => {
  it('the overview loads lazily with the admin sub-navigation', async () => {
    await start('/admin');
    const nav = el.querySelector('nav[aria-label="Admin"]')!;
    expect(nav.querySelector('a[aria-current="page"]')?.textContent).toBe('Overview');
    expect(el.querySelector('main')!.textContent).toContain('Products');
  });

  it('customers are sent to /unauthorized', async () => {
    await start('/admin/products', { ...admin, user: { ...admin.user, roles: ['Customer'] } });
    expect(router.url).toBe('/unauthorized?from=%2Fadmin%2Fproducts');
  });
});

describe('Angular admin products', () => {
  it('creates a product WITH an image: JSON POST, then a FormData upload; the table refreshes and a toast confirms', async () => {
    await start('/admin/products');
    button(el, 'New product')!.click();
    await settle();

    expect(document.activeElement?.id).toBe('p-name'); // focus moved into the modal, to the first field
    const form = dialog()!;
    type(form, 'p-name', 'Masala Dosa');
    type(form, 'p-price', '6.75');
    const select = form.querySelector('#p-cat') as HTMLSelectElement;
    select.value = select.options[2].value; // Pizza
    select.dispatchEvent(new Event('change'));
    const fileInput = form.querySelector('#p-image') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', { value: [new File([new Uint8Array([0x89, 0x50])], 'dosa.png', { type: 'image/png' })] });
    fileInput.dispatchEvent(new Event('change'));
    form.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();

    const post = log.find((l) => l.method === 'POST' && l.url.endsWith('/admin/products'))!;
    expect(post.body).toEqual({ name: 'Masala Dosa', description: '', price: 6.75, categoryId: 2, isActive: true });
    expect(log.find((l) => l.url.endsWith('/admin/products/20/image'))!.body).toBeInstanceOf(FormData);
    expect(dialog()).toBeNull();
    expect(toasts()).toContain('Created "Masala Dosa".✕');
    expect(row('Masala Dosa')?.querySelector('img')?.getAttribute('src')).toBe('http://localhost:5240/images/products/20.png');
  });

  it('client checks first: no request for an empty form or a wrong file type', async () => {
    await start('/admin/products');
    button(el, 'New product')!.click();
    await settle();
    const form = dialog()!;
    const fileInput = form.querySelector('#p-image') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', { value: [new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' })] });
    fileInput.dispatchEvent(new Event('change'));
    await settle();
    expect(form.textContent).toContain('Choose a JPEG, PNG or WebP image.');
    expect(button(form, 'Create product')!.disabled).toBe(true);
    expect(log.some((l) => l.method === 'POST')).toBe(false);
  });

  it('edit keeps the real category and sends the rowVersion it loaded', async () => {
    await start('/admin/products');
    button(row('Margherita')!, 'Edit')!.click();
    await settle();
    const form = dialog()!;
    expect((form.querySelector('#p-cat') as HTMLSelectElement).selectedOptions[0].textContent).toBe('Pizza');
    type(form, 'p-price', '9.5');
    form.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();

    expect(log.find((l) => l.method === 'PUT')!.body).toMatchObject({ price: 9.5, categoryId: 2, rowVersion: 'v1' });
    expect(toasts()).toContain('Saved "Margherita".✕');
    expect(row('Margherita')!.textContent).toContain('₹9.50');
  });

  it('a 409 shows an error toast and closes the form', async () => {
    await start('/admin/products');
    conflictOnUpdate = true;
    button(row('Margherita')!, 'Edit')!.click();
    await settle();
    dialog()!.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();

    expect(dialog()).toBeNull();
    expect(toasts().join(' ')).toContain('Someone else changed this product');
  });

  it('delete asks first, then the row shows Inactive', async () => {
    await start('/admin/products');
    button(row('Classic Burger')!, 'Delete')!.click();
    await settle();
    button(dialog()!, 'Delete')!.click();
    await settle();

    expect(toasts()).toContain('"Classic Burger" is no longer for sale.✕');
    expect(row('Classic Burger')!.textContent).toContain('Inactive');
  });

  it('Escape closes the modal', async () => {
    await start('/admin/products');
    button(el, 'New product')!.click();
    await settle();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await settle();
    expect(dialog()).toBeNull();
  });
});

describe('Angular admin orders', () => {
  it('only offers the next statuses the server allows, updates with the rowVersion, and refreshes', async () => {
    await start('/admin/orders');
    const r = row('Order 7')!;
    expect(Array.from(r.querySelectorAll('option')).map((o) => o.textContent)).toEqual(['Confirmed', 'Cancelled']);

    button(r, 'Update')!.click();
    await settle();

    expect(log.find((l) => l.method === 'PUT')!.body).toEqual({ status: 'Confirmed', rowVersion: 'o1' });
    expect(toasts()).toContain('Order #7 is now Confirmed.✕');
    expect(Array.from(row('Order 7')!.querySelectorAll('option')).map((o) => o.textContent)).toEqual(['Ready', 'Cancelled']);
  });

  it('a 409 from another admin: error toast, and the list is refetched', async () => {
    await start('/admin/orders');
    orders = orders.map((o) => ({ ...o, rowVersion: 'changed-elsewhere' }));
    button(row('Order 7')!, 'Update')!.click();
    await settle();

    expect(toasts().join(' ')).toContain('Someone else changed this order. The list has been refreshed.');
    expect(log.filter((l) => l.method === 'GET' && l.url === `${API}/orders`).length).toBeGreaterThanOrEqual(2);
  });
});

describe('theme persistence (plan 14.8)', () => {
  it('the choice is saved and read back on the next start', async () => {
    await start('/');
    TestBed.inject(ThemeService).toggle();
    TestBed.tick();
    const saved = localStorage.getItem(THEME_KEY);
    expect(saved === 'dark' || saved === 'light').toBe(true);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    localStorage.setItem(THEME_KEY, 'dark');
    expect(TestBed.inject(ThemeService).theme()).toBe('dark');
  });
});
