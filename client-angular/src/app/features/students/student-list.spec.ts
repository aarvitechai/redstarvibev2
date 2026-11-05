import { TestBed } from '@angular/core/testing';
import { StudentList } from './student-list';
import { StudentsPage } from './students-page';
import { STUDENTS } from './students.data';

describe('StudentList', () => {
  it('renders one card per student', async () => {
    const fixture = TestBed.createComponent(StudentList);
    fixture.componentRef.setInput('students', STUDENTS);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('app-student-card').length).toBe(STUDENTS.length);
  });

  it('shows an empty state for an empty array', async () => {
    const fixture = TestBed.createComponent(StudentList);
    fixture.componentRef.setInput('students', []);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No students yet.');
    expect(el.querySelector('app-student-card')).toBeNull();
  });
});

describe('StudentsPage', () => {
  it('shows the derived active count', async () => {
    const fixture = TestBed.createComponent(StudentsPage);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('3 of 4 active');
  });
});
