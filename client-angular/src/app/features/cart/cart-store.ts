import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';
import { Session } from '../../core/auth/session';
import { ApiError, ApiResponse, unwrap } from '../../core/http/api';
import { CartAction, CartQuote, CartState, cartReducer, initialCartState, selectCount, selectSubtotal } from './cart.state';

const STORAGE_KEY = 'redstar.cart';

// The app-wide cart: ONE instance (providedIn: 'root'), like a Redux store.
//   state      a private signal          (store.getState())
//   dispatch   runs the pure reducer     (store.dispatch(action))
//   selectors  computed()                (useSelector / createSelector)
// Side effects (HTTP, localStorage, reacting to logout) live here, never in the reducer.
@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(DOCUMENT).defaultView?.localStorage ?? null;

  private readonly state = signal<CartState>(this.load());

  readonly items = computed(() => this.state().items);
  readonly quote = computed(() => this.state().quote);
  readonly count = computed(() => selectCount(this.state()));
  readonly subtotal = computed(() => selectSubtotal(this.state()));
  readonly quoteStatus = signal<'idle' | 'pending'>('idle');
  readonly quoteError = signal<string | null>(null);

  quantityOf(productId: number): number {
    return this.items().find((i) => i.productId === productId)?.quantity ?? 0;
  }

  constructor() {
    // "Cart survives reload": save whenever the items change
    effect(() => {
      const items = this.state().items;
      try {
        this.storage?.setItem(STORAGE_KEY, JSON.stringify({ items }));
      } catch {
        // storage full or blocked: the cart still works for this visit
      }
    });

    // RESET ON LOGOUT: the same rule as Redux's extraReducers on auth/loggedOut
    inject(Session).loggedOut$.pipe(takeUntilDestroyed()).subscribe(() => this.dispatch({ type: 'cleared' }));
  }

  dispatch(action: CartAction): void {
    this.state.update((s) => cartReducer(s, action));
    if (action.type !== 'priced') this.quoteError.set(null);
  }

  // Like createAsyncThunk: pending -> fulfilled ('priced') or rejected (quoteError).
  // Sends ONLY ids and quantities: the server decides the prices.
  priceWithServer(): void {
    const items = this.items().map(({ productId, quantity }) => ({ productId, quantity }));
    this.quoteStatus.set('pending');
    this.quoteError.set(null);
    this.http
      .post<ApiResponse<CartQuote>>(`${environment.apiUrl}/cart/price`, { items })
      .pipe(unwrap())
      .subscribe({
        next: (quote) => {
          this.dispatch({ type: 'priced', quote });
          this.quoteStatus.set('idle');
        },
        error: (e: ApiError) => {
          this.quoteError.set(e.message);
          this.quoteStatus.set('idle');
        },
      });
  }

  private load(): CartState {
    try {
      const saved = JSON.parse(this.storage?.getItem(STORAGE_KEY) ?? 'null') as { items?: unknown } | null;
      return Array.isArray(saved?.items) ? { items: saved.items as CartState['items'], quote: null } : initialCartState;
    } catch {
      return initialCartState; // corrupted: start empty
    }
  }
}
