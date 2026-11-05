import { DOCUMENT } from '@angular/common';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Observable, Subject, catchError, finalize, map, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiError, ApiResponse, toApiError } from '../http/api';

export interface AuthUser {
  readonly id: string; // Phase 12: an Identity GUID
  readonly name: string;
  readonly email: string;
  readonly roles: readonly string[];
}

export interface SessionData {
  readonly accessToken: string;
  readonly expiresAt: string;
  readonly refreshToken?: string | null;
  readonly user: AuthUser;
}

export type LogoutReason = 'expired' | null;

const STORAGE_KEY = 'redstar.session';
const REFRESH_EARLY_MS = 60_000; // refresh a minute before the 15-minute access token expires

// The session STATE plus the token REFRESH.
// Refresh and logout use an HttpClient built on HttpBackend, which SKIPS the interceptors:
//  - no circular dependency (HttpClient -> interceptors -> Session -> HttpClient)
//  - no loop (a 401 on the refresh call must not trigger another refresh)
//
// Token storage trade-off (the same as in React): localStorage survives a reload but is readable by any script (XSS);
// memory-only is safer but logs out on reload; httpOnly cookies hide it from JavaScript but need CSRF protection.
@Injectable({ providedIn: 'root' })
export class Session {
  private readonly storage = inject(DOCUMENT).defaultView?.localStorage ?? null;
  private readonly raw = new HttpClient(inject(HttpBackend));

  private readonly _session = signal<SessionData | null>(this.restore());
  private readonly _token = signal<string | null>(this._session()?.accessToken ?? null);
  private readonly _logoutReason = signal<LogoutReason>(null);

  readonly accessToken = this._token.asReadonly();
  readonly user = computed(() => this._session()?.user ?? null);
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly logoutReason = this._logoutReason.asReadonly();
  readonly canRefresh = computed(() => !!this._session()?.refreshToken);

  private readonly _unauthorized = new Subject<ApiError>();
  readonly unauthorized$: Observable<ApiError> = this._unauthorized.asObservable();
  private readonly _loggedOut = new Subject<LogoutReason>();
  readonly loggedOut$: Observable<LogoutReason> = this._loggedOut.asObservable();

  private refreshInFlight: Observable<SessionData> | null = null;

  constructor() {
    // Before the access token expires: REFRESH it (or log out if there's no refresh token).
    // effect + onCleanup: a new session replaces the old timer.
    effect((onCleanup) => {
      const s = this._session();
      if (!s) return;
      const msLeft = Date.parse(s.expiresAt) - Date.now();
      const timer = s.refreshToken
        ? setTimeout(() => this.refresh().subscribe({ error: () => {} }), Math.max(0, msLeft - REFRESH_EARLY_MS))
        : setTimeout(() => this.logout('expired'), Math.max(0, msLeft));
      onCleanup(() => clearTimeout(timer));
    });
  }

  hasRole(role: string): boolean {
    return this.user()?.roles.includes(role) ?? false;
  }

  start(session: SessionData): void {
    this.write(session);
    this._logoutReason.set(null);
  }

  logout(reason: LogoutReason = null): void {
    const current = this._session();
    // A manual logout revokes the refresh token on the server (fire-and-forget: it must work even if the API is down)
    if (reason !== 'expired' && current?.refreshToken) {
      this.raw.post(`${environment.apiUrl}/auth/logout`, { refreshToken: current.refreshToken }).subscribe({ error: () => {} });
    }
    this.write(null);
    this._logoutReason.set(reason);
    if (current) this._loggedOut.next(reason); // App re-runs the guards for the current page
  }

  // SINGLE-FLIGHT refresh: concurrent callers share ONE request (shareReplay). Sending the same refresh token
  // twice would look like token REUSE to the server, which then (correctly) revokes the whole session.
  refresh(): Observable<SessionData> {
    const refreshToken = this._session()?.refreshToken;
    if (!refreshToken) return throwError(() => new ApiError('Your session has expired. Please log in again.', 401));

    this.refreshInFlight ??= this.raw
      .post<ApiResponse<SessionData>>(`${environment.apiUrl}/auth/refresh`, { refreshToken })
      .pipe(
        map((res) => res.data!),
        tap((next) => this.write(next)), // the NEW access token AND the NEW (rotated) refresh token
        catchError((err: unknown) => {
          this.logout('expired');
          return throwError(() => toApiError(err));
        }),
        finalize(() => (this.refreshInFlight = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.refreshInFlight;
  }

  // Low-level: set only the token (used by interceptor tests)
  setAccessToken(token: string | null): void {
    this._token.set(token || null);
  }

  // The error interceptor calls this when a 401 can't be fixed by refreshing
  notifyUnauthorized(error: ApiError): void {
    this._unauthorized.next(error);
    this.logout('expired');
  }

  private write(session: SessionData | null): void {
    this._session.set(session);
    this._token.set(session?.accessToken ?? null);
    try {
      if (session) this.storage?.setItem(STORAGE_KEY, JSON.stringify(session));
      else this.storage?.removeItem(STORAGE_KEY);
    } catch {
      // storage blocked: the session still works until reload
    }
  }

  // Runs once, when the service is created (before the first request).
  // An expired ACCESS token is fine when there's a refresh token: the first request (or the timer) refreshes it.
  private restore(): SessionData | null {
    try {
      const stored = JSON.parse(this.storage?.getItem(STORAGE_KEY) ?? 'null') as SessionData | null;
      if (stored?.user && (stored.refreshToken || (stored.accessToken && Date.parse(stored.expiresAt) > Date.now()))) return stored;
    } catch {
      // corrupted JSON: treat it as logged out
    }
    this.storage?.removeItem(STORAGE_KEY);
    return null;
  }
}
