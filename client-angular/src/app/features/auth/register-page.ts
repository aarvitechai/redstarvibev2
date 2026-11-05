import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, safeRedirect } from '../../core/auth/auth';
import { ApiError } from '../../core/http/api';

// A CROSS-FIELD validator on the FormGroup: it compares two controls, so it can't sit on either one alone
const passwordsMatch = (group: AbstractControl): ValidationErrors | null =>
  group.get('password')?.value === group.get('confirm')?.value ? null : { mismatch: true };

// Phase 12: create an account. The API makes every new account a Customer and signs it in straight away.
@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="login" aria-labelledby="register-title">
      <h1 id="register-title">Create an account</h1>
      <form class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate aria-label="Create account">
        @for (f of fields; track f.name) {
          <div class="field">
            <label [for]="'reg-' + f.name">{{ f.label }}</label>
            <input [id]="'reg-' + f.name" [type]="f.type" [formControlName]="f.name" [attr.autocomplete]="f.autocomplete" />
            @if (errorFor(f.name); as e) { <small class="form-error" role="alert">{{ e }}</small> }
          </div>
        }
        @if (formError()) { <p role="alert" class="form-error">{{ formError() }}</p> }
        <button type="submit" class="primary" [disabled]="pending()">{{ pending() ? 'Creating…' : 'Create account' }}</button>
      </form>
      <p class="muted">Already have an account? <a routerLink="/login">Log in</a></p>
    </section>
  `,
  styleUrl: './auth.scss',
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly returnUrl = input<string>();
  private readonly target = computed(() => safeRedirect(this.returnUrl()));

  protected readonly fields = [
    { name: 'name', label: 'Name', type: 'text', autocomplete: 'name' },
    { name: 'email', label: 'Email', type: 'email', autocomplete: 'email' },
    { name: 'password', label: 'Password', type: 'password', autocomplete: 'new-password' },
    { name: 'confirm', label: 'Confirm password', type: 'password', autocomplete: 'new-password' },
  ] as const;

  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: [''],
    },
    { validators: passwordsMatch },
  );
  protected readonly pending = signal(false);
  protected readonly submitted = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected errorFor(field: 'name' | 'email' | 'password' | 'confirm'): string | null {
    if (!this.submitted()) return null;
    const c = this.form.controls[field];
    if (c.errors?.['server']) return c.errors['server'] as string;
    if (field === 'confirm') return this.form.errors?.['mismatch'] ? 'The passwords do not match.' : null;
    if (!c.errors) return null;
    return {
      name: 'Name must be 2 to 100 characters.',
      email: 'Enter a valid email address.',
      password: 'Password must be at least 8 characters.',
    }[field];
  }

  protected submit(): void {
    this.submitted.set(true);
    this.formError.set(null);
    if (this.form.invalid) return; // client checks first: no request for input we know is bad

    const { name, email, password } = this.form.getRawValue();
    this.pending.set(true);
    this.auth.register(name.trim(), email.trim(), password).subscribe({
      next: () => this.router.navigateByUrl(this.target(), { replaceUrl: true }),
      error: (e: ApiError) => {
        this.pending.set(false);
        const entries = Object.entries(e.fieldErrors ?? {});
        if (entries.length === 0) this.formError.set(e.message);
        for (const [field, messages] of entries) this.form.get(field)?.setErrors({ server: messages.join(' ') });
      },
    });
  }
}
