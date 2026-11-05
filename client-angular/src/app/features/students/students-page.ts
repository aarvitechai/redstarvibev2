import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StudentList } from './student-list';
import { STUDENTS } from './students.data';

@Component({
  selector: 'app-students-page',
  imports: [StudentList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="students">
      <h1>Students</h1>
      <p>{{ activeCount }} of {{ students.length }} active</p>
      <app-student-list [students]="students" />
    </section>
  `,
})
export class StudentsPage {
  protected readonly students = STUDENTS;
  protected readonly activeCount = STUDENTS.filter((s) => s.isActive).length; // derived, not stored separately
}
