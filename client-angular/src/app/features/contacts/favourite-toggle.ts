import { ChangeDetectionStrategy, Component, forwardRef, input, model, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

// A CUSTOM FORM CONTROL. It's a button, not an <input>, so Reactive Forms can't use it until it implements
// ControlValueAccessor: the Angular version of react-hook-form's <Controller> bridge.
//   writeValue        form -> component  (set the value)
//   registerOnChange  component -> form  (report changes)
//   registerOnTouched component -> form  (report blur, for "touched")
// It ALSO works without a form, through two-way [(value)] binding (model()), which the contact list uses.
@Component({
  selector: 'app-favourite-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => FavouriteToggle), multi: true }],
  template: `
    <button type="button" role="switch" [attr.aria-checked]="value()" [attr.aria-label]="label()"
            [class.on]="value()" [disabled]="disabled() || formDisabled()" (click)="toggle()" (blur)="onTouched()">
      {{ value() ? '★' : '☆' }}
    </button>
  `,
  styles: `
    button { font-size: 1.25rem; line-height: 1; background: none; border: 0; cursor: pointer; padding: 4px; color: var(--muted); }
    button.on { color: #e0a800; }
    button:disabled { cursor: not-allowed; opacity: 0.5; }
  `,
})
export class FavouriteToggle implements ControlValueAccessor {
  readonly value = model(false);
  readonly label = input('Favourite');
  readonly disabled = input(false);
  protected readonly formDisabled = signal(false);

  private onChange: (value: boolean) => void = () => {};
  protected onTouched: () => void = () => {};

  protected toggle(): void {
    this.value.update((v) => !v); // also emits (valueChange) for [(value)] users
    this.onChange(this.value());
  }

  writeValue(value: boolean | null): void {
    this.value.set(!!value);
  }
  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }
}
