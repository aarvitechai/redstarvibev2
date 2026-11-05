import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

// 403: logged in, but not allowed. Different from 401 (not logged in), which goes to /login instead.
@Component({
  selector: 'app-unauthorized-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="login" aria-labelledby="forbidden-title">
      <p class="code">403</p>
      <h1 id="forbidden-title">You don't have access to this page</h1>
      <p class="muted">
        @if (from()) { Your account can't open <code>{{ from() }}</code>. } @else { Your account does not have the required role. }
      </p>
      <a class="primary-link" routerLink="/">Go home</a>
    </section>
  `,
  styleUrl: './auth.scss',
})
export class UnauthorizedPage {
  readonly from = input<string>(); // ?from=/admin, set by roleGuard
}
