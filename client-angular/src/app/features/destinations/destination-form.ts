import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { ApiError } from '../../core/http/api';
import { Destination, SaveDestination } from './destinations-api';

let formCount = 0;

// Add AND edit. The parent passes `save` (returns an Observable) so this form can show the server's field errors.
@Component({
  selector: 'app-destination-form',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate [attr.aria-label]="label()">
      <div class="field">
        <label [for]="id + 'name'">Name</label>
        <input [id]="id + 'name'" formControlName="name" [attr.aria-invalid]="error('name') ? true : null" />
        @if (error('name'); as e) { <small class="field-error" role="alert">{{ e }}</small> }
      </div>
      <div class="field">
        <label [for]="id + 'country'">Country</label>
        <input [id]="id + 'country'" formControlName="country" [attr.aria-invalid]="error('country') ? true : null" />
        @if (error('country'); as e) { <small class="field-error" role="alert">{{ e }}</small> }
      </div>
      <div class="field">
        <label [for]="id + 'desc'">Description</label>
        <input [id]="id + 'desc'" formControlName="description" />
      </div>
      <div class="field">
        <label [for]="id + 'rating'">Rating</label>
        <select [id]="id + 'rating'" formControlName="rating">
          @for (r of [5, 4, 3, 2, 1]; track r) { <option [ngValue]="r">{{ '★'.repeat(r) }}</option> }
        </select>
      </div>
      @if (formError()) { <p role="alert" class="form-error">{{ formError() }}</p> }
      <div class="actions">
        <button type="submit" class="primary" [disabled]="saving()">{{ saving() ? 'Saving…' : submitLabel() }}</button>
        @if (cancellable()) { <button type="button" class="btn" (click)="cancelled.emit()">Cancel</button> }
      </div>
    </form>
  `,
  styleUrl: './destinations.scss',
})
export class DestinationForm implements OnInit {
  readonly label = input.required<string>();
  readonly submitLabel = input.required<string>();
  readonly initial = input<Destination | null>(null);
  readonly cancellable = input(false);
  readonly save = input.required<(body: SaveDestination) => Observable<unknown>>();
  readonly saved = output<void>();
  readonly cancelled = output<void>();

  protected readonly id = `dest-${++formCount}-`;
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    country: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    description: ['', Validators.maxLength(500)],
    rating: [4],
  });
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly formError = signal<string | null>(null);

  ngOnInit(): void {
    const d = this.initial();
    if (d) this.form.reset({ name: d.name, country: d.country, description: d.description, rating: d.rating });
  }

  protected error(field: 'name' | 'country'): string | null {
    const c = this.form.controls[field];
    if (!c.errors || !(c.touched || this.submitted())) return null;
    if (c.errors['server']) return c.errors['server'] as string;
    return field === 'name' ? 'Name must be 2 to 80 characters.' : 'Country must be 2 to 60 characters.';
  }

  protected submit(): void {
    this.submitted.set(true);
    this.formError.set(null);
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.save()({ ...v, name: v.name.trim(), country: v.country.trim(), description: v.description.trim(), isVisited: this.initial()?.isVisited ?? false })
      .subscribe({
        next: () => {
          this.saving.set(false);
          if (!this.initial()) {
            this.form.reset();
            this.submitted.set(false);
          }
          this.saved.emit();
        },
        error: (e: ApiError) => {
          this.saving.set(false);
          const field = e.fieldErrors ? Object.keys(e.fieldErrors)[0] : null;
          const control = field ? this.form.get(field) : null;
          if (control && e.fieldErrors) control.setErrors({ server: e.fieldErrors[field!][0] });
          else this.formError.set(e.message);
        },
      });
  }
}
