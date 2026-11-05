import { KeyValuePipe, TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith } from 'rxjs';
import { AdminSummary, AuthService } from '../../core/auth/auth';
import { ApiError } from '../../core/http/api';

type State = { loading: true } | { loading: false; data: AdminSummary } | { loading: false; error: string };

// /admin: roleGuard('Admin') hides it from customers (UX); the API's [Authorize(Roles = "Admin")] protects the data
@Component({
  selector: 'app-admin-page',
  imports: [KeyValuePipe, TitleCasePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="admin-title">
      <h1 id="admin-title">Admin</h1>
      @let s = state();
      @if (s.loading) { <p class="muted">Loading…</p> }
      @if ('error' in s) { <p role="alert" class="error">{{ s.error }}</p> }
      @if ('data' in s) {
        <ul class="cards" aria-label="Summary">
          @for (item of s.data | keyvalue; track item.key) {
            <li class="card"><span class="muted">{{ item.key | titlecase }}</span><strong class="big">{{ item.value }}</strong></li>
          }
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
