import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, unwrap } from '../../core/http/api';

export interface Category {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
}

export interface Product {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly price: number;
  readonly categoryId: number;
  readonly categoryName: string;
  readonly categorySlug: string;
}

export type ProductSort = 'name' | 'priceAsc' | 'priceDesc';
export interface ProductFilters {
  category?: string;
  search?: string;
  sort?: ProductSort;
}

export const PRODUCT_SORTS: { value: ProductSort; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'priceAsc', label: 'Price: low to high' },
  { value: 'priceDesc', label: 'Price: high to low' },
];

@Injectable({ providedIn: 'root' })
export class ProductsApi {
  private readonly http = inject(HttpClient);
  private readonly url = environment.apiUrl;

  // Categories rarely change: request them ONCE and share the result with every subscriber.
  // (the sidebar AND the list both need them). shareReplay(1) replays the last value to late subscribers.
  readonly categories$: Observable<Category[]> = this.http
    .get<ApiResponse<Category[]>>(`${this.url}/categories`)
    .pipe(unwrap(), shareReplay({ bufferSize: 1, refCount: false }));

  list({ category, search, sort }: ProductFilters = {}): Observable<Product[]> {
    let params = new HttpParams();
    if (category) params = params.set('category', category); // HttpParams is immutable: set() returns a new one
    if (search?.trim()) params = params.set('search', search.trim());
    if (sort && sort !== 'name') params = params.set('sort', sort);
    return this.http.get<ApiResponse<Product[]>>(`${this.url}/products`, { params }).pipe(unwrap());
  }

  get(id: number): Observable<Product> {
    return this.http.get<ApiResponse<Product>>(`${this.url}/products/${id}`).pipe(unwrap());
  }
}
