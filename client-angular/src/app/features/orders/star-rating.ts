import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

let groupCount = 0;

// An ACCESSIBLE star rating: radio buttons styled as stars (keyboard: Tab in, then the arrow keys)
@Component({
  selector: 'app-star-rating',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="stars" [disabled]="disabled()">
      <legend class="sr-only">{{ label() }}</legend>
      @for (n of [1, 2, 3, 4, 5]; track n) {
        <label [class.on]="n <= (value() ?? 0)">
          <input type="radio" class="sr-only" [name]="name" [value]="n" [checked]="value() === n" (change)="rated.emit(n)" />
          <span aria-hidden="true">★</span>
          <span class="sr-only">{{ n }} star{{ n === 1 ? '' : 's' }}</span>
        </label>
      }
    </fieldset>
  `,
  styles: `
    .stars { border: 0; margin: 0; padding: 0; display: inline-flex; gap: 2px; }
    label { cursor: pointer; font-size: 1.125rem; line-height: 1; color: var(--border); }
    label.on { color: #e0a800; }
    label:focus-within { outline: 2px solid var(--primary); border-radius: 4px; }
    .stars:disabled label { cursor: wait; opacity: 0.6; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }
  `,
})
export class StarRating {
  readonly value = input<number | null>(null);
  readonly label = input.required<string>();
  readonly disabled = input(false);
  readonly rated = output<number>();
  protected readonly name = `stars-${++groupCount}`;
}
