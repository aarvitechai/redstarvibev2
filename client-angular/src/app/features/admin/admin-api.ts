import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, Signal, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, mapApiErrors, unwrap } from '../../core/http/api';
import { Paged } from '../destinations/destinations-api';
import { OrderStatus } from '../orders/orders-api';

export interface AdminProduct {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly price: number;
  readonly categoryId: number;
  readonly categoryName: string;
  readonly imageUrl: string | null;
  readonly isActive: boolean;
  readonly rowVersion: string;
}
export type SaveProduct = Pick<AdminProduct, 'name' | 'description' | 'price' | 'categoryId' | 'isActive'> & { rowVersion?: string };

export interface AdminOrder {
  readonly id: number;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly status: OrderStatus;
  readonly total: number;
  readonly itemCount: number;
  readonly createdAt: string;
  readonly rowVersion: string;
  readonly allowedNextStatuses: OrderStatus[];
}

export const ADMIN_PAGE_SIZE = 10;

// Project 9 (Angular): the admin app's data. Two "tags" (version signals): every product change bumps
// productsVersion, every order change bumps ordersVersion, and the matching tables refetch.
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;
  private readonly productsVersion = signal(0);
  private readonly ordersVersion = signal(0);

  products(query: Signal<{ page: number; search: string }>) {
    return httpResource<Paged<AdminProduct>>(
      () => {
        this.productsVersion();
        const q = query();
        return { url: `${this.api}/admin/products`, params: { page: q.page, pageSize: ADMIN_PAGE_SIZE, ...(q.search.trim() ? { search: q.search.trim() } : {}) } };
      },
      { parse: (raw) => (raw as ApiResponse<Paged<AdminProduct>>).data! },
    );
  }

  createProduct(body: SaveProduct): Observable<AdminProduct> {
    return this.http.post<ApiResponse<AdminProduct>>(`${this.api}/admin/products`, body).pipe(unwrap(), tap(() => this.productsVersion.update((v) => v + 1)));
  }

  updateProduct(id: number, body: SaveProduct): Observable<AdminProduct> {
    return this.http.put<ApiResponse<AdminProduct>>(`${this.api}/admin/products/${id}`, body).pipe(unwrap(), tap(() => this.productsVersion.update((v) => v + 1)));
  }

  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/admin/products/${id}`).pipe(mapApiErrors(), tap(() => this.productsVersion.update((v) => v + 1)));
  }

  // FormData body: HttpClient lets the browser set "multipart/form-data; boundary=..." itself. Never set it by hand.
  uploadImage(id: number, file: File): Observable<AdminProduct> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ApiResponse<AdminProduct>>(`${this.api}/admin/products/${id}/image`, form).pipe(unwrap(), tap(() => this.productsVersion.update((v) => v + 1)));
  }

  orders(query: Signal<{ page: number; status: string }>) {
    return httpResource<Paged<AdminOrder>>(
      () => {
        this.ordersVersion();
        const q = query();
        return { url: `${this.api}/orders`, params: { page: q.page, pageSize: ADMIN_PAGE_SIZE, ...(q.status ? { status: q.status } : {}) } };
      },
      { parse: (raw) => (raw as ApiResponse<Paged<AdminOrder>>).data! },
    );
  }

  // Always refetch afterwards, including after a 409, so the table shows what's REALLY in the database
  updateOrderStatus(order: AdminOrder, status: OrderStatus): Observable<AdminOrder> {
    return this.http
      .put<ApiResponse<AdminOrder>>(`${this.api}/orders/${order.id}/status`, { status, rowVersion: order.rowVersion })
      .pipe(unwrap(), tap({ next: () => this.ordersVersion.update((v) => v + 1), error: () => this.ordersVersion.update((v) => v + 1) }));
  }
}
