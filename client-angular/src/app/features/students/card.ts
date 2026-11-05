import { ChangeDetectionStrategy, Component } from '@angular/core';

// A generic box: projects any content, like the React <Card>{children}</Card>
@Component({
  selector: 'app-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  styles: `
    :host {
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
      box-shadow: var(--shadow); padding: 16px; display: flex; flex-direction: column; gap: 12px; height: 100%;
    }
  `,
  host: { role: 'article' },
})
export class Card {}
