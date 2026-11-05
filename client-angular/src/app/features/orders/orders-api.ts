import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, Signal, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, unwrap } from '../../core/http/api';
import { Paged } from '../destinations/destinations-api';

// Must match server/Server.Api/Models/Entities/OrderEntities.cs (OrderStatus): ONE list for API and UI
export const ORDER_STATUSES = ['Pending', 'Confirmed', 'Ready', 'Completed', 'Cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderLine {
  readonly id: number;
  readonly productId: number;
  readonly productName: string;
  readonly unitPrice: number;
  readonly quantity: number;
  readonly lineTotal: number;
  readonly rating: number | null;
}

export interface Order {
  readonly id: number;
  readonly status: OrderStatus;
  readonly total: number;
  readonly createdAt: string;
  readonly lines: OrderLine[];
  readonly rowVersion: string;
  readonly canRate: boolean;
}

export const ORDERS_PAGE_SIZE = 5;

@Injectable({ providedIn: 'root' })
export class OrdersApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/orders`;
  private readonly version = signal(0); // the "tag": bumped after placing or rating, so "My orders" refetches

  myOrders(page: Signal<number>) {
    return httpResource<Paged<Order>>(
      () => {
        this.version();
        return { url: `${this.url}/mine`, params: { page: page(), pageSize: ORDERS_PAGE_SIZE } };
      },
      { parse: (raw) => (raw as ApiResponse<Paged<Order>>).data! },
    );
  }

  // Only ids and quantities: the SERVER prices the order (snapshot pricing) and saves it in one transaction
  place(items: readonly { productId: number; quantity: number }[]): Observable<Order> {
    return this.http
      .post<ApiResponse<Order>>(this.url, { items: items.map(({ productId, quantity }) => ({ productId, quantity })) })
      .pipe(unwrap(), tap(() => this.version.update((v) => v + 1)));
  }

  rate(orderId: number, lineId: number, rating: number): Observable<Order> {
    return this.http
      .put<ApiResponse<Order>>(`${this.url}/${orderId}/details/${lineId}/rating`, { rating })
      .pipe(unwrap(), tap(() => this.version.update((v) => v + 1)));
  }
}
