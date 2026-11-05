import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// CLIENT validation = instant feedback (UX) only. The API validates again; keep the rules and messages in line with
// server/Server.Api/Models/Dto/ContactDtos.cs (and client-react/src/utility/contactValidation.js).

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_PATTERN = /^[0-9+()\-\s]{7,20}$/;

// A CUSTOM VALIDATOR is a function: (control) => null when valid, or an errors object.
// The error object's VALUE here is the message, so the template can show it directly.
const rule =
  (test: (value: string) => string | null): ValidatorFn =>
  (control: AbstractControl<string | null>): ValidationErrors | null => {
    const message = test((control.value ?? '').trim());
    return message ? { rule: message } : null;
  };

export const contactValidators = {
  name: rule((v) => {
    if (!v) return 'Name is required.';
    if (v.length < 2 || v.length > 100) return 'Name must be 2 to 100 characters.';
    return null;
  }),
  email: rule((v) => {
    if (!v) return 'Email is required.';
    if (!EMAIL_PATTERN.test(v)) return 'Enter a valid email address.';
    if (v.length > 200) return 'Email must be at most 200 characters.';
    return null;
  }),
  phone: rule((v) =>
    v && !PHONE_PATTERN.test(v) ? 'Phone may contain digits, spaces, + ( ) - and be 7 to 20 characters.' : null,
  ),
};

// The one message to show for a control: our rule's message, or a server message set with setErrors({ server })
export function firstError(control: AbstractControl): string | null {
  const errors = control.errors;
  if (!errors) return null;
  return (errors['server'] as string) ?? (errors['rule'] as string) ?? 'Invalid value.';
}
