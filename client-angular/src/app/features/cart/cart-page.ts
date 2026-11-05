import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartStore } from './cart-store';
import { MAX_QUANTITY } from './cart.state';

// Project 4 (Angular): the cart, read from and written to the CartStore
@Component({
  selector: 'app-cart-page',
  imports: [CurrencyPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="cart-title">
      <h1 id="cart-title">Your cart</h1>
      @if (cart.items().length === 0) {
        <p class="muted">Your cart is empty.</p>
        <a routerLink="/products">Browse products</a>
      } @else {
        <ul class="lines" aria-label="Cart items">
          @for (item of cart.items(); track item.productId) {
            <li class="line" [attr.aria-label]="item.name">
              <div class="name"><strong>{{ item.name }}</strong><span class="muted">{{ item.price | currency: 'INR' : 'symbol' : '1.2-2' : 'en-IN' }} each</span></div>
              <div class="qty">
                <button type="button" class="btn" [attr.aria-label]="'One less ' + item.name" (click)="setQty(item.productId, item.quantity - 1)">−</button>
                <input type="number" min="1" [max]="max" [value]="item.quantity" [attr.aria-label]="'Quantity of ' + item.name"
                       (change)="setQty(item.productId, +$any($event.target).value || 1)" />
                <button type="button" class="btn" [attr.aria-label]="'One more ' + item.name" [disabled]="item.quantity >= max"
                        (click)="setQty(item.productId, item.quantity + 1)">+</button>
              </div>
              <span class="total">{{ item.price * item.quantity | currency: 'INR' : 'symbol' : '1.2-2' : 'en-IN' }}</span>
              <button type="button" class="btn" (click)="cart.dispatch({ type: 'removed', productId: item.productId })">Remove</button>
            </li>
          }
        </ul>

        <div class="summary" aria-label="Summary">
          <div class="row"><span>Items</span><span>{{ cart.count() }}</span></div>
          <div class="row"><span>Subtotal (in your browser)</span><span data-testid="client-subtotal">{{ cart.subtotal() | currency: 'INR' : 'symbol' : '1.2-2' : 'en-IN' }}</span></div>
          @if (cart.quote(); as quote) {
            <div class="row big"><span>Subtotal (checked by the server)</span><span data-testid="server-subtotal">{{ quote.subtotal | currency: 'INR' : 'symbol' : '1.2-2' : 'en-IN' }}</span></div>
            @if (quote.unavailableProductIds.length > 0) { <p role="alert" class="warn">Some products are no longer available and were removed.</p> }
          }
          @if (cart.quoteError()) { <p role="alert" class="warn">{{ cart.quoteError() }}</p> }
          <p class="muted">The browser total is for display only. At checkout (Phase 13) the server prices the order again.</p>
          <div class="actions">
            <button type="button" class="add" (click)="cart.priceWithServer()" [disabled]="cart.quoteStatus() === 'pending'">
              {{ cart.quoteStatus() === 'pending' ? 'Checking…' : 'Check prices with the server' }}
            </button>
            <button type="button" class="btn" (click)="cart.dispatch({ type: 'cleared' })">Empty cart</button>
          </div>
        </div>
      }
    </section>
  `,
  styles: `
    .muted { color: var(--muted); font-size: 0.875rem; }
    .lines { list-style: none; margin: 16px 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .line { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 16px; }
    .name { flex: 1 1 180px; min-width: 0; display: flex; flex-direction: column; }
    .qty { display: flex; align-items: center; gap: 4px; }
    .qty input { width: 56px; font: inherit; text-align: center; padding: 4px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); }
    .btn { font: inherit; font-size: 0.8125rem; padding: 4px 10px; border-radius: 8px; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text); }
    .btn:disabled, .add:disabled { opacity: 0.5; cursor: not-allowed; }
    .add { font: inherit; font-size: 0.8125rem; padding: 6px 12px; border-radius: 8px; cursor: pointer; background: var(--primary); color: var(--primary-contrast); border: 1px solid var(--primary); }
    .total { font-weight: 700; min-width: 90px; text-align: right; }
    .summary { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; display: flex; flex-direction: column; gap: 8px; max-width: 420px; margin-left: auto; }
    .row { display: flex; justify-content: space-between; gap: 12px; }
    .big { font-size: 1.25rem; font-weight: 700; }
    .warn { color: var(--primary); }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  `,
})
export class CartPage {
  protected readonly cart = inject(CartStore);
  protected readonly max = MAX_QUANTITY;

  protected setQty(productId: number, quantity: number): void {
    this.cart.dispatch({ type: 'quantityChanged', productId, quantity });
  }
}
