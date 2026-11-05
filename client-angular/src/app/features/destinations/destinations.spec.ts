import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { App } from '../../app';
import { routes } from '../../app.routes';
import { SessionData } from '../../core/auth/session';
import { appInterceptors } from '../../core/http/interceptors';
import { Destination } from './destinations-api';

const API = 'http://localhost:5240/api/destinations';
const CUSTOMER_SESSION: SessionData = {
  accessToken: 'demo.2.9999999999',
  expiresAt: new Date(Date.now() + 1_800_000).toISOString(),
  user: { id: 'c0000000-0000-0000-0000-000000000002', name: 'Asha Verma', email: 'asha@redstar.dev', roles: ['Customer'] },
};

let fixture: ComponentFixture<App>;
let el: HTMLElement;
let router: Router;
let http: HttpTestingController;
let items: Destination[];
let nextId: number;
let holdVisited: TestRequest[]; // PUT .../visited requests the test answers itself (to look at the optimistic state)
let visitedStatus: number;
let seenAuth: (string | null)[];

// A STATEFUL fake of the destinations API (paging, search, writes), answered through HttpTestingController
function answerApi() {
  for (const req of http.match(() => true)) {
    if (req.cancelled) continue;
    const { method, url, body, params, headers } = req.request;
    seenAuth.push(headers.get('Authorization'));
    const visitedMatch = url.match(/\/destinations\/(\d+)\/visited$/);
    const idMatch = url.match(/\/destinations\/(\d+)$/);
    if (visitedMatch) {
      holdVisited.push(req);
      continue;
    }
    if (method === 'DELETE' && idMatch) {
      items = items.filter((d) => d.id !== Number(idMatch[1]));
      req.flush(null, { status: 204, statusText: 'No Content' });
    } else if (method === 'POST') {
      const input = body as Destination;
      const d = { ...input, id: nextId++, createdAt: '2026-01-02T00:00:00Z' };
      items.push(d);
      req.flush({ success: true, data: d, errors: [] }, { status: 201, statusText: 'Created' });
    } else if (method === 'GET' && url === API) {
      const page = Number(params.get('page') ?? 1);
      const pageSize = Number(params.get('pageSize') ?? 6);
      const all = [...items].sort((a, b) => a.name.localeCompare(b.name));
      const totalPages = Math.ceil(all.length / pageSize);
      req.flush({
        success: true,
        data: { items: all.slice((page - 1) * pageSize, page * pageSize), page, pageSize, totalCount: all.length, totalPages, hasNext: page < totalPages, hasPrevious: page > 1 },
        errors: [],
      });
    } else {
      req.flush({ success: false, data: null, errors: ['not mocked'] }, { status: 404, statusText: 'x' });
    }
  }
}

function answerVisited() {
  for (const req of holdVisited.splice(0)) {
    if (visitedStatus !== 200) {
      req.flush({ success: false, data: null, errors: ['Server refused'] }, { status: visitedStatus, statusText: 'x' });
      continue;
    }
    const isVisited = (req.request.body as { isVisited: boolean }).isVisited;
    items = items.map((x) => (req.request.url.endsWith(`/${x.id}/visited`) ? { ...x, isVisited } : x)); // readonly model: copy
    req.flush({ success: true, data: items.find((x) => req.request.url.endsWith(`/${x.id}/visited`)), errors: [] });
  }
}

async function settle() {
  for (let i = 0; i < 6; i++) {
    fixture.detectChanges();
    TestBed.tick();
    answerApi();
    await new Promise((r) => setTimeout(r, 0));
  }
  fixture.detectChanges();
}

async function start(url: string, session?: SessionData) {
  localStorage.clear();
  if (session) localStorage.setItem('redstar.session', JSON.stringify(session));
  items = ['Cape Town', 'Cusco', 'Hampi', 'Hanoi', 'Istanbul', 'Jaipur', 'Kerala Backwaters', 'Kyoto', 'Leh', 'Lisbon', 'Marrakesh', 'Queenstown', 'Reykjavik', 'Varanasi']
    .map((name, i) => ({ id: i + 1, name, country: 'Somewhere', description: '', rating: 4, isVisited: false, createdAt: '2026-01-01T00:00:00Z' }));
  nextId = 15;
  holdVisited = [];
  visitedStatus = 200;
  seenAuth = [];
  TestBed.configureTestingModule({
    providers: [provideRouter(routes, withComponentInputBinding()), provideHttpClient(withInterceptors(appInterceptors)), provideHttpClientTesting()],
  });
  http = TestBed.inject(HttpTestingController);
  router = TestBed.inject(Router);
  fixture = TestBed.createComponent(App);
  el = fixture.nativeElement;
  await router.navigateByUrl(url);
  await settle();
}

const text = () => el.querySelector('main')!.textContent!.replace(/\s+/g, ' ');
const names = () => Array.from(el.querySelectorAll('ul[aria-label="Destinations"] > li[aria-label]')).map((li) => li.getAttribute('aria-label'));
const card = (name: string) => el.querySelector(`li[aria-label="${name}"]`) as HTMLElement;
const button = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll('button')).find((b) => b.textContent!.trim() === label) as HTMLButtonElement;

afterEach(() => localStorage.clear());

describe('DestinationsPage (httpResource)', () => {
  it('loads the page from the URL, shows the range, and pages with ?page=', async () => {
    await start('/destinations');
    expect(text()).toContain('Showing 1–6 of 14');
    expect(names()).toEqual(['Cape Town', 'Cusco', 'Hampi', 'Hanoi', 'Istanbul', 'Jaipur']);
    expect(seenAuth[0]).toBeNull(); // anonymous: no token sent

    button(el, 'Next →').click();
    await vi.waitFor(() => expect(router.url).toBe('/destinations?page=2'));
    await settle();
    expect(text()).toContain('Showing 7–12 of 14');
    expect(text()).toContain('Page 2 of 3');
  });

  it('anonymous: no add form, and the checkboxes are disabled', async () => {
    await start('/destinations');
    expect(el.querySelector('form[aria-label="Add destination"]')).toBeNull();
    expect((card('Hampi').querySelector('input[type="checkbox"]') as HTMLInputElement).disabled).toBe(true);
  });

  it('adding bumps the version, so the list refetches and shows the new item', async () => {
    await start('/destinations', CUSTOMER_SESSION);
    const form = el.querySelector('form[aria-label="Add destination"]') as HTMLFormElement;
    for (const [label, value] of [['Name', 'Agra'], ['Country', 'India']]) {
      const input = Array.from(form.querySelectorAll('label')).find((l) => l.textContent === label)!.nextElementSibling as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    form.dispatchEvent(new Event('submit'));
    await settle();

    expect(text()).toContain('Showing 1–6 of 15');
    expect(names()[0]).toBe('Agra');
    expect(seenAuth).toContain('Bearer demo.2.9999999999'); // the auth interceptor added the token
  });

  it('deleting refetches the list', async () => {
    await start('/destinations', CUSTOMER_SESSION);
    button(card('Cusco'), 'Delete').click();
    await settle();
    button(card('Cusco'), 'Confirm delete').click();
    await settle();

    expect(text()).toContain('Showing 1–6 of 13');
    expect(names()).not.toContain('Cusco');
  });

  it('OPTIMISTIC visited: ticked before the server answers, and kept after it agrees', async () => {
    await start('/destinations', CUSTOMER_SESSION);
    const box = () => card('Hampi').querySelector('input[type="checkbox"]') as HTMLInputElement;

    box().click();
    await settle();
    expect(holdVisited).toHaveLength(1); // the PUT hasn't been answered yet...
    expect(box().checked).toBe(true); // ...but the box is already ticked

    answerVisited();
    await settle();
    expect(box().checked).toBe(true);
  });

  it('OPTIMISTIC ROLLBACK: a server error restores the previous value', async () => {
    await start('/destinations', CUSTOMER_SESSION);
    visitedStatus = 500;
    const box = () => card('Hampi').querySelector('input[type="checkbox"]') as HTMLInputElement;

    box().click();
    await settle();
    expect(box().checked).toBe(true);

    answerVisited();
    await settle();
    expect(box().checked).toBe(false);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Server refused');
  });
});
