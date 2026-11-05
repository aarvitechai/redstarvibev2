import { Student } from './student.model';

// The same reducer idea as React's useReducer, typed.
// Used with a signal:  students.update(s => studentsReducer(s, action))

export type NewStudent = Pick<Student, 'name' | 'email' | 'course' | 'year'>;

// A discriminated union: TypeScript knows exactly which fields each action type has
export type StudentsAction =
  | { type: 'added'; student: NewStudent }
  | { type: 'toggled'; id: number }
  | { type: 'removed'; id: number };

export const nextId = (students: readonly Student[]): number =>
  students.reduce((max, s) => Math.max(max, s.id), 0) + 1;

export function studentsReducer(students: readonly Student[], action: StudentsAction): readonly Student[] {
  switch (action.type) {
    case 'added':
      return [...students, { ...action.student, id: nextId(students), isActive: true }];
    case 'toggled':
      return students.map((s) => (s.id === action.id ? { ...s, isActive: !s.isActive } : s));
    case 'removed':
      return students.filter((s) => s.id !== action.id);
    default: {
      // Exhaustiveness check: if someone adds a new action type and forgets a case, this line fails to COMPILE
      const unhandled: never = action;
      throw new Error(`Unknown action: ${JSON.stringify(unhandled)}`);
    }
  }
}

export const studentAdded = (student: NewStudent): StudentsAction => ({ type: 'added', student });
export const studentToggled = (id: number): StudentsAction => ({ type: 'toggled', id });
export const studentRemoved = (id: number): StudentsAction => ({ type: 'removed', id });
