import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith } from 'rxjs';
import { AdminSummary, AuthService } from '../../core/auth/auth';
import { ApiError } from '../../core/http/api';

type State = { loading: true } | { loading: false; data: AdminSummary } | { loading: false; error: string };

// /admin: the overview. roleGuard('Admin') hides it from customers (UX); the API's [Authorize(Roles = "Admin")]
// is what really protects the data.
@Component({
  selector: 'app-admin-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="admin-title">
      <h1 id="admin-title">Admin</h1>
      @let s = state();
      @if (s.loading) { <p class="muted">Loading…</p> }
      @if ('error' in s) { <p role="alert" class="error">{{ s.error }}</p> }
      @if ('data' in s) {
        <ul class="cards" aria-label="Summary">
          <li><a class="card" routerLink="/admin/products"><span class="muted">Products</span><strong class="big">{{ s.data.products }}</strong></a></li>
          <li><a class="card" routerLink="/admin/orders"><span class="muted">Orders</span><strong class="big">Manage</strong></a></li>
          <li class="card"><span class="muted">Categories</span><strong class="big">{{ s.data.categories }}</strong></li>
          <li class="card"><span class="muted">Contacts</span><strong class="big">{{ s.data.contacts }}</strong></li>
        </ul>
      }
    </section>
  `,
  styleUrl: './auth.scss',
})
export class AdminPage {
  protected readonly state = toSignal(
    inject(AuthService).adminSummary().pipe(
      map((data): State => ({ loading: false, data })),
      catchError((e: ApiError) => of<State>({ loading: false, error: e.message })),
      startWith<State>({ loading: true }),
    ),
    { initialValue: { loading: true } as State },
  );
}
