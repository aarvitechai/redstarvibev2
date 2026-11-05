import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CartStore } from './cart-store';
import { MAX_QUANTITY } from './cart.state';

// Any component can use the cart by injecting the store: no inputs passed down through page -> list -> card
@Component({
  selector: 'app-add-to-cart-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="add" (click)="add()" [disabled]="inCart() >= max" [attr.aria-label]="'Add ' + product().name + ' to cart'">
      {{ inCart() > 0 ? 'In cart: ' + inCart() + ' · Add one' : 'Add to cart' }}
    </button>
  `,
  styles: `
    .add {
      font: inherit; font-size: 0.8125rem; padding: 6px 12px; border-radius: 8px; cursor: pointer;
      background: var(--primary); color: var(--primary-contrast); border: 1px solid var(--primary);
    }
    .add:disabled { opacity: 0.5; cursor: not-allowed; }
  `,
})
export class AddToCartButton {
  readonly product = input.required<{ id: number; name: string; price: number }>();
  private readonly cart = inject(CartStore);
  protected readonly max = MAX_QUANTITY;
  protected readonly inCart = computed(() => this.cart.items().find((i) => i.productId === this.product().id)?.quantity ?? 0);

  protected add(): void {
    const { id, name, price } = this.product();
    this.cart.dispatch({ type: 'added', product: { id, name, price } });
  }
}
