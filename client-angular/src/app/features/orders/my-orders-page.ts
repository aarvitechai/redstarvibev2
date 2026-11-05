import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiError, toApiError } from '../../core/http/api';
import { OrdersApi } from './orders-api';
import { StarRating } from './star-rating';

// /orders: a Customer's own orders (roleGuard('Customer'); the API returns ONLY this user's orders anyway)
@Component({
  selector: 'app-my-orders-page',
  imports: [CurrencyPipe, DatePipe, RouterLink, StarRating],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './my-orders-page.html',
  styleUrl: './orders.scss',
})
export class MyOrdersPage {
  private readonly api = inject(OrdersApi);
  private readonly router = inject(Router);

  readonly page = input<string>();
  readonly placed = input<string>(); // ?placed=100 after checkout
  protected readonly pageNumber = computed(() => Math.max(1, Number(this.page()) || 1));
  protected readonly list = this.api.myOrders(this.pageNumber);

  protected readonly data = computed(() => (this.list.hasValue() ? this.list.value() : undefined));
  protected readonly loadError = computed(() => (this.list.error() ? toApiError(this.list.error()).message : null));
  protected readonly rateError = signal<string | null>(null);
  protected readonly rating = signal(false);

  protected rate(orderId: number, lineId: number, value: number): void {
    this.rating.set(true);
    this.rateError.set(null);
    this.api.rate(orderId, lineId, value).subscribe({
      next: () => this.rating.set(false), // the version bump refetches the list with the saved rating
      error: (e: ApiError) => {
        this.rating.set(false);
        this.rateError.set(e.message);
      },
    });
  }

  protected goTo(page: number): void {
    this.router.navigate([], { queryParams: { page: page > 1 ? page : null, placed: null }, queryParamsHandling: 'merge' });
  }
}
