import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, linkedSignal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, map, of, startWith, switchMap } from 'rxjs';
import { ApiError } from '../../core/http/api';
import { AddToCartButton } from '../cart/add-to-cart-button';
import { PRODUCT_SORTS, Product, ProductSort, ProductsApi } from './products-api';

interface ListState {
  loading: boolean;
  products: Product[];
  error: string | null;
}

// THE URL IS THE STATE. ?category, ?q and ?sort arrive as INPUTS (withComponentInputBinding).
// To change a filter we NAVIGATE to a new URL; the inputs update, and the data reloads.
// Refresh, share the link, or press Back: you get the same results.
@Component({
  selector: 'app-product-list',
  imports: [RouterLink, CurrencyPipe, AddToCartButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-list.html',
  styleUrl: './products.scss',
})
export class ProductList {
  private readonly api = inject(ProductsApi);
  private readonly router = inject(Router);

  readonly category = input<string>();
  readonly q = input<string>();
  readonly sort = input<string>();

  protected readonly sorts = PRODUCT_SORTS;
  protected readonly sortValue = computed<ProductSort>(() =>
    PRODUCT_SORTS.some((s) => s.value === this.sort()) ? (this.sort() as ProductSort) : 'name',
  );

  // linkedSignal: the text box is WRITABLE while typing, but RESETS whenever ?q changes from outside
  // (Back button, "Clear filters"). It replaces React's { forUrl, value } trick.
  protected readonly searchBox = linkedSignal(() => this.q() ?? '');
  private readonly typing = new Subject<string>();

  private readonly categories = toSignal(this.api.categories$.pipe(catchError(() => of([]))), { initialValue: [] });

  protected readonly state = toSignal(
    toObservable(computed(() => ({ category: this.category() ?? '', search: this.q() ?? '', sort: this.sortValue() }))).pipe(
      switchMap((filters) =>
        this.api.list(filters).pipe(
          map((products): ListState => ({ loading: false, products, error: null })),
          catchError((e: ApiError) => of<ListState>({ loading: false, products: [], error: e.message })),
          startWith<ListState>({ loading: true, products: [], error: null }),
        ),
      ),
    ),
    { initialValue: { loading: true, products: [], error: null } as ListState },
  );

  protected readonly categoryName = computed(() => this.categories().find((c) => c.slug === this.category())?.name);
  protected readonly heading = computed(() => (this.category() ? (this.categoryName() ?? this.category()!) : 'All products'));
  protected readonly unknownCategory = computed(() => !!this.category() && this.categories().length > 0 && !this.categoryName());
  protected readonly hasFilters = computed(() => !!this.category() || !!this.q() || this.sortValue() !== 'name');

  constructor() {
    // Typing -> wait 300 ms -> write ?q= (replaceUrl: no history entry for every pause)
    this.typing
      .pipe(debounceTime(300), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((value) => this.navigate({ q: value.trim() || null }, true));

    // A data-driven page title
    const title = inject(Title);
    effect(() => title.setTitle(`${this.heading()} · RedStarVibe`));
  }

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchBox.set(value);
    this.typing.next(value);
  }

  protected onSort(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.navigate({ sort: value === 'name' ? null : value });
  }

  protected clear(): void {
    this.router.navigate(['/products']);
  }

  // Navigate to the SAME page with changed query params. merge keeps the others; null removes one.
  private navigate(queryParams: Record<string, string | null>, replaceUrl = false): void {
    this.router.navigate([], { queryParams, queryParamsHandling: 'merge', replaceUrl });
  }

  // Passed to the detail page as navigation state, so "Back to results" returns to THIS filtered list
  protected get currentUrl(): string {
    return this.router.url;
  }
}
