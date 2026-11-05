import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { ApiError } from '../../core/http/api';
import { contactValidators, firstError } from './contact-validators';
import { Contact, ContactPayload } from './contacts-api';
import { FavouriteToggle } from './favourite-toggle';

let formCount = 0;

// REACTIVE FORMS: the form model lives in TypeScript (FormGroup), and the template only binds to it.
// One component handles both "add" (no contact) and "edit" (contact given).
// The parent passes a `save` function that returns an Observable, so this form can show the
// server's field errors when the request fails.
@Component({
  selector: 'app-contact-form',
  imports: [ReactiveFormsModule, FavouriteToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contact-form.html',
  styleUrl: './contacts.scss',
})
export class ContactForm implements OnInit {
  readonly contact = input<Contact | null>(null);
  readonly save = input.required<(payload: ContactPayload) => Observable<unknown>>();
  readonly cancelled = output<void>();
  readonly saved = output<void>();

  private readonly fb = inject(FormBuilder).nonNullable; // nonNullable: reset() goes back to the initial values, not null

  protected readonly form = this.fb.group({
    name: ['', contactValidators.name],
    email: ['', contactValidators.email],
    phone: ['', contactValidators.phone],
    isFavourite: [false],
  });

  protected readonly fields = [
    { name: 'name', label: 'Name', type: 'text', hint: '' },
    { name: 'email', label: 'Email', type: 'email', hint: '' },
    { name: 'phone', label: 'Phone', type: 'tel', hint: 'Optional' },
  ] as const;
  // Unique ids per form instance, so labels never point at another form's inputs
  protected readonly idPrefix = `contact-${++formCount}-`;

  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly formError = signal<string | null>(null);

  ngOnInit(): void {
    const c = this.contact();
    if (c) this.form.reset({ name: c.name, email: c.email, phone: c.phone ?? '', isFavourite: c.isFavourite });
  }

  protected get isEdit(): boolean {
    return this.contact() !== null;
  }

  // Show a field's error once the user has left it, or after they tried to submit
  protected errorFor(field: 'name' | 'email' | 'phone'): string | null {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || this.submitted()) ? firstError(control) : null;
  }

  protected submit(): void {
    this.submitted.set(true);
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return; // no request for input we already know is bad
    }

    const v = this.form.getRawValue();
    const payload: ContactPayload = {
      name: v.name.trim(),
      email: v.email.trim(),
      phone: v.phone.trim() || null,
      isFavourite: v.isFavourite,
    };

    this.submitting.set(true);
    this.form.disable({ emitEvent: false }); // block edits while saving
    this.save()(payload).subscribe({
      next: () => {
        this.finish();
        if (!this.isEdit) {
          this.form.reset();
          this.submitted.set(false);
        }
        this.saved.emit();
      },
      error: (error: ApiError) => {
        this.finish();
        this.showServerErrors(error);
      },
    });
  }

  private finish(): void {
    this.submitting.set(false);
    this.form.enable({ emitEvent: false });
  }

  // Put each server message on its control. It clears when the user edits that control.
  private showServerErrors(error: ApiError): void {
    if (!error.fieldErrors) {
      this.formError.set(error.message);
      return;
    }
    for (const [field, messages] of Object.entries(error.fieldErrors)) {
      const control = this.form.get(field);
      if (control) {
        control.setErrors({ server: messages[0] });
        control.markAsTouched();
      } else {
        this.formError.set(messages[0]);
      }
    }
  }
}
