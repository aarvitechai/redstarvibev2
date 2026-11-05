import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiError, toApiError } from '../../core/http/api';
import { ToastService } from '../../core/ui/toast';
import { ORDER_STATUSES, OrderStatus } from '../orders/orders-api';
import { AdminApi, AdminOrder } from './admin-api';

// Plan 14.7 (Angular): every order, a status filter, and status updates limited to what the SERVER allows next
@Component({
  selector: 'app-admin-orders-page',
  imports: [CurrencyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="admin-orders-title">
      <h1 id="admin-orders-title">Orders</h1>
      <label class="search">Status
        <select (change)="onFilter($event)">
          <option value="" [selected]="!status()">All</option>
          @for (s of statuses; track s) { <option [value]="s" [selected]="status() === s">{{ s }}</option> }
        </select>
      </label>

      @if (loadError()) { <p role="alert" class="form-error">{{ loadError() }}</p> }
      @if (!data()) {
        <p class="muted">Loading…</p>
      } @else {
        @let d = data()!;
        <div class="table-wrap">
          <table class="table" [attr.aria-busy]="list.isLoading()">
            <caption class="muted">{{ d.totalCount }} orders</caption>
            <thead><tr><th scope="col">Order</th><th scope="col">Customer</th><th scope="col">Placed</th><th scope="col">Items</th><th scope="col">Total</th><th scope="col">Status</th><th scope="col">Change status</th></tr></thead>
            <tbody>
              <!-- track by id AND rowVersion: after a refetch, the row (and its dropdown) starts fresh -->
              @for (o of d.items; track o.id + o.rowVersion) {
                <tr [attr.aria-label]="'Order ' + o.id">
                  <td>#{{ o.id }}</td>
                  <td>{{ o.customerName }}<br /><span class="muted">{{ o.customerEmail }}</span></td>
                  <td>{{ o.createdAt | date: 'medium' }}</td>
                  <td>{{ o.itemCount }}</td>
                  <td>{{ o.total | currency: 'INR' : 'symbol' : '1.2-2' : 'en-IN' }}</td>
                  <td><span class="badge">{{ o.status }}</span></td>
                  <td class="row-actions">
                    @if (o.allowedNextStatuses.length === 0) {
                      <span class="muted">Final</span>
                    } @else {
                      <label class="sr-only" [for]="'next-' + o.id">Next status for order {{ o.id }}</label>
                      <select #next [id]="'next-' + o.id" [disabled]="savingId() === o.id">
                        @for (s of o.allowedNextStatuses; track s) { <option [value]="s">{{ s }}</option> }
                      </select>
                      <button type="button" class="btn" (click)="apply(o, $any(next.value))" [disabled]="savingId() === o.id">
                        {{ savingId() === o.id ? 'Saving…' : 'Update' }}
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
          @if (d.totalCount === 0) { <p class="muted">No orders@if (status()) { with status {{ status() }}}.</p> }
        </div>
      }
    </section>
  `,
  styleUrl: './admin.scss',
})
export class AdminOrdersPage {
  private readonly admin = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly page = input<string>();
  readonly status = input<string>();
  protected readonly statuses = ORDER_STATUSES;
  private readonly query = computed(() => ({ page: Math.max(1, Number(this.page()) || 1), status: this.status() ?? '' }));
  protected readonly list = this.admin.orders(this.query);
  protected readonly data = computed(() => (this.list.hasValue() ? this.list.value() : undefined));
  protected readonly loadError = computed(() => (this.list.error() ? toApiError(this.list.error()).message : null));
  protected readonly savingId = signal<number | null>(null);

  protected onFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.router.navigate([], { queryParams: { status: value || null, page: null } });
  }

  protected apply(order: AdminOrder, next: OrderStatus): void {
    this.savingId.set(order.id);
    this.admin.updateOrderStatus(order, next).subscribe({
      next: () => {
        this.savingId.set(null);
        this.toast.success(`Order #${order.id} is now ${next}.`);
      },
      error: (e: ApiError) => {
        this.savingId.set(null);
        this.toast.error(e.status === 409 ? 'Someone else changed this order. The list has been refreshed.' : e.message);
      },
    });
  }
}
