import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
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
          @for (link of links; track link.path) {
            <a class="nav-link" [routerLink]="link.path" routerLinkActive="active" ariaCurrentWhenActive="page">{{ link.label }}</a>
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
  protected readonly links = [
    { path: '/products', label: 'Products' },
    { path: '/students', label: 'Students' },
    { path: '/directory', label: 'Directory' },
    { path: '/contacts', label: 'Contacts' },
    { path: '/playground', label: 'Playground' },
  ];
}
