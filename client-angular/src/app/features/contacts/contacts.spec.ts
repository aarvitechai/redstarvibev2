import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ApiError } from '../../core/http/api';
import { ContactForm } from './contact-form';
import { contactValidators, firstError } from './contact-validators';
import { Contact, ContactPayload } from './contacts-api';
import { ContactsPage } from './contacts-page';

const API = 'http://localhost:5240/api/contacts';
const seed: Contact[] = [
  { id: 1, name: 'Asha Verma', email: 'asha@example.com', phone: '+91 98765 43210', isFavourite: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 2, name: 'Ravi Kumar', email: 'ravi@example.com', phone: null, isFavourite: false, createdAt: '2026-01-01T00:00:00Z' },
];
const ok = <T>(data: T) => ({ success: true, data, errors: [] });

// DOM helpers
function type(root: HTMLElement, label: string, value: string) {
  const input = Array.from(root.querySelectorAll('label'))
    .find((l) => l.textContent!.trim() === label)!
    .nextElementSibling as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('blur'));
  return input;
}
const button = (root: Element, text: string) =>
  Array.from(root.querySelectorAll('button')).find((b) => b.textContent!.trim() === text) as HTMLButtonElement;
const text = (root: Element) => root.textContent!.replace(/\s+/g, ' ');

describe('contactValidators (custom ValidatorFns)', () => {
  it('return the same messages as the server', () => {
    const msg = (v: (c: FormControl) => unknown, value: string) => firstError(Object.assign(new FormControl(value), { errors: v(new FormControl(value)) }));
    expect(msg(contactValidators.name, ' ')).toBe('Name is required.');
    expect(msg(contactValidators.email, 'nope')).toBe('Enter a valid email address.');
    expect(msg(contactValidators.phone, 'abc')).toBe('Phone may contain digits, spaces, + ( ) - and be 7 to 20 characters.');
    expect(contactValidators.phone(new FormControl(''))).toBeNull(); // optional
  });
});

describe('ContactForm (Reactive Forms)', () => {
  let fixture: ComponentFixture<ContactForm>;
  let el: HTMLElement;
  let save: ReturnType<typeof vi.fn<(p: ContactPayload) => Observable<unknown>>>;

  async function create(contact: Contact | null = null) {
    fixture = TestBed.createComponent(ContactForm);
    el = fixture.nativeElement;
    fixture.componentRef.setInput('save', save);
    if (contact) fixture.componentRef.setInput('contact', contact);
    await fixture.whenStable();
  }
  const submit = async (label = 'Add contact') => {
    button(el, label).click();
    await fixture.whenStable();
  };

  beforeEach(() => {
    save = vi.fn<(p: ContactPayload) => Observable<unknown>>(() => of({}));
  });

  it('submitting empty shows every client error and does NOT call save', async () => {
    await create();
    await submit();
    expect(text(el)).toContain('Name is required.');
    expect(text(el)).toContain('Email is required.');
    expect(save).not.toHaveBeenCalled();
  });

  it('shows a field error after blur (touched)', async () => {
    await create();
    type(el, 'Email', 'bad');
    await fixture.whenStable();
    expect(text(el)).toContain('Enter a valid email address.');
    expect(text(el)).not.toContain('Name is required.'); // Name hasn't been touched yet
  });

  it('sends a clean payload, shows "Saving…" while pending, then resets', async () => {
    const response = new Subject<unknown>();
    save.mockReturnValue(response);
    await create();
    type(el, 'Name', '  Neha Patel ');
    type(el, 'Email', 'neha@example.com');
    await submit();

    expect(save).toHaveBeenCalledWith({ name: 'Neha Patel', email: 'neha@example.com', phone: null, isFavourite: false });
    expect(button(el, 'Saving…').disabled).toBe(true);

    response.next({});
    response.complete();
    await fixture.whenStable();
    expect(button(el, 'Add contact')).toBeTruthy();
    expect((el.querySelector('input') as HTMLInputElement).value).toBe('');
  });

  it('puts the server field error under the right input', async () => {
    save.mockReturnValue(throwError(() => new ApiError('dup', 409, { email: ["Email 'asha@example.com' is already in use."] })));
    await create();
    type(el, 'Name', 'Copy Cat');
    type(el, 'Email', 'asha@example.com');
    await submit();

    expect(text(el)).toContain("Email 'asha@example.com' is already in use.");
    const email = Array.from(el.querySelectorAll('input')).find((i) => i.type === 'email')!;
    expect(email.getAttribute('aria-invalid')).toBe('true');
  });

  it('edit mode: prefilled, Save disabled until changed, and the custom ControlValueAccessor toggle counts as a change', async () => {
    await create(seed[1]);
    expect((el.querySelector('input') as HTMLInputElement).value).toBe('Ravi Kumar');
    expect(button(el, 'Save').disabled).toBe(true); // pristine

    const star = el.querySelector('[role="switch"]') as HTMLButtonElement;
    star.click();
    await fixture.whenStable();
    expect(star.getAttribute('aria-checked')).toBe('true');
    expect(button(el, 'Save').disabled).toBe(false);

    await submit('Save');
    expect(save).toHaveBeenCalledWith({ name: 'Ravi Kumar', email: 'ravi@example.com', phone: null, isFavourite: true });
  });
});

describe('ContactsPage (HttpTestingController)', () => {
  let fixture: ComponentFixture<ContactsPage>;
  let el: HTMLElement;
  let http: HttpTestingController;

  const rows = () => Array.from(el.querySelectorAll('ul[aria-label="Contacts"] > [role="listitem"], ul[aria-label="Contacts"] > li'));
  const names = () => rows().map((r) => r.getAttribute('aria-label') ?? '(form)');
  const row = (name: string) => el.querySelector(`[role="listitem"][aria-label="${name}"]`) as HTMLElement;
  const settle = async () => {
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ContactsPage);
    el = fixture.nativeElement;
    fixture.detectChanges();
    http.expectOne(API).flush(ok(seed));
    await settle();
  });
  afterEach(() => http.verify());

  async function addContact(name: string, email: string) {
    const form = el.querySelector('form[aria-label="Add contact"]') as HTMLElement;
    type(form, 'Name', name);
    type(form, 'Email', email);
    button(form, 'Add contact').click();
    await settle();
    return form;
  }

  it('loads contacts, favourites first', () => {
    expect(names()).toEqual(['Asha Verma', 'Ravi Kumar']);
  });

  it('OPTIMISTIC: the row appears before the server answers, then becomes real', async () => {
    await addContact('Neha Patel', 'neha@example.com');

    const req = http.expectOne((r) => r.method === 'POST' && r.url === API);
    expect(row('Neha Patel').getAttribute('aria-busy')).toBe('true'); // already visible, still pending
    expect(text(row('Neha Patel'))).toContain('Saving…');

    req.flush(ok({ ...req.request.body, id: 3, createdAt: '2026-01-02T00:00:00Z' }), { status: 201, statusText: 'Created' });
    await settle();
    expect(row('Neha Patel').getAttribute('aria-busy')).toBeNull();
    expect(names()).toEqual(['Asha Verma', 'Neha Patel', 'Ravi Kumar']);
  });

  it('OPTIMISTIC ROLLBACK: a 409 removes the temporary row and shows the field error', async () => {
    const form = await addContact('Copy Cat', 'asha@example.com');
    expect(row('Copy Cat')).toBeTruthy();

    http.expectOne((r) => r.method === 'POST').flush(
      { success: false, data: null, errors: ['dup'], fieldErrors: { email: ['Email is already in use.'] } },
      { status: 409, statusText: 'Conflict' },
    );
    await settle();

    expect(row('Copy Cat')).toBeNull();
    expect(text(form)).toContain('Email is already in use.');
  });

  it('favourite, edit and two-step delete', async () => {
    (row('Ravi Kumar').querySelector('[role="switch"]') as HTMLButtonElement).click();
    const fav = http.expectOne(`${API}/2/favourite`);
    expect(fav.request.body).toEqual({ isFavourite: true });
    fav.flush(ok({ ...seed[1], isFavourite: true }));
    await settle();
    expect(names()).toEqual(['Asha Verma', 'Ravi Kumar']);
    expect(row('Ravi Kumar').querySelector('[role="switch"]')!.getAttribute('aria-checked')).toBe('true');

    button(row('Ravi Kumar'), 'Edit').click();
    await settle();
    const edit = el.querySelector('form[aria-label="Edit Ravi Kumar"]') as HTMLElement;
    type(edit, 'Name', 'Ravi K');
    await settle(); // let change detection enable Save (the form is now dirty)
    button(edit, 'Save').click();
    const put = http.expectOne((r) => r.method === 'PUT' && r.url === `${API}/2`);
    put.flush(ok({ ...seed[1], isFavourite: true, name: 'Ravi K' }));
    await settle();
    expect(row('Ravi K')).toBeTruthy();

    button(row('Ravi K'), 'Delete').click();
    await settle();
    button(row('Ravi K'), 'Confirm delete').click();
    http.expectOne((r) => r.method === 'DELETE' && r.url === `${API}/2`).flush(null, { status: 204, statusText: 'No Content' });
    await settle();
    expect(names()).toEqual(['Asha Verma']);
  });
});
