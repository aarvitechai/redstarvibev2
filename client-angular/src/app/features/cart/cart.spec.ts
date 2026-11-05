import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session } from '../../core/auth/session';
import { CartPage } from './cart-page';
import { CartStore } from './cart-store';
import { CartState, cartReducer, initialCartState, selectCount, selectSubtotal } from './cart.state';

const burger = { id: 1, name: 'Classic Burger', price: 8.5 };
const tea = { id: 7, name: 'Lemon Iced Tea', price: 2.5 };
const API = 'http://localhost:5240/api/cart/price';

const deepFreeze = <T extends object>(o: T): T => {
  Object.values(o).forEach((v) => v && typeof v === 'object' && deepFreeze(v));
  return Object.freeze(o);
};

describe('cartReducer (pure)', () => {
  const run = (...actions: Parameters<typeof cartReducer>[1][]) => actions.reduce(cartReducer, initialCartState);

  it('adds, merges duplicates, and never mutates the previous state', () => {
    const one = deepFreeze(run({ type: 'added', product: burger }));
    const two = cartReducer(one, { type: 'added', product: burger }); // a mutation would throw on the frozen state
    expect(two.items).toEqual([{ productId: 1, name: 'Classic Burger', price: 8.5, quantity: 2 }]);
    expect(one.items[0].quantity).toBe(1);
  });

  it('clamps quantity to 1..20 and removes the line at 0', () => {
    let s = run({ type: 'added', product: burger }, { type: 'quantityChanged', productId: 1, quantity: 99 });
    expect(s.items[0].quantity).toBe(20);
    s = cartReducer(s, { type: 'quantityChanged', productId: 1, quantity: 0 });
    expect(s.items).toEqual([]);
  });

  it('priced: the server price wins and unavailable items are dropped', () => {
    const s = cartReducer(run({ type: 'added', product: burger }, { type: 'added', product: tea }), {
      type: 'priced',
      quote: { lines: [{ productId: 1, name: 'Classic Burger', unitPrice: 9, quantity: 1, lineTotal: 9 }], subtotal: 9, itemCount: 1, unavailableProductIds: [7] },
    });
    expect(s.items).toEqual([{ productId: 1, name: 'Classic Burger', price: 9, quantity: 1 }]);
    expect(s.quote?.subtotal).toBe(9);
  });

  it('selectors: count, and a subtotal without floating-point drift', () => {
    const s: CartState = { items: [{ productId: 9, name: 'x', price: 0.1, quantity: 3 }], quote: null };
    expect(selectCount(s)).toBe(3);
    expect(selectSubtotal(s)).toBe(0.3);
  });
});

describe('CartStore (signal + reducer)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('dispatch updates the computed selectors', () => {
    const cart = TestBed.inject(CartStore);
    cart.dispatch({ type: 'added', product: burger });
    cart.dispatch({ type: 'added', product: tea });
    expect(cart.count()).toBe(2);
    expect(cart.subtotal()).toBe(11);
  });

  it('persists to localStorage, and a new store restores it ("survives reload")', () => {
    TestBed.inject(CartStore).dispatch({ type: 'added', product: burger });
    TestBed.tick(); // run the persistence effect

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    expect(TestBed.inject(CartStore).items()).toEqual([{ productId: 1, name: 'Classic Burger', price: 8.5, quantity: 1 }]);
  });

  it('corrupted storage gives an empty cart', () => {
    localStorage.setItem('redstar.cart', '{oops');
    expect(TestBed.inject(CartStore).items()).toEqual([]);
  });

  it('RESETS ON LOGOUT', () => {
    const session = TestBed.inject(Session);
    session.start({ accessToken: 'demo.2.9999999999', expiresAt: new Date(Date.now() + 60_000).toISOString(), user: { id: 'c2', name: 'A', email: 'a@x.com', roles: ['Customer'] } });
    const cart = TestBed.inject(CartStore);
    cart.dispatch({ type: 'added', product: burger });

    session.logout();
    expect(cart.items()).toEqual([]);
  });

  it('priceWithServer sends ONLY ids and quantities', () => {
    const cart = TestBed.inject(CartStore);
    cart.dispatch({ type: 'added', product: burger });
    cart.dispatch({ type: 'added', product: burger });
    cart.priceWithServer();
    expect(cart.quoteStatus()).toBe('pending');

    const req = http.expectOne(API);
    expect(req.request.body).toEqual({ items: [{ productId: 1, quantity: 2 }] });
    req.flush({ success: true, data: { lines: [], subtotal: 17, itemCount: 2, unavailableProductIds: [] }, errors: [] });

    expect(cart.quote()?.subtotal).toBe(17);
    expect(cart.quoteStatus()).toBe('idle');
  });

  it('CartPage: change quantity, see the subtotal, check with the server, and a change drops the stale quote', async () => {
    const cart = TestBed.inject(CartStore);
    cart.dispatch({ type: 'added', product: burger });
    cart.dispatch({ type: 'added', product: tea });
    const fixture = TestBed.createComponent(CartPage);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    const btn = (label: string) => el.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
    const byText = (t: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.includes(t)) as HTMLButtonElement;

    btn('One more Classic Burger').click();
    await fixture.whenStable();
    expect(el.querySelector('[data-testid="client-subtotal"]')?.textContent).toContain('19.50');

    byText('Check prices with the server').click();
    http.expectOne(API).flush({ success: true, data: { lines: [], subtotal: 19.5, itemCount: 3, unavailableProductIds: [] }, errors: [] });
    await fixture.whenStable();
    expect(el.querySelector('[data-testid="server-subtotal"]')?.textContent).toContain('19.50');

    btn('One less Classic Burger').click();
    await fixture.whenStable();
    expect(el.querySelector('[data-testid="server-subtotal"]')).toBeNull();
  });
});
