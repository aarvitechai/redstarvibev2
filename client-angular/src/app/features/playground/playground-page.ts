import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Counter } from './counter';
import { KeysDemo } from './keys-demo';

// Phase 3 learning demos. Phase 7 moves this to its own route.
@Component({
  selector: 'app-playground-page',
  imports: [Counter, KeysDemo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="playground">
      <h2>Playground</h2>
      <h3>Counter: signals</h3>
      <app-counter />
      <h3>Tracking: $index vs id</h3>
      <app-keys-demo />
    </section>
  `,
})
export class PlaygroundPage {}
