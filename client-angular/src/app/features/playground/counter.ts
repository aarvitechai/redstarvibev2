import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, signal } from '@angular/core';

// HTML min/max attributes DON'T limit what ends up in state; enforce the range in code.
const clampStep = (raw: string): number => Math.min(10, Math.max(1, Math.trunc(Number(raw)) || 1));

// Signals vs React state.
// React: setCount(count + 1) x3 adds 1, because `count` is a stale snapshot inside the handler.
// Angular: count.set(count() + 1) x3 adds 3, because a signal is updated SYNCHRONOUSLY and count() reads the new value.
// update(fn) is still preferred: it states "derive from the current value" clearly.
@Component({
  selector: 'app-counter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="counter">
      <output class="value" aria-label="count">{{ count() }}</output>
      <p class="hint">{{ parity() }}@if (count() >= 10) { · double digits! }</p>

      <div class="row">
        <button type="button" (click)="count.update(c => c - step())" [disabled]="count() - step() < min()">− {{ step() }}</button>
        <button type="button" (click)="count.update(c => c + step())">+ {{ step() }}</button>
        <button type="button" (click)="count.set(initial())">Reset</button>
      </div>

      <label class="row">Step
        <input type="number" min="1" max="10" [value]="step()" (input)="setStep($event)" />
      </label>

      <div class="row">
        <button type="button" (click)="addThreeWithSet()">+3 (set, works in Angular)</button>
        <button type="button" (click)="addThreeWithUpdate()">+3 (update)</button>
      </div>
    </div>
  `,
  styles: `
    .counter {
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 16px; display: flex; flex-direction: column; gap: 12px; max-width: 360px;
    }
    .value { font-size: 2.5rem; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
    .hint { margin: 0; color: var(--muted); }
    .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .row input { width: 72px; }
  `,
})
export class Counter {
  readonly initial = input(0);
  readonly min = input(0);

  // linkedSignal: WRITABLE state that starts from (and resets when) the `initial` input changes
  protected readonly count = linkedSignal(() => this.initial());
  protected readonly step = signal(1);
  protected readonly parity = computed(() => (this.count() % 2 === 0 ? 'Even' : 'Odd'));

  protected setStep(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.step.set(clampStep(input.value));
    input.value = String(this.step()); // keep the box in sync when the value was clamped
  }

  protected addThreeWithSet(): void {
    this.count.set(this.count() + 1);
    this.count.set(this.count() + 1);
    this.count.set(this.count() + 1);
  }

  protected addThreeWithUpdate(): void {
    for (let i = 0; i < 3; i++) this.count.update((c) => c + 1);
  }
}
