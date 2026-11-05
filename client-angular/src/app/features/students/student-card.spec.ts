import { TestBed } from '@angular/core/testing';
import { StudentCard } from './student-card';
import { Student } from './student.model';
import { getInitials } from '../../shared/utils/format';

const student: Student = Object.freeze({
  id: 1, name: 'Asha Verma', email: 'asha@example.com', course: 'Computer Science', year: 3, isActive: true,
});

async function render(s: Student) {
  const fixture = TestBed.createComponent(StudentCard);
  fixture.componentRef.setInput('student', s); // how a parent's [student]="..." binding is set in tests
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('StudentCard', () => {
  it('renders the input data', async () => {
    const el = await render(student);

    expect(el.querySelector('[role="article"]')?.getAttribute('aria-label')).toBe('Asha Verma');
    expect(el.querySelector('h3')?.textContent).toBe('Asha Verma');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('mailto:asha@example.com');
    expect(el.textContent).toContain('Computer Science');
    expect(el.querySelector('app-avatar')?.textContent?.trim()).toBe('AV');
    expect(el.querySelector('.badge')?.textContent).toBe('Active');
    expect(el.querySelector('.badge')?.classList).toContain('active');
  });

  it('shows Inactive when isActive is false', async () => {
    const el = await render({ ...student, isActive: false });
    expect(el.querySelector('.badge')?.textContent).toBe('Inactive');
    expect(el.querySelector('.badge')?.classList).not.toContain('active');
  });

  it('getInitials takes at most two letters', () => {
    expect(getInitials('asha')).toBe('A');
    expect(getInitials('Asha  Rani Verma')).toBe('AR');
  });
});

describe('StudentCard outputs', () => {
  it('hides the buttons unless editable', async () => {
    const el = await render(student);
    expect(el.querySelector('button')).toBeNull();
  });

  it('emits the id on toggled and removed (events flow up)', async () => {
    const fixture = TestBed.createComponent(StudentCard);
    fixture.componentRef.setInput('student', student);
    fixture.componentRef.setInput('editable', true);
    const toggled: number[] = [];
    const removed: number[] = [];
    fixture.componentInstance.toggled.subscribe((id) => toggled.push(id));
    fixture.componentInstance.removed.subscribe((id) => removed.push(id));
    await fixture.whenStable();

    const [toggleBtn, removeBtn] = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
    expect(toggleBtn.textContent).toBe('Deactivate');
    toggleBtn.click();
    removeBtn.click();

    expect(toggled).toEqual([1]);
    expect(removed).toEqual([1]);
  });
});
