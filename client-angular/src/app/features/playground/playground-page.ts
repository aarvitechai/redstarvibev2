import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Counter } from './counter';
import { KeysDemo } from './keys-demo';
import { Timer } from './timer';

// Phase 3 and 4 learning demos, at /playground.
@Component({
  selector: 'app-playground-page',
  imports: [Counter, KeysDemo, Timer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section>
      <h1>Playground</h1>
      <h3>Counter: signals</h3>
      <app-counter />
      <h3>Tracking: $index vs id</h3>
      <app-keys-demo />
      <h3>Timer: effect() cleanup</h3>
      <app-timer />
    </section>
  `,
})
export class PlaygroundPage {}
