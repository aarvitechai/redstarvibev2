import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { Student } from '../students/student.model';
import { StudentsApi } from '../students/students-api';
import { DirectoryPage } from './directory-page';

const API = 'http://localhost:5240/api/students';
const students: Student[] = [
  { id: 1, name: 'Asha Verma', email: 'a@x.com', course: 'Computer Science', year: 3, isActive: true },
  { id: 4, name: 'Arjun Singh', email: 'r@x.com', course: 'Computer Science', year: 1, isActive: true },
];
const ok = (data: Student[]) => ({ success: true, data, errors: [] });

let http: HttpTestingController;

beforeEach(() => {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  http = TestBed.inject(HttpTestingController);
});
afterEach(() => {
  http.verify(); // fails the test if any request was made that the test didn't expect
  vi.useRealTimers();
});

describe('StudentsApi (HttpClient service)', () => {
  it('sends the search param and unwraps the envelope', async () => {
    const result = firstValueFrom(TestBed.inject(StudentsApi).search(' comp '));

    const req = http.expectOne((r) => r.url === API);
    expect(req.request.params.get('search')).toBe('comp');
    req.flush(ok(students));

    expect(await result).toEqual(students);
  });

  it('omits the param for an empty search', () => {
    TestBed.inject(StudentsApi).search('  ').subscribe();
    const req = http.expectOne(API);
    expect(req.request.params.has('search')).toBe(false);
    req.flush(ok([]));
  });

  it('turns an error envelope into an Error with the server message', async () => {
    const result = firstValueFrom(TestBed.inject(StudentsApi).search('x'));
    http.expectOne((r) => r.url === API).flush(
      { success: false, data: null, errors: ['search: too long'] },
      { status: 400, statusText: 'Bad Request' },
    );
    await expect(result).rejects.toThrow('search: too long');
  });
});

describe('DirectoryPage (RxJS pipeline)', () => {
  let fixture: ComponentFixture<DirectoryPage>;
  let el: HTMLElement;

  function setup() {
    vi.useFakeTimers();
    fixture = TestBed.createComponent(DirectoryPage);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }
  function tick(ms: number) {
    vi.advanceTimersByTime(ms);
    fixture.detectChanges();
  }
  function typeSearch(value: string) {
    const box = el.querySelector('input[type="search"]') as HTMLInputElement;
    box.value = value;
    box.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }
  const names = () => Array.from(el.querySelectorAll('h3')).map((h) => h.textContent);

  it('loads after the debounce, shows the results count, and sorts with computed()', () => {
    setup();
    expect(el.textContent).toContain('Loading…');
    tick(300);
    http.expectOne(API).flush(ok(students));
    fixture.detectChanges();

    expect(el.textContent).toContain('2 results');
    expect(names()).toEqual(['Arjun Singh', 'Asha Verma']);
  });

  it('debounces typing into ONE request for the final term', () => {
    setup();
    tick(300);
    http.expectOne(API).flush(ok(students)); // the initial load

    for (const term of ['c', 'co', 'com', 'comp']) {
      typeSearch(term);
      tick(100); // faster than the 300 ms debounce
    }
    tick(300);

    const reqs = http.match((r) => r.url === API);
    expect(reqs.length).toBe(1);
    expect(reqs[0].request.params.get('search')).toBe('comp');
    reqs[0].flush(ok([students[0]]));
  });

  it('switchMap CANCELS the in-flight request when a newer term arrives', () => {
    setup();
    tick(300);
    const first = http.expectOne(API); // not answered yet...

    typeSearch('comp');
    tick(300);
    const second = http.expectOne((r) => r.params.get('search') === 'comp');

    expect(first.cancelled).toBe(true); // ...and now it's cancelled, so it can never overwrite "comp"
    second.flush(ok([students[0]]));
    fixture.detectChanges();
    expect(names()).toEqual(['Asha Verma']);
  });

  it('shows an error with Retry, and Retry fetches again', () => {
    setup();
    tick(300);
    http.expectOne(API).error(new ProgressEvent('error'), { status: 0 });
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Could not load students: Network error: could not reach the server.');

    (el.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    tick(300);
    http.expectOne(API).flush(ok(students));
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.textContent).toContain('2 results');
  });
});
