import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

// Used by the catch-all '**' route, and by pages whose data doesn't exist (e.g. /products/999)
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="not-found" aria-labelledby="not-found-title">
      <p class="code">404</p>
      <h1 id="not-found-title">{{ heading() }}</h1>
      <p class="muted">
        @if (message()) { {{ message() }} } @else { Nothing lives at <code>{{ path }}</code>. }
      </p>
      <div class="actions">
        <button type="button" class="btn" (click)="location.back()">Go back</button>
        <a class="primary-link" routerLink="/">Go home</a>
      </div>
    </section>
  `,
  styles: `
    .not-found { text-align: center; padding: 48px 0; display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .code { font-size: 4rem; font-weight: 800; line-height: 1; color: var(--primary); margin: 0; }
    h1 { margin: 0; }
    .muted { color: var(--muted); }
    .actions { display: flex; gap: 8px; }
    .btn, .primary-link {
      font: inherit; font-size: 0.875rem; padding: 6px 12px; border-radius: 8px; cursor: pointer; text-decoration: none;
      border: 1px solid var(--border); background: var(--surface); color: var(--text);
    }
    .primary-link { background: var(--primary); color: var(--primary-contrast); border-color: var(--primary); }
  `,
})
export class NotFound {
  // As a ROUTED component (the '**' route), withComponentInputBinding sets every input that has no matching
  // route param to undefined, which wipes a default like input('Page not found'). So apply the default here.
  readonly title = input<string>();
  readonly message = input<string>();
  protected readonly heading = computed(() => this.title() ?? 'Page not found');
  protected readonly location = inject(Location);
  protected readonly path = inject(Router).url.split('?')[0];
}
