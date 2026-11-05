import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

// The admin area's own nested layout. Every admin page is lazy-loaded (app.routes.ts): customers never download them.
@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-layout">
      <nav aria-label="Admin" class="admin-nav">
        <a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">Overview</a>
        <a routerLink="/admin/products" routerLinkActive="active" ariaCurrentWhenActive="page">Products</a>
        <a routerLink="/admin/orders" routerLinkActive="active" ariaCurrentWhenActive="page">Orders</a>
      </nav>
      <div class="admin-content"><router-outlet /></div>
    </div>
  `,
  styleUrl: './admin.scss',
})
export class AdminLayout {}
