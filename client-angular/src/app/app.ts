import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Layout } from './core/layout/layout';

// Phase 7: the app is the shell; the router decides which page goes in its <router-outlet>
@Component({
  selector: 'app-root',
  imports: [Layout],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-layout appName="RedStarVibe" />`,
})
export class App {}
