import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { getInitials } from '../../shared/utils/format';

@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="avatar" aria-hidden="true">{{ initials() }}</span>`,
  styles: `
    .avatar {
      width: 44px; height: 44px; border-radius: 50%;
      display: grid; place-items: center; font-weight: 700;
      background: var(--primary); color: var(--primary-contrast);
    }
    :host { flex: none; }
  `,
})
export class Avatar {
  readonly name = input.required<string>();
  // computed() = derived value. It recalculates only when name() changes (like useMemo, but automatic).
  protected readonly initials = computed(() => getInitials(this.name()));
}
