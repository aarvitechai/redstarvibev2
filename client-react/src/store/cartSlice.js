import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit';
import { request } from '../services/http';
import { loggedOut } from './authSlice';

export const MAX_QUANTITY = 20; // the same limit the API enforces

// The server is the source of truth for prices. The client keeps what's needed to SHOW the cart
// (name and price for display) and sends only ids and quantities to be priced.
export const priceCart = createAsyncThunk('cart/price', async (_arg, { getState, rejectWithValue }) => {
  const items = getState().cart.items.map(({ productId, quantity }) => ({ productId, quantity }));
  try {
    return await request('/cart/price', { method: 'POST', body: { items } });
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

const clamp = (q) => Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(q) || 1));

const initialState = { items: [], quote: null, quoteStatus: 'idle', quoteError: null };

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    // payload: a product { id, name, price } -> adds 1, or increases the quantity if it's already in the cart
    itemAdded: (state, { payload: product }) => {
      const existing = state.items.find((i) => i.productId === product.id);
      if (existing) existing.quantity = clamp(existing.quantity + 1); // Immer: a "mutation" on the draft
      else state.items.push({ productId: product.id, name: product.name, price: product.price, quantity: 1 });
      state.quote = null; // the cart changed, so the old server quote no longer applies
    },
    itemRemoved: (state, { payload: productId }) => {
      state.items = state.items.filter((i) => i.productId !== productId);
      state.quote = null;
    },
    quantityChanged: (state, { payload: { productId, quantity } }) => {
      const item = state.items.find((i) => i.productId === productId);
      if (!item) return;
      if (quantity <= 0) state.items = state.items.filter((i) => i.productId !== productId);
      else item.quantity = clamp(quantity);
      state.quote = null;
    },
    cartCleared: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // RESET ON LOGOUT: a cart belongs to whoever was logged in, so the next user mustn't inherit it
      .addCase(loggedOut, () => initialState)
      .addCase(priceCart.pending, (state) => {
        state.quoteStatus = 'pending';
        state.quoteError = null;
      })
      .addCase(priceCart.fulfilled, (state, { payload: quote }) => {
        state.quoteStatus = 'idle';
        state.quote = quote;
        // Use the server's prices from now on, and drop products that no longer exist
        for (const line of quote.lines) {
          const item = state.items.find((i) => i.productId === line.productId);
          if (item) item.price = line.unitPrice;
        }
        state.items = state.items.filter((i) => !quote.unavailableProductIds.includes(i.productId));
      })
      .addCase(priceCart.rejected, (state, { payload }) => {
        state.quoteStatus = 'idle';
        state.quoteError = payload ?? 'Could not check prices.';
      });
  },
});

export const { itemAdded, itemRemoved, quantityChanged, cartCleared } = cartSlice.actions;
export default cartSlice.reducer;

// ---------- selectors ----------
export const selectCartItems = (state) => state.cart.items;
export const selectCartQuote = (state) => state.cart.quote;

// createSelector MEMOIZES: it recalculates only when selectCartItems returns a NEW array.
// Without it, every useSelector call would build a new number/array and could cause extra re-renders.
export const selectCartCount = createSelector([selectCartItems], (items) => items.reduce((n, i) => n + i.quantity, 0));
export const selectCartSubtotal = createSelector([selectCartItems], (items) =>
  // Work in paise (integers) to avoid floating-point drift: 0.1 + 0.2 !== 0.3 in JavaScript
  items.reduce((sum, i) => sum + Math.round(i.price * 100) * i.quantity, 0) / 100,
);
export const selectQuantityOf = (productId) => (state) =>
  state.cart.items.find((i) => i.productId === productId)?.quantity ?? 0;
