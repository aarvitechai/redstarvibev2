import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ThemeService } from '../theme/theme.service';

// No inputs: the toggle injects the shared service directly (like useContext)
@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="theme-toggle" (click)="themes.toggle()" [attr.aria-label]="'Switch to ' + next() + ' theme'">
      {{ themes.theme() === 'dark' ? '☀️' : '🌙' }}
    </button>
  `,
  styles: `
    .theme-toggle {
      font: inherit; line-height: 1; padding: 6px 8px; border-radius: 8px; cursor: pointer;
      border: 1px solid var(--border); background: var(--surface);
    }
  `,
})
export class ThemeToggle {
  protected readonly themes = inject(ThemeService);
  protected readonly next = computed(() => (this.themes.theme() === 'dark' ? 'light' : 'dark'));
}
