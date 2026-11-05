import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="footer">
      <div class="inner">© {{ year }} {{ appName() }}</div>
    </footer>
  `,
  styleUrl: './layout.scss',
})
export class Footer {
  readonly appName = input.required<string>();
  protected readonly year = new Date().getFullYear(); // computed once per instance, not on every render
}
