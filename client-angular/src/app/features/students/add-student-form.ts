import { ChangeDetectionStrategy, Component, computed, output, signal } from '@angular/core';
import { NewStudent } from './students.state';

const EMPTY: NewStudent = { name: '', email: '', course: '', year: 1 };

// The form owns only its DRAFT (a signal). The finished student goes UP through the `added` output.
// Plain (input) event bindings for now. Phase 5 replaces this with Angular Reactive Forms and validation.
@Component({
  selector: 'app-add-student-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="form" aria-label="Add student" (submit)="submit($event)">
      <label>Name
        <input name="name" [value]="draft().name" (input)="set('name', $event)" required />
      </label>
      <label>Email
        <input name="email" type="email" [value]="draft().email" (input)="set('email', $event)" required />
      </label>
      <label>Course
        <input name="course" [value]="draft().course" (input)="set('course', $event)" required />
      </label>
      <label>Year
        <select name="year" (change)="set('year', $event)">
          @for (y of years; track y) {
            <option [value]="y" [selected]="draft().year === y">{{ y }}</option>
          }
        </select>
      </label>
      <button type="submit" class="primary" [disabled]="!canSubmit()">Add student</button>
    </form>
  `,
  styles: `
    .form {
      display: grid; gap: 12px; align-items: end; margin: 16px 0;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px;
    }
    label { display: flex; flex-direction: column; gap: 4px; font-size: 0.8125rem; color: var(--muted); }
    input, select {
      font: inherit; color: var(--text); background: var(--bg);
      border: 1px solid var(--border); border-radius: 8px; padding: 6px 8px; min-width: 0;
    }
    .primary {
      font: inherit; font-size: 0.8125rem; padding: 8px 14px; border-radius: 8px; cursor: pointer;
      background: var(--primary); color: var(--primary-contrast); border: 1px solid var(--primary);
    }
    .primary:disabled { opacity: 0.5; cursor: not-allowed; }
  `,
})
export class AddStudentForm {
  readonly added = output<NewStudent>();

  protected readonly years = [1, 2, 3, 4, 5];
  protected readonly draft = signal<NewStudent>(EMPTY);
  protected readonly canSubmit = computed(() => {
    const d = this.draft();
    return !!(d.name.trim() && d.email.trim() && d.course.trim());
  });

  // One handler for every field. update() gives the CURRENT value, and we return a new object.
  protected set(field: keyof NewStudent, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.draft.update((d) => ({ ...d, [field]: field === 'year' ? Number(value) : value }));
  }

  protected submit(event: Event): void {
    event.preventDefault(); // stop the browser's full-page form submit
    if (!this.canSubmit()) return;
    const d = this.draft();
    this.added.emit({ ...d, name: d.name.trim(), email: d.email.trim(), course: d.course.trim() });
    this.draft.set(EMPTY);
  }
}
