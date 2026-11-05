// The Redux pattern without a library: ACTIONS (a typed union) -> a PURE REDUCER -> new STATE.
// CartStore keeps this state in a signal and calls the reducer on every dispatch.
// (A big Angular app might use NgRx, which is Redux for Angular. A signal + reducer covers the same ideas.)

export const MAX_QUANTITY = 20; // the same limit the API enforces

export interface CartItem {
  readonly productId: number;
  readonly name: string;
  readonly price: number; // for DISPLAY only: the server prices the order (POST /api/cart/price)
  readonly quantity: number;
}

export interface CartQuote {
  readonly lines: { productId: number; name: string; unitPrice: number; quantity: number; lineTotal: number }[];
  readonly subtotal: number;
  readonly itemCount: number;
  readonly unavailableProductIds: number[];
}

export interface CartState {
  readonly items: readonly CartItem[];
  readonly quote: CartQuote | null;
}

export const initialCartState: CartState = { items: [], quote: null };

export type CartAction =
  | { type: 'added'; product: { id: number; name: string; price: number } }
  | { type: 'removed'; productId: number }
  | { type: 'quantityChanged'; productId: number; quantity: number }
  | { type: 'cleared' }
  | { type: 'priced'; quote: CartQuote };

const clamp = (q: number) => Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(q) || 1));

// PURE: no HTTP, no storage, no Date.now(). The same input always gives the same output, so it's trivial to test.
// No Immer here, so every update builds new arrays and objects by hand (spread, map, filter).
export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'added': {
      const { product } = action;
      const exists = state.items.some((i) => i.productId === product.id);
      const items = exists
        ? state.items.map((i) => (i.productId === product.id ? { ...i, quantity: clamp(i.quantity + 1) } : i))
        : [...state.items, { productId: product.id, name: product.name, price: product.price, quantity: 1 }];
      return { items, quote: null }; // the cart changed, so the old server quote no longer applies
    }
    case 'removed':
      return { items: state.items.filter((i) => i.productId !== action.productId), quote: null };
    case 'quantityChanged':
      return {
        items:
          action.quantity <= 0
            ? state.items.filter((i) => i.productId !== action.productId)
            : state.items.map((i) => (i.productId === action.productId ? { ...i, quantity: clamp(action.quantity) } : i)),
        quote: null,
      };
    case 'cleared':
      return initialCartState;
    case 'priced': {
      const { quote } = action;
      const items = state.items
        .filter((i) => !quote.unavailableProductIds.includes(i.productId))
        .map((i) => {
          const line = quote.lines.find((l) => l.productId === i.productId);
          return line ? { ...i, price: line.unitPrice } : i; // the server's price wins
        });
      return { items, quote };
    }
    default: {
      const unhandled: never = action;
      throw new Error(`Unknown cart action: ${JSON.stringify(unhandled)}`);
    }
  }
}

// Selectors: plain functions of the state. CartStore wraps them in computed() (memoized, like createSelector).
export const selectCount = (s: CartState) => s.items.reduce((n, i) => n + i.quantity, 0);
// Work in paise (integers) to avoid floating-point drift: 0.1 + 0.2 !== 0.3
export const selectSubtotal = (s: CartState) => s.items.reduce((sum, i) => sum + Math.round(i.price * 100) * i.quantity, 0) / 100;
