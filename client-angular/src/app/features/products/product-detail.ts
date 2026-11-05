import { CurrencyPipe, Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink, UrlTree } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { ApiError } from '../../core/http/api';
import { NotFound } from '../home/not-found';
import { Product, ProductsApi } from './products-api';

type DetailState =
  | { status: 'loading' }
  | { status: 'ok'; product: Product }
  | { status: 'not-found' }
  | { status: 'error'; message: string };

// /products/:id. The :id route param arrives as an input (a STRING), so validate it before use.
@Component({
  selector: 'app-product-detail',
  imports: [RouterLink, CurrencyPipe, NotFound],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = state();
    @if (s.status === 'not-found') {
      <app-not-found title="Product not found" [message]="notFoundMessage()" />
    } @else {
      <article aria-labelledby="product-title" [attr.aria-busy]="s.status === 'loading'">
        <a class="back" [routerLink]="backTo">← Back to results</a>
        @switch (s.status) {
          @case ('loading') { <p class="muted">Loading…</p> }
          @case ('error') { <div role="alert" class="error">Could not load this product: {{ s.message }}</div> }
          @case ('ok') {
            <div class="detail">
              <a class="badge" routerLink="/products" [queryParams]="{ category: s.product.categorySlug }">{{ s.product.categoryName }}</a>
              <h1 id="product-title">{{ s.product.name }}</h1>
              <p>{{ s.product.description }}</p>
              <p class="price-large">{{ s.product.price | currency: 'INR' : 'symbol' : '1.2-2' : 'en-IN' }}</p>
            </div>
          }
        }
      </article>
    }
  `,
  styleUrl: './products.scss',
})
export class ProductDetail {
  private readonly api = inject(ProductsApi);
  readonly id = input.required<string>();

  // Navigation state set by the list's [state]. Missing when the user pasted the link or refreshed.
  private readonly navState = inject(Location).getState() as { from?: string } | null;
  // parseUrl -> a UrlTree. A plain STRING in [routerLink] is treated as path segments, so the "?" would be
  // encoded (/products%3Fcategory%3Dpizza) and the link would 404. A test caught this.
  protected readonly backTo: UrlTree = inject(Router).parseUrl(this.navState?.from ?? '/products');

  protected readonly notFoundMessage = computed(() => `There is no product with id "${this.id()}".`);

  protected readonly state = toSignal(
    toObservable(this.id).pipe(
      switchMap((id) =>
        /^\d+$/.test(id)
          ? this.api.get(Number(id)).pipe(
              map((product): DetailState => ({ status: 'ok', product })),
              catchError((e: ApiError) =>
                of<DetailState>(e.status === 404 ? { status: 'not-found' } : { status: 'error', message: e.message }),
              ),
              startWith<DetailState>({ status: 'loading' }),
            )
          : of<DetailState>({ status: 'not-found' }), // /products/abc: don't even call the API
      ),
    ),
    { initialValue: { status: 'loading' } as DetailState },
  );

  constructor() {
    // A data-driven page title (the route's static title is just "Product")
    const title = inject(Title);
    const name = computed(() => {
      const s = this.state();
      return s.status === 'ok' ? s.product.name : s.status === 'not-found' ? 'Product not found' : null;
    });
    effect(() => {
      const n = name();
      if (n) title.setTitle(`${n} · RedStarVibe`);
    });
  }
}
