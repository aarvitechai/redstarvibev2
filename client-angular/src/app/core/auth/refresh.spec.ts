import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { App } from '../../app';
import { routes } from '../../app.routes';
import { appInterceptors } from '../http/interceptors';
import { Session, SessionData } from './session';

const API = 'http://localhost:5240/api';
const USER = { id: 'c0000000-0000-0000-0000-000000000002', name: 'Asha Verma', email: 'asha@redstar.dev', roles: ['Customer'] };
const session = (accessToken: string, refreshToken: string | null, minutes = 15): SessionData => ({
  accessToken,
  refreshToken,
  expiresAt: new Date(Date.now() + minutes * 60_000).toISOString(),
  user: USER,
});
const ok = <T>(data: T) => ({ success: true, data, errors: [] });
const unauthorized = { body: { success: false, data: null, errors: ['Please log in to continue.'] }, opts: { status: 401, statusText: 'Unauthorized' } };

let http: HttpTestingController;
let client: HttpClient;
let auth: Session;

function setup() {
  localStorage.clear();
  TestBed.configureTestingModule({
    providers: [provideRouter(routes, withComponentInputBinding()), provideHttpClient(withInterceptors(appInterceptors)), provideHttpClientTesting()],
  });
  http = TestBed.inject(HttpTestingController);
  client = TestBed.inject(HttpClient);
  auth = TestBed.inject(Session);
}

afterEach(() => {
  http.verify();
  localStorage.clear();
});

describe('refresh on 401, then retry (errorInterceptor + Session)', () => {
  beforeEach(setup);

  it('an expired access token is refreshed silently, and the request is retried with the new one', async () => {
    auth.start(session('old-access', 'original-refresh'));
    const result = firstValueFrom(client.get(`${API}/auth/me`));

    const first = http.expectOne(`${API}/auth/me`);
    expect(first.request.headers.get('Authorization')).toBe('Bearer old-access');
    first.flush(unauthorized.body, unauthorized.opts);

    const refresh = http.expectOne(`${API}/auth/refresh`);
    expect(refresh.request.body).toEqual({ refreshToken: 'original-refresh' });
    expect(refresh.request.headers.has('Authorization')).toBe(false); // HttpBackend: the interceptors were skipped
    refresh.flush(ok(session('fresh-access', 'rotated-refresh')));

    const retry = http.expectOne(`${API}/auth/me`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer fresh-access');
    retry.flush(ok(USER));

    expect(await result).toEqual(ok(USER));
    expect(auth.accessToken()).toBe('fresh-access');
    expect(JSON.parse(localStorage.getItem('redstar.session')!).refreshToken).toBe('rotated-refresh'); // ROTATED
  });

  it('SINGLE-FLIGHT: three requests failing together share ONE refresh call', async () => {
    auth.start(session('old-access', 'original-refresh'));
    const results = Promise.all([1, 2, 3].map((n) => firstValueFrom(client.get(`${API}/thing/${n}`))));

    for (const req of http.match((r) => r.url.startsWith(`${API}/thing/`))) req.flush(unauthorized.body, unauthorized.opts);
    http.expectOne(`${API}/auth/refresh`).flush(ok(session('fresh-access', 'rotated-refresh'))); // expectOne: exactly ONE
    for (const req of http.match((r) => r.url.startsWith(`${API}/thing/`))) {
      expect(req.request.headers.get('Authorization')).toBe('Bearer fresh-access');
      req.flush(ok(req.request.url));
    }

    expect(await results).toHaveLength(3);
  });

  it('if the refresh fails too, the session ends with reason "expired"', async () => {
    auth.start(session('old-access', 'revoked-refresh'));
    const loggedOut: unknown[] = [];
    auth.loggedOut$.subscribe((r) => loggedOut.push(r));
    const result = firstValueFrom(client.get(`${API}/auth/me`));

    http.expectOne(`${API}/auth/me`).flush(unauthorized.body, unauthorized.opts);
    http.expectOne(`${API}/auth/refresh`).flush({ success: false, data: null, errors: ['Your session has expired. Please log in again.'] }, unauthorized.opts);

    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.logoutReason()).toBe('expired');
    expect(loggedOut).toEqual(['expired']);
  });

  it('a 401 WITHOUT a token (a wrong password) never triggers a refresh', async () => {
    const result = firstValueFrom(client.post(`${API}/auth/login`, {}));
    http.expectOne(`${API}/auth/login`).flush(unauthorized.body, unauthorized.opts);
    await result.catch(() => {});
    http.expectNone(`${API}/auth/refresh`);
  });

  it('logout revokes the refresh token on the server', () => {
    auth.start(session('a', 'to-revoke'));
    auth.logout();
    expect(http.expectOne(`${API}/auth/logout`).request.body).toEqual({ refreshToken: 'to-revoke' });
  });

  it('refreshes PROACTIVELY a minute before the access token expires', async () => {
    auth.start(session('soon-expired', 'original-refresh', 0.5)); // 30 s left: less than the 60 s margin
    TestBed.tick(); // run the effect that schedules the timer
    await new Promise((r) => setTimeout(r, 10));

    http.expectOne(`${API}/auth/refresh`).flush(ok(session('fresh-access', 'rotated-refresh')));
    expect(auth.accessToken()).toBe('fresh-access');
  });
});

describe('restoring a session', () => {
  it('an EXPIRED access token is kept when there is a refresh token (the first request refreshes it)', () => {
    localStorage.setItem('redstar.session', JSON.stringify({ ...session('old', 'original-refresh'), expiresAt: '2000-01-01T00:00:00Z' }));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    expect(TestBed.inject(Session).user()?.name).toBe('Asha Verma');
    TestBed.inject(HttpTestingController).match(() => true).forEach((r) => r.flush(ok(session('x', 'y')))); // the immediate refresh
  });
});

describe('RegisterPage', () => {
  let fixture: ComponentFixture<App>;
  let el: HTMLElement;
  let router: Router;

  async function settle() {
    for (let i = 0; i < 4; i++) {
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  async function fill(values: Record<string, string>) {
    const form = el.querySelector('form[aria-label="Create account"]') as HTMLFormElement;
    for (const [id, value] of Object.entries(values)) {
      const input = form.querySelector(`#reg-${id}`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    form.dispatchEvent(new Event('submit'));
    await settle();
    return form;
  }
  const good = { name: 'Neha Patel', email: 'neha@example.com', password: 'Str0ng!Pass', confirm: 'Str0ng!Pass' };

  beforeEach(async () => {
    setup();
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(App);
    el = fixture.nativeElement;
    await router.navigateByUrl('/register');
    await settle();
  });

  it('creates the account, signs in, and goes home', async () => {
    await fill(good);
    const req = http.expectOne(`${API}/auth/register`);
    expect(req.request.body).toEqual({ name: 'Neha Patel', email: 'neha@example.com', password: 'Str0ng!Pass' });
    req.flush(ok({ ...session('new-access', 'new-refresh'), user: { ...USER, name: 'Neha Patel', email: 'neha@example.com' } }), { status: 201, statusText: 'Created' });
    await settle();

    await vi.waitFor(() => expect(router.url).toBe('/'));
    expect(auth.user()?.name).toBe('Neha Patel');
  });

  it('checks the confirmation on the client (a cross-field validator), with no request', async () => {
    const form = await fill({ ...good, confirm: 'different' });
    expect(form.textContent).toContain('The passwords do not match.');
    http.expectNone(`${API}/auth/register`);
  });

  it('shows the server field error for a taken email', async () => {
    const form = await fill({ ...good, email: 'asha@redstar.dev' });
    http.expectOne(`${API}/auth/register`).flush(
      { success: false, data: null, errors: ['dup'], fieldErrors: { email: ['An account with this email already exists.'] } },
      { status: 409, statusText: 'Conflict' },
    );
    await settle();
    expect(form.textContent).toContain('An account with this email already exists.');
  });
});
