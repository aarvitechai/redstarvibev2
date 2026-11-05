import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Avatar } from './avatar';
import { Card } from './card';
import { Student } from './student.model';

// Data flows DOWN through input(); events flow UP through output().
// The parent listens with (toggled)="..." and decides what changes. The card never changes the student itself.
@Component({
  selector: 'app-student-card',
  imports: [Card, Avatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './student-card.html',
  styleUrl: './student-card.scss',
})
export class StudentCard {
  readonly student = input.required<Student>();
  readonly editable = input(false); // show the action buttons only when the parent handles them

  readonly toggled = output<number>(); // emits the student id (not "toggle": avoid native DOM event names)
  readonly removed = output<number>();
}
