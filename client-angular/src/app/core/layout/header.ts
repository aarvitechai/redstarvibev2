import { ChangeDetectionStrategy, Component, input } from '@angular/core';

// input() = the Angular version of React props: a read-only signal set by the parent
@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="header">
      <div class="inner">
        <span class="brand">{{ appName() }}</span>
        <nav aria-label="Main">
          <!-- Plain link for now; routerLink replaces it in Phase 7 -->
          <a class="nav-link" href="#students">Students</a>
        </nav>
      </div>
    </header>
  `,
  styleUrl: './layout.scss',
})
export class Header {
  readonly appName = input.required<string>();
}
