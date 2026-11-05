import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { App } from '../../app';
import { routes } from '../../app.routes';
import { appInterceptors } from '../http/interceptors';
import { safeRedirect } from './auth';
import { AuthUser, Session, SessionData } from './session';

const API = 'http://localhost:5240/api';
const ADMIN: AuthUser = { id: 'a0000000-0000-0000-0000-000000000001', name: 'Admin User', email: 'admin@redstar.dev', roles: ['Admin'] };
const CUSTOMER: AuthUser = { id: 'c0000000-0000-0000-0000-000000000002', name: 'Asha Verma', email: 'asha@redstar.dev', roles: ['Customer'] };
const ok = <T>(data: T) => ({ success: true, data, errors: [] });
const fail = (status: number, message: string) => ({ body: { success: false, data: null, errors: [message] }, opts: { status, statusText: 'x' } });

const sessionFor = (user: AuthUser, minutes = 30): SessionData => ({
  accessToken: `demo.${user.id}.9999999999`,
  expiresAt: new Date(Date.now() + minutes * 60_000).toISOString(),
  user,
});

let fixture: ComponentFixture<App>;
let el: HTMLElement;
let router: Router;
let http: HttpTestingController;

// Answer API requests like the demo auth endpoints. `meStatus` lets a test simulate a revoked token.
let meStatus = 200;
function answerApi() {
  for (const req of http.match(() => true)) {
    if (req.cancelled) continue;
    respond(req);
  }
}
function respond(req: TestRequest) {
  const url = req.request.url;
  const token = req.request.headers.get('Authorization')?.replace('Bearer ', '');
  if (url === `${API}/auth/login`) {
    const { email, password } = req.request.body as { email: string; password: string };
    const user = [ADMIN, CUSTOMER].find((u) => u.email === email);
    const good = user && password === (user === ADMIN ? 'Admin@123' : 'Customer@123');
    if (!good) {
      const f = fail(401, 'Invalid email or password.');
      return req.flush(f.body, f.opts);
    }
    return req.flush(ok(sessionFor(user!)));
  }
  if (url === `${API}/auth/me`) {
    if (!token || meStatus === 401) {
      const f = fail(401, 'Please log in to continue.');
      return req.flush(f.body, f.opts);
    }
    return req.flush(ok(token.includes(ADMIN.id) ? ADMIN : CUSTOMER));
  }
  if (url === `${API}/admin/summary`) {
    if (!token?.includes(ADMIN.id)) {
      const f = fail(403, "You don't have permission to do that.");
      return req.flush(f.body, f.opts);
    }
    return req.flush(ok({ students: 4, contacts: 3, products: 11, categories: 4 }));
  }
  // The real API returns a PAGE for products, never a bare array. Answering [] here made the product list read
  // `items.length` on undefined after a redirect to /products: an unhandled error that the passing tests hid.
  if (url === `${API}/products`) {
    return req.flush(ok({ items: [], page: 1, pageSize: 12, totalCount: 0, totalPages: 0, hasNext: false, hasPrevious: false }));
  }
  req.flush(ok([]));
}

async function settle() {
  for (let i = 0; i < 5; i++) {
    fixture.detectChanges();
    answerApi();
    await new Promise((r) => setTimeout(r, 0));
  }
  fixture.detectChanges();
}

// Start the app (optionally already logged in, as if restored from localStorage) at a URL
async function start(url: string, session?: SessionData) {
  localStorage.clear();
  if (session) localStorage.setItem('redstar.session', JSON.stringify(session));
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes, withComponentInputBinding()),
      provideHttpClient(withInterceptors(appInterceptors)), // the REAL interceptors: the token goes on every request
      provideHttpClientTesting(),
    ],
  });
  http = TestBed.inject(HttpTestingController);
  router = TestBed.inject(Router);
  fixture = TestBed.createComponent(App);
  el = fixture.nativeElement;
  await router.navigateByUrl(url);
  await settle();
}

const nav = () => el.querySelector('nav[aria-label="Main"]')!;
const navLinks = () => Array.from(nav().querySelectorAll('a')).map((a) => a.textContent!.trim());
const h1 = () => el.querySelector('main h1')?.textContent?.trim();
const button = (text: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.trim().startsWith(text)) as HTMLButtonElement;

async function logIn(email: string, password: string) {
  const form = el.querySelector('form[aria-label="Log in"]') as HTMLFormElement;
  for (const [id, value] of [['login-email', email], ['login-password', password]]) {
    const input = form.querySelector(`#${id}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }
  form.dispatchEvent(new Event('submit'));
  await settle();
  await vi.waitFor(() => expect(router.url).not.toContain('pending'));
  await settle();
}

afterEach(() => {
  meStatus = 200;
  localStorage.clear();
  vi.useRealTimers();
});

describe('guards + redirect after login', () => {
  it('anonymous -> /login?returnUrl=..., then back to that page after logging in', async () => {
    await start('/account');
    expect(router.url).toBe('/login?returnUrl=%2Faccount');
    expect(el.textContent).toContain('Log in to continue to /account');

    await logIn('asha@redstar.dev', 'Customer@123');

    await vi.waitFor(() => expect(router.url).toBe('/account'));
    await settle();
    expect(el.textContent).toContain('Server says: Asha Verma (Customer)');
  });

  it('a wrong password shows the server message, stays on /login, and logs nobody out', async () => {
    await start('/login');
    await logIn('asha@redstar.dev', 'nope');

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Invalid email or password.');
    expect(router.url).toBe('/login');
    expect(TestBed.inject(Session).isAuthenticated()).toBe(false);
  });

  it('/login while already logged in redirects away (no loop)', async () => {
    await start('/login?returnUrl=%2Fproducts', sessionFor(CUSTOMER));
    expect(router.url).toBe('/products');
  });

  it('a customer opening /admin gets /unauthorized (403), not /login (401)', async () => {
    await start('/admin', sessionFor(CUSTOMER));
    expect(router.url).toBe('/unauthorized?from=%2Fadmin');
    expect(h1()).toBe("You don't have access to this page");
  });

  it('an admin can open /admin and sees data from the API', async () => {
    await start('/admin', sessionFor(ADMIN));
    expect(router.url).toBe('/admin');
    expect(el.textContent).toContain('11');
  });
});

describe('role-based UI (convenience, not security)', () => {
  it('anonymous: "Log in", no Account/Admin', async () => {
    await start('/');
    expect(navLinks()).toContain('Log in');
    expect(navLinks()).not.toContain('Account');
    expect(navLinks()).not.toContain('Admin');
  });

  it('customer: Account but no Admin; admin: both', async () => {
    await start('/', sessionFor(CUSTOMER));
    expect(navLinks()).toContain('Account');
    expect(navLinks()).not.toContain('Admin');

    TestBed.resetTestingModule();
    await start('/', sessionFor(ADMIN));
    expect(navLinks()).toContain('Admin');
  });

  it('THE LESSON: a customer calling the admin API directly is refused by the SERVER (403)', async () => {
    await start('/account', sessionFor(CUSTOMER));
    button('GET /api/admin/summary').click();
    await settle();

    expect(el.querySelector('[role="status"]')?.textContent).toContain("403: You don't have permission to do that.");
    expect(router.url).toBe('/account'); // 403 is not "logged out"
  });

  it('Log out clears the session and the guard re-runs: /account -> /login', async () => {
    await start('/account', sessionFor(CUSTOMER));
    button('Log out').click();
    await settle();

    await vi.waitFor(() => expect(router.url).toBe('/login?returnUrl=%2Faccount'));
    expect(localStorage.getItem('redstar.session')).toBeNull();
  });
});

describe('session lifetime', () => {
  it('a saved, unexpired session is restored on start; an expired one is discarded', async () => {
    await start('/', sessionFor(CUSTOMER));
    expect(TestBed.inject(Session).user()?.name).toBe('Asha Verma');

    TestBed.resetTestingModule();
    await start('/', sessionFor(CUSTOMER, -1)); // expired a minute ago
    expect(TestBed.inject(Session).isAuthenticated()).toBe(false);
    expect(localStorage.getItem('redstar.session')).toBeNull();
  });

  it('logs out automatically when the token expires, and the guarded page goes to /login', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await start('/account', sessionFor(CUSTOMER, 1));
    expect(router.url).toBe('/account');

    await vi.advanceTimersByTimeAsync(61_000);
    await settle();

    await vi.waitFor(() => expect(router.url).toBe('/login?returnUrl=%2Faccount'));
    expect(el.textContent).toContain('Your session has expired. Please log in again.');
  });

  it('a 401 from the API (token revoked server-side) logs out and explains why', async () => {
    meStatus = 401;
    await start('/account', sessionFor(CUSTOMER));

    await vi.waitFor(() => expect(router.url).toBe('/login?returnUrl=%2Faccount'));
    await settle();
    expect(el.textContent).toContain('Your session has expired. Please log in again.');
  });
});

describe('safeRedirect', () => {
  it.each([
    ['/account', '/account'],
    ['/products?category=pizza', '/products?category=pizza'],
    ['https://evil.example', '/'],
    ['//evil.example', '/'],
    ['/login', '/'],
    [undefined, '/'],
  ])('%s -> %s', (from, expected) => {
    expect(safeRedirect(from)).toBe(expected);
  });
});
