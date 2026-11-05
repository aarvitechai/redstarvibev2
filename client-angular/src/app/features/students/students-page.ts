import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { AddStudentForm } from './add-student-form';
import { StudentList } from './student-list';
import { StudentStats } from './student-stats';
import { STUDENTS } from './students.data';
import {
  StudentsAction,
  studentAdded,
  studentRemoved,
  studentsReducer,
  studentToggled,
} from './students.state';

// LIFTING STATE UP: the form, the stats and the list are siblings, so the state lives here, in their parent.
// Data goes down via [inputs]; changes come up via (outputs) and pass through ONE reducer.
@Component({
  selector: 'app-students-page',
  imports: [StudentList, StudentStats, AddStudentForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="students">
      <h1>Students</h1>
      <app-student-stats [students]="students()" />

      <app-add-student-form (added)="dispatch(studentAdded($event))" />

      <label>
        <input type="checkbox" [checked]="activeOnly()" (change)="activeOnly.set($any($event.target).checked)" />
        Show active only
      </label>

      <app-student-list
        [students]="visible()"
        [editable]="true"
        [emptyMessage]="activeOnly() ? 'No active students.' : 'No students yet.'"
        (toggled)="dispatch(studentToggled($event))"
        (removed)="dispatch(studentRemoved($event))"
      />
    </section>
  `,
})
export class StudentsPage {
  protected readonly students = signal(STUDENTS);
  protected readonly activeOnly = signal(false);

  // DERIVED state: never stored separately, so it can never get out of sync
  protected readonly visible = computed(() =>
    this.activeOnly() ? this.students().filter((s) => s.isActive) : this.students(),
  );

  protected readonly studentAdded = studentAdded;
  protected readonly studentToggled = studentToggled;
  protected readonly studentRemoved = studentRemoved;

  // The Angular version of useReducer's dispatch
  protected dispatch(action: StudentsAction): void {
    this.students.update((s) => studentsReducer(s, action));
  }
}
