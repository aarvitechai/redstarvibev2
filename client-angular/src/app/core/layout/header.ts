import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CartStore } from '../../features/cart/cart-store';
import { ROLES } from '../auth/auth';
import { Session } from '../auth/session';
import { ThemeToggle } from './theme-toggle';

// input() = the Angular version of React props: a read-only signal set by the parent
@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, ThemeToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="header">
      <div class="inner">
        <a class="brand" routerLink="/">{{ appName() }}</a>
        <nav aria-label="Main">
          <!-- routerLink navigates WITHOUT a page reload. routerLinkActive adds the class when the URL matches,
               and ariaCurrentWhenActive sets aria-current="page" for screen readers. -->
          <!-- Role-based UI: show only the links this user can use. A convenience: the API still checks every call. -->
          @for (link of links(); track link.path) {
            <a class="nav-link" [routerLink]="link.path" routerLinkActive="active" ariaCurrentWhenActive="page">{{ link.label }}</a>
          }
          <a class="nav-link" routerLink="/cart" routerLinkActive="active" ariaCurrentWhenActive="page"
             [attr.aria-label]="'Cart, ' + cart.count() + ' item' + (cart.count() === 1 ? '' : 's')">
            Cart@if (cart.count() > 0) { <span class="badge">{{ cart.count() }}</span> }
          </a>
          @if (session.user(); as u) {
            <button type="button" class="nav-button" (click)="session.logout()">Log out ({{ firstName(u.name) }})</button>
          } @else {
            <a class="nav-link" routerLink="/login" routerLinkActive="active" ariaCurrentWhenActive="page">Log in</a>
          }
          <app-theme-toggle />
        </nav>
      </div>
    </header>
  `,
  styleUrl: './layout.scss',
})
export class Header {
  readonly appName = input.required<string>();
  protected readonly session = inject(Session);
  protected readonly cart = inject(CartStore);
  protected readonly firstName = (name: string) => name.split(' ')[0];
  private readonly baseLinks = [
    { path: '/products', label: 'Products' },
    { path: '/destinations', label: 'Destinations' },
    { path: '/students', label: 'Students' },
    { path: '/directory', label: 'Directory' },
    { path: '/contacts', label: 'Contacts' },
    { path: '/playground', label: 'Playground' },
  ];
  protected readonly links = computed(() => [
    ...this.baseLinks,
    ...(this.session.hasRole(ROLES.customer) ? [{ path: '/orders', label: 'My orders' }] : []),
    ...(this.session.isAuthenticated() ? [{ path: '/account', label: 'Account' }] : []),
    ...(this.session.hasRole(ROLES.admin) ? [{ path: '/admin', label: 'Admin' }] : []),
  ]);
}
