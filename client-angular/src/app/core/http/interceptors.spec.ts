import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { Session } from '../auth/session';
import { ActivityBar } from '../layout/activity-bar';
import { ApiError } from './api';
import { NetworkActivity, appInterceptors } from './interceptors';

const API = 'http://localhost:5240/api';

let http: HttpTestingController;
let client: HttpClient;

beforeEach(() => {
  TestBed.configureTestingModule({
    // The REAL interceptor chain, with the testing backend instead of the network
    providers: [provideHttpClient(withInterceptors(appInterceptors)), provideHttpClientTesting()],
  });
  http = TestBed.inject(HttpTestingController);
  client = TestBed.inject(HttpClient);
});
afterEach(() => {
  http.verify();
  vi.useRealTimers();
});

const failWith = (status: number, body: object, headers: Record<string, string> = {}) =>
  ({ body, opts: { status, statusText: 'x', headers } });

describe('request interceptors', () => {
  it('add a fresh correlation id to every request', () => {
    client.get(`${API}/a`).subscribe();
    client.get(`${API}/b`).subscribe();
    const [a, b] = [http.expectOne(`${API}/a`), http.expectOne(`${API}/b`)];

    expect(a.request.headers.get('X-Correlation-Id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.request.headers.get('X-Correlation-Id')).not.toBe(b.request.headers.get('X-Correlation-Id'));
    a.flush({});
    b.flush({});
  });

  it('add the Bearer token for OUR API only, never for third-party URLs', () => {
    TestBed.inject(Session).setAccessToken('abc.def.ghi');
    client.get(`${API}/contacts`).subscribe();
    client.get('https://other.example.com/data').subscribe();

    const ours = http.expectOne(`${API}/contacts`);
    const theirs = http.expectOne('https://other.example.com/data');
    expect(ours.request.headers.get('Authorization')).toBe('Bearer abc.def.ghi');
    expect(theirs.request.headers.has('Authorization')).toBe(false); // don't leak tokens
    ours.flush({});
    theirs.flush({});
  });
});

describe('error interceptor', () => {
  it('maps error responses to ApiError with fieldErrors and the server correlation id', async () => {
    const result = firstValueFrom(client.post(`${API}/contacts`, {}));
    const f = failWith(409, { success: false, data: null, errors: ['dup'], fieldErrors: { email: ['taken'] } }, { 'X-Correlation-Id': 'srv-123' });
    http.expectOne(`${API}/contacts`).flush(f.body, f.opts);

    const error = await result.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: 'dup', status: 409, fieldErrors: { email: ['taken'] }, correlationId: 'srv-123' });
  });

  it('turns a dead connection (status 0) into a friendly network error', async () => {
    const result = firstValueFrom(client.get(`${API}/x`));
    http.expectOne(`${API}/x`).error(new ProgressEvent('error'), { status: 0 });
    await expect(result).rejects.toMatchObject({ code: 'network', message: 'Network error: could not reach the server.' });
  });

  it('notifies the session on 401 (one place for "session expired")', async () => {
    const seen: ApiError[] = [];
    TestBed.inject(Session).unauthorized$.subscribe((e) => seen.push(e));

    const result = firstValueFrom(client.get(`${API}/contacts`));
    http.expectOne(`${API}/contacts`).flush({ success: false, data: null, errors: ['Unauthorized'] }, { status: 401, statusText: 'Unauthorized' });
    await result.catch(() => {});

    expect(seen.map((e) => e.status)).toEqual([401]);
  });

  it('times out a hung request and cancels it', async () => {
    vi.useFakeTimers();
    const result = firstValueFrom(client.get(`${API}/slow`));
    const req = http.expectOne(`${API}/slow`);

    vi.advanceTimersByTime(10_000);
    await expect(result).rejects.toMatchObject({ code: 'timeout' });
    expect(req.cancelled).toBe(true); // the timeout unsubscribed, which aborts the HTTP request
  });
});

describe('activity interceptor + ActivityBar', () => {
  it('counts requests in flight, including ones that fail', () => {
    const activity = TestBed.inject(NetworkActivity);
    const fixture = TestBed.createComponent(ActivityBar);
    const el = fixture.nativeElement as HTMLElement;

    client.get(`${API}/a`).subscribe();
    client.get(`${API}/b`).subscribe({ error: () => {} });
    // NOT whenStable(): it waits for pending HTTP requests, which would never finish here
    fixture.detectChanges();
    expect(activity.pending()).toBe(2);
    expect(el.querySelector('[role="progressbar"]')?.getAttribute('aria-label')).toBe('2 requests in progress');

    http.expectOne(`${API}/a`).flush({});
    http.expectOne(`${API}/b`).flush({}, { status: 500, statusText: 'boom' });
    fixture.detectChanges();
    expect(activity.pending()).toBe(0); // balanced: finalize ran for the error too
    expect(el.querySelector('[role="progressbar"]')).toBeNull();
  });
});
