import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';
import { AuthService, ROLES } from '../../core/auth/auth';
import { Session } from '../../core/auth/session';
import { ApiError } from '../../core/http/api';

// /account: any logged-in user (authGuard)
@Component({
  selector: 'app-account-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- @if ... as u: after a logout the template can render once more with no user, before the guard redirects -->
    @if (session.user(); as u) {
    <section aria-labelledby="account-title">
      <h1 id="account-title">Account</h1>
      <div class="panel">
        <p><strong>{{ u.name }}</strong> · {{ u.email }}</p>
        <p class="muted">Roles in the browser: {{ u.roles.join(', ') }}</p>
        <p class="muted" aria-live="polite">Server says: {{ serverView() }}</p>
      </div>

      @if (!session.hasRole(roles.admin)) {
        <div class="panel">
          <h2>Try it: call the admin API anyway</h2>
          <p class="muted">The Admin link is hidden for you, but hiding a link protects nothing. What protects the data is the API.</p>
          <button type="button" class="btn" (click)="callAdminApi()" [disabled]="probe()?.pending">GET /api/admin/summary</button>
          @if (probe(); as p) {
            @if (!p.pending) { <p role="status" [class.error]="!p.ok" [class.muted]="p.ok">{{ p.text }}</p> }
          }
        </div>
      }
    </section>
    }
  `,
  styleUrl: './auth.scss',
})
export class AccountPage {
  private readonly auth = inject(AuthService);
  protected readonly session = inject(Session);
  protected readonly roles = ROLES;

  // What the SERVER thinks, read from the token on GET /api/auth/me
  protected readonly serverView = toSignal(
    this.auth.me().pipe(
      map((me) => `${me.name} (${me.roles.join(', ')})`),
      catchError((e: ApiError) => of(e.message)),
    ),
    { initialValue: 'checking…' },
  );

  protected readonly probe = signal<{ pending: boolean; ok?: boolean; text?: string } | null>(null);

  protected callAdminApi(): void {
    this.probe.set({ pending: true });
    this.auth.adminSummary().subscribe({
      next: (s) => this.probe.set({ pending: false, ok: true, text: `200 OK: ${s.products} products, ${s.contacts} contacts` }),
      error: (e: ApiError) => this.probe.set({ pending: false, ok: false, text: `${e.status}: ${e.message}` }),
    });
  }
}
