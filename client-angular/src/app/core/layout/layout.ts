import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Footer } from './footer';
import { Header } from './header';

// Composition: <ng-content /> is Angular's version of React's {children}.
// Whatever goes between <app-layout> ... </app-layout> is "projected" here.
// Phase 7 replaces it with <router-outlet />.
@Component({
  selector: 'app-layout',
  imports: [Header, Footer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell">
      <app-header [appName]="appName()" />
      <main class="main"><ng-content /></main>
      <app-footer [appName]="appName()" />
    </div>
  `,
  styleUrl: './layout.scss',
})
export class Layout {
  readonly appName = input('RedStarVibe'); // an input with a default value
}
