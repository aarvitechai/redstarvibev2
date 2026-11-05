import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReduxCounter from '../learning/phase-09/ReduxCounter';
import { loadCart, makeStore, persistCart } from '../store';
import { loggedOut, loginUser } from '../store/authSlice';
import cartReducer, {
  cartCleared,
  itemAdded,
  priceCart,
  quantityChanged,
  selectCartCount,
  selectCartSubtotal,
} from '../store/cartSlice';
import counterReducer, { amountAdded, incremented, reset } from '../store/counterSlice';
import { CUSTOMER, loginAs } from './authHelpers';
import { callDetails, fail, mockFetch, ok } from './fetchMock';
import { renderApp, renderWithProviders } from './renderWithProviders';

const burger = { id: 1, name: 'Classic Burger', price: 8.5 };
const tea = { id: 7, name: 'Lemon Iced Tea', price: 2.5 };
const deepFreeze = (o) => {
  Object.values(o).forEach((v) => v && typeof v === 'object' && deepFreeze(v));
  return Object.freeze(o);
};

afterEach(() => vi.unstubAllGlobals());

describe('counterSlice: reducers are pure functions', () => {
  it('state + action -> new state, without touching the old one (Immer)', () => {
    const before = deepFreeze({ value: 1 }); // frozen: a REAL mutation would throw
    const after = counterReducer(before, incremented());
    expect(after).toEqual({ value: 2 });
    expect(before.value).toBe(1);
    expect(counterReducer(after, amountAdded(5))).toEqual({ value: 7 });
    expect(counterReducer(after, reset())).toEqual({ value: 0 });
  });

  it('action creators build plain objects', () => {
    expect(amountAdded(5)).toEqual({ type: 'counter/amountAdded', payload: 5 });
  });
});

describe('cartSlice', () => {
  const start = () => cartReducer(undefined, { type: '@@init' });

  it('adding the same product twice increases its quantity', () => {
    let state = cartReducer(start(), itemAdded(burger));
    state = cartReducer(deepFreeze(state), itemAdded(burger)); // the frozen input proves Immer copied it
    state = cartReducer(state, itemAdded(tea));
    expect(state.items).toEqual([
      { productId: 1, name: 'Classic Burger', price: 8.5, quantity: 2 },
      { productId: 7, name: 'Lemon Iced Tea', price: 2.5, quantity: 1 },
    ]);
  });

  it('quantity is clamped to 1..20, and 0 removes the line', () => {
    let state = cartReducer(start(), itemAdded(burger));
    state = cartReducer(state, quantityChanged({ productId: 1, quantity: 99 }));
    expect(state.items[0].quantity).toBe(20);
    state = cartReducer(state, quantityChanged({ productId: 1, quantity: 0 }));
    expect(state.items).toEqual([]);
  });

  it('subtotal avoids floating-point drift, and selectors are memoized', () => {
    const store = makeStore();
    const third = { id: 9, name: 'Ten paise', price: 0.1 };
    store.dispatch(itemAdded(third));
    store.dispatch(quantityChanged({ productId: 9, quantity: 3 }));
    expect(selectCartSubtotal(store.getState())).toBe(0.3); // plain 0.1 * 3 gives 0.30000000000000004
    expect(selectCartCount(store.getState())).toBe(3);

    const a = selectCartSubtotal(store.getState());
    store.dispatch(incremented()); // an UNRELATED change
    expect(selectCartSubtotal(store.getState())).toBe(a); // not recalculated: the cart items are the same reference
  });

  it('RESETS ON LOGOUT (extraReducers listening to auth/loggedOut)', () => {
    const store = makeStore();
    store.dispatch(itemAdded(burger));
    store.dispatch(loggedOut());
    expect(store.getState().cart.items).toEqual([]);
  });

  it('priceCart sends ONLY ids and quantities, then uses the server prices and drops unavailable items', async () => {
    const fetchMock = mockFetch(() =>
      ok({ lines: [{ productId: 1, name: 'Classic Burger', unitPrice: 9, quantity: 2, lineTotal: 18 }], subtotal: 18, itemCount: 2, unavailableProductIds: [7] }),
    );
    const store = makeStore();
    store.dispatch(itemAdded(burger));
    store.dispatch(itemAdded(burger));
    store.dispatch(itemAdded(tea));

    await store.dispatch(priceCart());

    const sent = JSON.parse(await (await fetchMock.mock.calls[0][0]).clone().text());
    expect(sent).toEqual({ items: [{ productId: 1, quantity: 2 }, { productId: 7, quantity: 1 }] }); // no prices
    expect((await callDetails(fetchMock, 0)).url).toBe('http://localhost:5240/api/cart/price');
    const { cart } = store.getState();
    expect(cart.items).toEqual([{ productId: 1, name: 'Classic Burger', price: 9, quantity: 2 }]); // server price wins
    expect(cart.quote.subtotal).toBe(18);
  });

  it('changing the cart throws away the old server quote', () => {
    let state = { ...start(), items: [{ productId: 1, name: 'B', price: 1, quantity: 1 }], quote: { subtotal: 1 } };
    state = cartReducer(state, itemAdded(tea));
    expect(state.quote).toBeNull();
    expect(cartReducer(state, cartCleared())).toEqual(start());
  });
});

describe('authSlice: createAsyncThunk lifecycle', () => {
  it('pending -> fulfilled stores the session', async () => {
    mockFetch(() => ok({ accessToken: 'demo.2.9999999999', expiresAt: new Date(Date.now() + 60_000).toISOString(), user: CUSTOMER }));
    const store = makeStore();
    const pending = store.dispatch(loginUser({ email: 'asha@redstar.dev', password: 'x' }));
    expect(store.getState().auth.status).toBe('pending');
    await pending;
    expect(store.getState().auth).toMatchObject({ status: 'idle', error: null, session: { user: CUSTOMER } });
  });

  it('rejected keeps a plain, serialisable error message', async () => {
    mockFetch(() => fail(401, 'Invalid email or password.'));
    const store = makeStore();
    const result = await store.dispatch(loginUser({ email: 'a@b.co', password: 'x' }));
    expect(result.meta.requestStatus).toBe('rejected');
    expect(store.getState().auth).toMatchObject({ session: null, error: 'Invalid email or password.' });
  });
});

describe('cart persistence ("cart survives reload")', () => {
  it('persistCart saves on change, and loadCart restores it', () => {
    const store = makeStore();
    persistCart(store);
    store.dispatch(itemAdded(burger));

    const reloaded = makeStore({ cart: loadCart() });
    expect(reloaded.getState().cart.items).toEqual([{ productId: 1, name: 'Classic Burger', price: 8.5, quantity: 1 }]);
  });

  it('corrupted storage gives an empty cart instead of crashing', () => {
    localStorage.setItem('redstar.cart', '{oops');
    expect(makeStore({ cart: loadCart() }).getState().cart.items).toEqual([]);
  });
});

describe('UI with Redux', () => {
  const products = [
    { id: 1, name: 'Classic Burger', description: 'Beef', price: 8.5, categoryId: 1, categoryName: 'Burgers', categorySlug: 'burgers' },
    { id: 7, name: 'Lemon Iced Tea', description: 'Tea', price: 2.5, categoryId: 3, categoryName: 'Drinks', categorySlug: 'drinks' },
  ];
  const api = () =>
    mockFetch((url) => {
      const path = new URL(url).pathname;
      if (path === '/api/categories') return ok([]);
      if (path === '/api/products') return ok({ items: products, page: 1, pageSize: 9, totalCount: products.length, totalPages: 1, hasNext: false, hasPrevious: false });
      if (path === '/api/cart/price') return ok({ lines: [], subtotal: 19.5, itemCount: 3, unavailableProductIds: [] });
      return ok([]);
    });

  it('add from the product list -> the header badge updates (no props passed between them)', async () => {
    const user = userEvent.setup();
    api();
    renderApp('/products');

    await user.click(await screen.findByRole('button', { name: 'Add Classic Burger to cart' }));
    await user.click(screen.getByRole('button', { name: 'Add Classic Burger to cart' }));
    await user.click(screen.getByRole('button', { name: 'Add Lemon Iced Tea to cart' }));

    expect(screen.getByRole('link', { name: 'Cart, 3 items' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Classic Burger to cart' })).toHaveTextContent('In cart: 2');
  });

  it('cart page: change quantities, see the subtotal, and check prices with the server', async () => {
    const user = userEvent.setup();
    api();
    const { store } = renderApp('/cart');
    store.dispatch(itemAdded(products[0]));
    store.dispatch(itemAdded(products[1]));

    const burgerLine = await screen.findByRole('listitem', { name: 'Classic Burger' });
    await user.click(within(burgerLine).getByRole('button', { name: 'One more Classic Burger' }));
    expect(screen.getByTestId('client-subtotal')).toHaveTextContent('19.50');

    await user.click(screen.getByRole('button', { name: 'Check prices with the server' }));
    expect(await screen.findByTestId('server-subtotal')).toHaveTextContent('19.50');

    await user.click(within(screen.getByRole('listitem', { name: 'Lemon Iced Tea' })).getByRole('button', { name: 'Remove' }));
    expect(screen.queryByTestId('server-subtotal')).not.toBeInTheDocument(); // stale quote dropped
  });

  it('logging out empties the cart (the reset-on-logout reducer, end to end)', async () => {
    const user = userEvent.setup();
    api();
    loginAs(CUSTOMER);
    const { store } = renderApp('/cart');
    store.dispatch(itemAdded(products[0]));

    await user.click(await screen.findByRole('button', { name: /Log out/ }));

    await waitFor(() => expect(screen.getByText('Your cart is empty.')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Cart, 0 items' })).toBeInTheDocument();
  });

  it('two ReduxCounters share one store, so they stay in sync', async () => {
    const user = userEvent.setup();
    renderWithProviders(<><ReduxCounter /><ReduxCounter /></>);
    const [first] = screen.getAllByRole('button', { name: '+ 5' });
    await user.click(first);
    expect(screen.getAllByLabelText('redux count').map((o) => o.textContent)).toEqual(['5', '5']);
  });
});
