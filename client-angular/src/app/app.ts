import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Session } from './core/auth/session';
import { Layout } from './core/layout/layout';

// The app is the shell; the router decides which page goes in its <router-outlet>
@Component({
  selector: 'app-root',
  imports: [Layout],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-layout appName="RedStarVibe" />`,
})
export class App {
  constructor() {
    // Angular guards run only on NAVIGATION. After a logout or token expiry, re-run the current navigation,
    // so a guarded page (/account, /admin) redirects to /login. React's <ProtectedRoute> just re-renders.
    const router = inject(Router);
    inject(Session)
      .loggedOut$.pipe(takeUntilDestroyed())
      .subscribe(() => router.navigateByUrl(router.url, { onSameUrlNavigation: 'reload', replaceUrl: true }));
  }
}
