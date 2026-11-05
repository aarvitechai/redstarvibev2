import { combineReducers, configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import cartReducer from './cartSlice';
import counterReducer from './counterSlice';
import themeReducer from './themeSlice';
import { baseApi } from './api/baseApi';

// THE STORE: one object holding all app-wide client state.
//   state = { counter, cart, theme, auth }
// configureStore adds Redux DevTools support and dev-only checks (accidental mutations, non-serialisable values).
// Phase 10: plus state.api, the RTK Query cache for server data.
const rootReducer = combineReducers({
  counter: counterReducer,
  cart: cartReducer,
  theme: themeReducer,
  auth: authReducer,
  [baseApi.reducerPath]: baseApi.reducer, // RTK Query's cache lives at state.api
});

const CART_KEY = 'redstar.cart';

export function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) ?? 'null');
    return Array.isArray(saved?.items) ? { items: saved.items, quote: null, quoteStatus: 'idle', quoteError: null } : undefined;
  } catch {
    return undefined; // corrupted: start with an empty cart
  }
}

// A FACTORY, not a single global store: each test gets a fresh store, and preloadedState lets a test start
// from any state it needs.
export function makeStore(preloadedState) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    // REQUIRED for RTK Query: the middleware runs the requests, de-duplicates them, refetches after
    // invalidation, and cleans up unused cache entries. Forgetting it (or api.reducer) is a classic mistake.
    middleware: (getDefault) => getDefault().concat(baseApi.middleware),
  });
}

// Save the cart whenever it changes ("cart survives reload"). Subscribing outside the reducers keeps them pure.
export function persistCart(store) {
  let last = store.getState().cart.items;
  return store.subscribe(() => {
    const items = store.getState().cart.items;
    if (items === last) return; // the same reference means unchanged (immutability makes this check cheap)
    last = items;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify({ items }));
    } catch {
      // storage full or blocked: the cart still works for this visit
    }
  });
}
