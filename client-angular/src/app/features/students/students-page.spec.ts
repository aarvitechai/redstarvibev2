import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StudentsPage } from './students-page';

// Lifted state across siblings: an action in the form or a card updates the stats and the list.
describe('StudentsPage (lifted state across siblings)', () => {
  let fixture: ComponentFixture<StudentsPage>;
  let el: HTMLElement;

  const stats = () => el.querySelector('.stats')!.textContent!.replace(/\s+/g, ' ').trim();
  const cards = () => el.querySelectorAll('[role="article"]');
  const card = (name: string) => el.querySelector(`[aria-label="${name}"]`) as HTMLElement | null;
  const button = (root: HTMLElement, text: string) =>
    Array.from(root.querySelectorAll('button')).find((b) => b.textContent!.trim() === text)!;

  async function type(selector: string, value: string) {
    const input = el.querySelector(selector) as HTMLInputElement | HTMLSelectElement;
    input.value = value;
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    fixture = TestBed.createComponent(StudentsPage);
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('starts with the seed data', () => {
    expect(stats()).toBe('4 students · 3 active · 1 inactive');
    expect(cards().length).toBe(4);
  });

  it('the form adds a student, and the list AND the stats update', async () => {
    const submit = el.querySelector('form button[type="submit"]') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    await type('input[name="name"]', 'Neha Patel');
    await type('input[name="email"]', 'neha@example.com');
    await type('input[name="course"]', 'Civil');
    await type('select[name="year"]', '2');
    expect(submit.disabled).toBe(false);

    submit.click();
    await fixture.whenStable();

    expect(card('Neha Patel')?.textContent).toContain('Civil');
    expect(stats()).toBe('5 students · 4 active · 1 inactive');
    expect((el.querySelector('input[name="name"]') as HTMLInputElement).value).toBe(''); // the draft was reset
  });

  it('a card toggles a student, and the stats update', async () => {
    button(card('Meera Shah')!, 'Activate').click();
    await fixture.whenStable();

    expect(card('Meera Shah')!.querySelector('.badge')!.textContent).toBe('Active');
    expect(stats()).toBe('4 students · 4 active · 0 inactive');
  });

  it('a card removes a student', async () => {
    button(card('Ravi Kumar')!, 'Remove').click();
    await fixture.whenStable();

    expect(card('Ravi Kumar')).toBeNull();
    expect(stats()).toBe('3 students · 2 active · 1 inactive');
  });

  it('"Show active only" is derived: it filters without losing data', async () => {
    const filter = el.querySelector('input[type="checkbox"]') as HTMLInputElement;
    filter.click();
    await fixture.whenStable();
    expect(cards().length).toBe(3);
    expect(stats()).toBe('4 students · 3 active · 1 inactive');

    filter.click();
    await fixture.whenStable();
    expect(cards().length).toBe(4);
  });
});
