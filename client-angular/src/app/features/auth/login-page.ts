import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, safeRedirect } from '../../core/auth/auth';
import { Session } from '../../core/auth/session';
import { ApiError } from '../../core/http/api';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="login" aria-labelledby="login-title">
      <h1 id="login-title">Log in</h1>
      @if (session.logoutReason() === 'expired') {
        <p role="status" class="muted">Your session has expired. Please log in again.</p>
      } @else if (target() !== '/') {
        <p role="status" class="muted">Log in to continue to <code>{{ target() }}</code>.</p>
      }

      <form class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate aria-label="Log in">
        <div class="field">
          <label for="login-email">Email</label>
          <input id="login-email" type="email" formControlName="email" autocomplete="username" />
        </div>
        <div class="field">
          <label for="login-password">Password</label>
          <input id="login-password" type="password" formControlName="password" autocomplete="current-password" />
        </div>
        @if (error()) { <p role="alert" class="form-error">{{ error() }}</p> }
        <button type="submit" class="primary" [disabled]="pending()">{{ pending() ? 'Logging in…' : 'Log in' }}</button>
      </form>

      <p class="muted">New here? <a routerLink="/register" [queryParams]="{ returnUrl: returnUrl() ?? null }">Create an account</a></p>

      <details class="demo">
        <summary>Demo accounts (development only)</summary>
        <ul>
          <li><strong>Admin:</strong> <code>admin&#64;redstar.dev</code> / <code>Admin&#64;123</code></li>
          <li><strong>Customer:</strong> <code>asha&#64;redstar.dev</code> / <code>Customer&#64;123</code></li>
        </ul>
      </details>
    </section>
  `,
  styleUrl: './auth.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly session = inject(Session);

  // ?returnUrl=/account, bound by withComponentInputBinding (set by the guards)
  readonly returnUrl = input<string>();
  protected readonly target = computed(() => safeRedirect(this.returnUrl()));

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid) {
      this.error.set('Enter your email and password.');
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.pending.set(true);
    this.error.set(null);
    this.auth.login(email.trim(), password).subscribe({
      // replaceUrl: Back from the target page shouldn't land on /login again
      next: () => this.router.navigateByUrl(this.target(), { replaceUrl: true }),
      error: (e: ApiError) => {
        this.pending.set(false);
        this.error.set(e.message);
        this.form.controls.password.reset(); // clear the password after a failed attempt
      },
    });
  }
}
