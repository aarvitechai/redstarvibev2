import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Avatar } from './avatar';
import { Card } from './card';
import { Student } from './student.model';

// input.required<Student>(): the parent MUST pass [student], or the compiler reports an error.
// Inputs are read-only signals, so you can't assign to them. Data flows down, as with React props.
@Component({
  selector: 'app-student-card',
  imports: [Card, Avatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './student-card.html',
  styleUrl: './student-card.scss',
})
export class StudentCard {
  readonly student = input.required<Student>();
}
