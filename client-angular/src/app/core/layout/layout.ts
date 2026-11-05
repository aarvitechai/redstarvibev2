import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ActivityBar } from './activity-bar';
import { Footer } from './footer';
import { Header } from './header';

// The app shell. <router-outlet /> is where the matched route's component appears (React's <Outlet />).
// Navigating swaps only the outlet; the header, footer and theme stay put.
@Component({
  selector: 'app-layout',
  imports: [ActivityBar, Header, Footer, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell">
      <app-activity-bar />
      <app-header [appName]="appName()" />
      <main class="main"><router-outlet /></main>
      <app-footer [appName]="appName()" />
    </div>
  `,
  styleUrl: './layout.scss',
})
export class Layout {
  readonly appName = input('RedStarVibe'); // an input with a default value
}
