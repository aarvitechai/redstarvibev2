import { ChangeDetectionStrategy, Component, effect, signal } from '@angular/core';

// A stopwatch: effect() WITH CLEANUP (the same shape as React's useEffect + return () => ...).
// The effect re-runs when running() changes. onCleanup runs before the next run AND when the component
// is destroyed, so the interval can never leak.
@Component({
  selector: 'app-timer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="counter">
      <output class="value" aria-label="seconds">{{ seconds() }}s</output>
      <div class="row">
        <button type="button" (click)="running.update(r => !r)">{{ running() ? 'Stop' : 'Start' }}</button>
        <button type="button" (click)="seconds.set(0)" [disabled]="seconds() === 0">Reset</button>
      </div>
    </div>
  `,
  styles: `
    .counter {
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 16px; display: flex; flex-direction: column; gap: 12px; max-width: 360px;
    }
    .value { font-size: 2.5rem; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
    .row { display: flex; gap: 8px; }
  `,
})
export class Timer {
  protected readonly seconds = signal(0);
  protected readonly running = signal(false);

  constructor() {
    effect((onCleanup) => {
      if (!this.running()) return;
      const id = setInterval(() => this.seconds.update((s) => s + 1), 1000);
      onCleanup(() => clearInterval(id));
    });
  }
}
