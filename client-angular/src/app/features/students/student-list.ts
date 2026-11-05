import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { StudentCard } from './student-card';
import { Student } from './student.model';

// @for ... track s.id  ==  React's  .map(s => <X key={s.id} />)
// track is REQUIRED in Angular. Always use a stable id, never $index, for dynamic lists.
@Component({
  selector: 'app-student-list',
  imports: [StudentCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (students().length > 0) {
      <ul class="grid">
        @for (s of students(); track s.id) {
          <li><app-student-card [student]="s" /></li>
        }
      </ul>
    } @else {
      <p class="empty">No students yet.</p>
    }
  `,
  styles: `
    .grid {
      list-style: none; margin: 0; padding: 0;
      display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    }
    .empty { color: var(--muted); }
  `,
})
export class StudentList {
  readonly students = input.required<readonly Student[]>();
}
