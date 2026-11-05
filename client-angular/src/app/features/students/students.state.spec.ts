import { Student } from './student.model';
import { studentAdded, studentRemoved, studentsReducer, studentToggled, StudentsAction } from './students.state';

const start: readonly Student[] = Object.freeze([
  Object.freeze({ id: 1, name: 'Asha', email: 'a@x.com', course: 'CS', year: 1, isActive: true }),
  Object.freeze({ id: 2, name: 'Ravi', email: 'r@x.com', course: 'ME', year: 2, isActive: false }),
]);

describe('studentsReducer (TS)', () => {
  it('added: appends with the next id and isActive = true', () => {
    const next = studentsReducer(start, studentAdded({ name: 'Meera', email: 'm@x.com', course: 'EE', year: 3 }));
    expect(next[2]).toEqual({ id: 3, name: 'Meera', email: 'm@x.com', course: 'EE', year: 3, isActive: true });
    expect(next).not.toBe(start);
  });

  it('toggled: flips only the match and keeps the others by reference', () => {
    const next = studentsReducer(start, studentToggled(2));
    expect(next[1].isActive).toBe(true);
    expect(next[0]).toBe(start[0]);
  });

  it('removed: filters the student out', () => {
    expect(studentsReducer(start, studentRemoved(1)).map((s) => s.id)).toEqual([2]);
  });

  it('throws at runtime on an unknown action (which is also a compile error)', () => {
    expect(() => studentsReducer(start, { type: 'remove' } as unknown as StudentsAction)).toThrow('Unknown action');
  });
});
