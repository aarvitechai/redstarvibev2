import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterOutlet } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { ProductsApi } from './products-api';

// A NESTED LAYOUT: /products and /products/:id render inside this component's <router-outlet>,
// so the category sidebar stays on screen for both.
@Component({
  selector: 'app-products-layout',
  imports: [RouterLink, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="layout">
      <aside class="sidebar">
        <h2 class="sidebar-title">Categories</h2>
        <nav aria-label="Categories">
          <ul>
            @for (c of items(); track c.slug) {
              <li>
                <!-- queryParamsHandling="merge": change ONLY the category, and keep the search and sort the user chose.
                     A null value removes the param ("All"). -->
                <a routerLink="/products" [queryParams]="{ category: c.slug || null, page: null }" queryParamsHandling="merge"
                   [class.active]="(category() ?? '') === c.slug" [attr.aria-current]="(category() ?? '') === c.slug ? 'page' : null">
                  {{ c.name }}
                </a>
              </li>
            }
          </ul>
        </nav>
        @if (failed()) { <p role="alert" class="error">Could not load categories.</p> }
      </aside>
      <div class="content"><router-outlet /></div>
    </div>
  `,
  styleUrl: './products.scss',
})
export class ProductsLayout {
  // Bound from ?category= by withComponentInputBinding (query params reach every routed component)
  readonly category = input<string>();

  private readonly result = toSignal(
    inject(ProductsApi).categories$.pipe(
      map((categories) => ({ categories, failed: false })),
      catchError(() => of({ categories: [], failed: true })),
    ),
    { initialValue: { categories: [], failed: false } },
  );

  protected readonly items = () => [{ slug: '', name: 'All' }, ...this.result().categories];
  protected readonly failed = () => this.result().failed;
}
