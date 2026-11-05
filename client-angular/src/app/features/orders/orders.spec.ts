import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { App } from '../../app';
import { routes } from '../../app.routes';
import { SessionData } from '../../core/auth/session';
import { appInterceptors } from '../../core/http/interceptors';
import { CartStore } from '../cart/cart-store';
import { Order } from './orders-api';

const API = 'http://localhost:5240/api';
const customer: SessionData = {
  accessToken: 'customer-token', refreshToken: null, expiresAt: new Date(Date.now() + 1_800_000).toISOString(),
  user: { id: 'c0000000-0000-0000-0000-000000000002', name: 'Asha Verma', email: 'asha@redstar.dev', roles: ['Customer'] },
};
const admin: SessionData = { ...customer, accessToken: 'admin-token', user: { ...customer.user, id: 'a1', name: 'Admin User', roles: ['Admin'] } };
const PRICES: Record<number, [string, number]> = { 1: ['Classic Burger', 8.5], 7: ['Lemon Iced Tea', 2.5] };

let fixture: ComponentFixture<App>;
let el: HTMLElement;
let router: Router;
let http: HttpTestingController;
let orders: Order[];
let startStatus: Order['status'];
let unavailable: number[];
let posted: unknown[];

// A STATEFUL fake of /api/orders, answered through HttpTestingController
function answerApi() {
  for (const req of http.match(() => true)) {
    if (req.cancelled) continue;
    const { method, url, body } = req.request;
    if (url === `${API}/orders` && method === 'POST') {
      posted.push(body);
      const items = (body as { items: { productId: number; quantity: number }[] }).items;
      const missing = items.filter((i) => unavailable.includes(i.productId));
      if (missing.length) {
        req.flush({ success: false, data: null, errors: ['x'], fieldErrors: { items: [`Some products are no longer available: ${missing.map((m) => m.productId).join(', ')}.`] } }, { status: 400, statusText: 'Bad Request' });
        continue;
      }
      const lines = items.map((i, n) => ({ id: n + 1, productId: i.productId, productName: PRICES[i.productId][0], unitPrice: PRICES[i.productId][1], quantity: i.quantity, lineTotal: PRICES[i.productId][1] * i.quantity, rating: null }));
      const order: Order = { id: 100 + orders.length, status: startStatus, total: lines.reduce((s, l) => s + l.lineTotal, 0), createdAt: new Date().toISOString(), lines, rowVersion: 'AA==', canRate: startStatus === 'Completed' };
      orders = [order, ...orders];
      req.flush({ success: true, data: order, errors: [] }, { status: 201, statusText: 'Created' });
    } else if (url === `${API}/orders/mine`) {
      req.flush({ success: true, data: { items: orders, page: 1, pageSize: 5, totalCount: orders.length, totalPages: orders.length ? 1 : 0, hasNext: false, hasPrevious: false }, errors: [] });
    } else if (method === 'PUT' && url.includes('/rating')) {
      const [, orderId, lineId] = url.match(/orders\/(\d+)\/details\/(\d+)\/rating/)!.map(Number);
      const rating = (body as { rating: number }).rating;
      orders = orders.map((o) => (o.id === orderId ? { ...o, lines: o.lines.map((l) => (l.id === lineId ? { ...l, rating } : l)) } : o));
      req.flush({ success: true, data: orders.find((o) => o.id === orderId), errors: [] });
    } else {
      req.flush({ success: true, data: [], errors: [] });
    }
  }
}

async function settle() {
  for (let i = 0; i < 6; i++) {
    fixture.detectChanges();
    TestBed.tick();
    answerApi();
    await new Promise((r) => setTimeout(r, 0));
  }
  fixture.detectChanges();
}

async function start(url: string, session: SessionData | null, cart: { id: number; name: string; price: number }[] = []) {
  localStorage.clear();
  if (session) localStorage.setItem('redstar.session', JSON.stringify(session));
  orders = [];
  startStatus = 'Pending';
  unavailable = [];
  posted = [];
  TestBed.configureTestingModule({
    providers: [provideRouter(routes, withComponentInputBinding()), provideHttpClient(withInterceptors(appInterceptors)), provideHttpClientTesting()],
  });
  http = TestBed.inject(HttpTestingController);
  router = TestBed.inject(Router);
  for (const p of cart) TestBed.inject(CartStore).dispatch({ type: 'added', product: p });
  fixture = TestBed.createComponent(App);
  el = fixture.nativeElement;
  await router.navigateByUrl(url);
  await settle();
}

const button = (text: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.trim() === text) as HTMLButtonElement | undefined;
const main = () => el.querySelector('main')!.textContent!.replace(/\s+/g, ' ');

afterEach(() => localStorage.clear());

describe('checkout (Angular)', () => {
  it('sends ONLY ids and quantities, empties the cart, and shows the order in "My orders"', async () => {
    await start('/cart', customer, [{ id: 1, name: 'Classic Burger', price: 0.01 }, { id: 1, name: 'Classic Burger', price: 0.01 }, { id: 7, name: 'Lemon Iced Tea', price: 2.5 }]);

    button('Place order')!.click();
    await settle();
    await vi.waitFor(() => expect(router.url).toBe('/orders?placed=100'));
    await settle();

    expect(posted).toEqual([{ items: [{ productId: 1, quantity: 2 }, { productId: 7, quantity: 1 }] }]); // no prices
    expect(TestBed.inject(CartStore).items()).toEqual([]);
    expect(main()).toContain('Thank you! Order #100 has been placed.');
    expect(main()).toContain('₹19.50'); // the SERVER's price, not the tampered 0.01
    expect(main()).toContain('You can rate the items once the order is completed.');
  });

  it('anonymous: asked to log in, no Place order button', async () => {
    await start('/cart', null, [{ id: 1, name: 'Classic Burger', price: 8.5 }]);
    expect(button('Place order')).toBeUndefined();
    expect(main()).toContain('Log in to place your order.');
  });

  it('admin: cannot check out', async () => {
    await start('/cart', admin, [{ id: 1, name: 'Classic Burger', price: 8.5 }]);
    expect(main()).toContain("Admin accounts can't place orders");
  });

  it('an unavailable product: the server message is shown and the cart is kept', async () => {
    await start('/cart', customer, [{ id: 7, name: 'Lemon Iced Tea', price: 2.5 }]);
    unavailable = [7];
    button('Place order')!.click();
    await settle();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Some products are no longer available: 7.');
    expect(router.url).toBe('/cart');
    expect(TestBed.inject(CartStore).items()).toHaveLength(1);
  });
});

describe('My orders (Angular)', () => {
  it('is for customers only: admins are sent to /unauthorized', async () => {
    await start('/orders', admin);
    expect(router.url).toBe('/unauthorized?from=%2Forders');
  });

  it('a COMPLETED order can be rated, and the list refetches with the saved rating', async () => {
    await start('/cart', customer, [{ id: 1, name: 'Classic Burger', price: 8.5 }]);
    startStatus = 'Completed';
    button('Place order')!.click();
    await settle();
    await vi.waitFor(() => expect(router.url).toContain('/orders'));
    await settle();

    const four = el.querySelector('fieldset input[type="radio"][value="4"]') as HTMLInputElement;
    four.click();
    four.dispatchEvent(new Event('change'));
    await settle();

    expect(orders[0].lines[0].rating).toBe(4); // saved by the "server"
    expect((el.querySelector('fieldset input[type="radio"][value="4"]') as HTMLInputElement).checked).toBe(true); // shown after the refetch
    expect(main()).toContain('Your rating');
  });

  it('customers see a "My orders" link; admins do not', async () => {
    await start('/', customer);
    expect(el.querySelector('nav[aria-label="Main"]')!.textContent).toContain('My orders');
    TestBed.resetTestingModule();
    await start('/', admin);
    expect(el.querySelector('nav[aria-label="Main"]')!.textContent).not.toContain('My orders');
  });
});
