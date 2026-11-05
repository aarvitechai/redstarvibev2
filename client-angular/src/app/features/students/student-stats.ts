import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Student } from './student.model';

// A SIBLING of the list and the form. It has no state of its own: it reads the lifted state through an input.
// computed() recalculates only when students() changes.
@Component({
  selector: 'app-student-stats',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="stats" aria-live="polite">
      <strong>{{ students().length }}</strong> students · <strong>{{ active() }}</strong> active ·
      <strong>{{ students().length - active() }}</strong> inactive
    </p>
  `,
  styles: `
    .stats { color: var(--muted); }
    .stats strong { color: var(--text); }
  `,
})
export class StudentStats {
  readonly students = input.required<readonly Student[]>();
  protected readonly active = computed(() => this.students().filter((s) => s.isActive).length);
}
