import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NetworkActivity } from '../http/interceptors';

// A global loading indicator fed by the activity interceptor. No component reports its own requests.
@Component({
  selector: 'app-activity-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (activity.busy()) {
      <div class="activity" role="progressbar"
           [attr.aria-label]="activity.pending() + ' request' + (activity.pending() === 1 ? '' : 's') + ' in progress'"></div>
    }
  `,
  styles: `
    .activity {
      position: fixed; inset: 0 0 auto 0; height: 3px; z-index: 10; overflow: hidden;
      background: linear-gradient(90deg, transparent, var(--primary), transparent);
      background-size: 50% 100%; background-repeat: no-repeat;
      animation: slide 1s linear infinite;
    }
    @keyframes slide { from { background-position: -50% 0; } to { background-position: 150% 0; } }
    @media (prefers-reduced-motion: reduce) { .activity { animation: none; background: var(--primary); } }
  `,
})
export class ActivityBar {
  protected readonly activity = inject(NetworkActivity);
}
