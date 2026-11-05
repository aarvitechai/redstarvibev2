import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { ApiError } from '../http/api';

export interface AuthUser {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly roles: readonly string[];
}

export interface SessionData {
  readonly accessToken: string;
  readonly expiresAt: string;
  readonly user: AuthUser;
}

export type LogoutReason = 'expired' | null;

const STORAGE_KEY = 'redstar.session';

// The session STATE: who is logged in, the token, and why they were logged out.
// It deliberately does NOT inject HttpClient: the interceptors inject Session, and HttpClient depends on the
// interceptors, so injecting HttpClient here would create a circular dependency. AuthService does the HTTP.
//
// Token storage trade-off (the same as in React): localStorage survives a reload but is readable by any script (XSS);
// memory-only is safer but logs out on reload; httpOnly cookies hide it from JavaScript but need CSRF protection.
@Injectable({ providedIn: 'root' })
export class Session {
  private readonly storage = inject(DOCUMENT).defaultView?.localStorage ?? null;

  private readonly _session = signal<SessionData | null>(this.restore());
  private readonly _token = signal<string | null>(this._session()?.accessToken ?? null);
  private readonly _logoutReason = signal<LogoutReason>(null);

  readonly accessToken = this._token.asReadonly();
  readonly user = computed(() => this._session()?.user ?? null);
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly logoutReason = this._logoutReason.asReadonly();

  private readonly _unauthorized = new Subject<ApiError>();
  readonly unauthorized$: Observable<ApiError> = this._unauthorized.asObservable();
  private readonly _loggedOut = new Subject<LogoutReason>();
  readonly loggedOut$: Observable<LogoutReason> = this._loggedOut.asObservable();

  constructor() {
    // Log out exactly when the token expires (effect + onCleanup: a new session replaces the old timer)
    effect((onCleanup) => {
      const s = this._session();
      if (!s) return;
      const timer = setTimeout(() => this.logout('expired'), Math.max(0, Date.parse(s.expiresAt) - Date.now()));
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
    const wasLoggedIn = this.isAuthenticated();
    this.write(null);
    this._logoutReason.set(reason);
    if (wasLoggedIn) this._loggedOut.next(reason); // App re-runs the guards for the current page
  }

  // Low-level: set only the token (used by interceptor tests)
  setAccessToken(token: string | null): void {
    this._token.set(token || null);
  }

  // The error interceptor calls this on a 401 for a request that carried our token
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

  // Runs once, when the service is created (before the first request): a saved, unexpired session logs you back in
  private restore(): SessionData | null {
    try {
      const stored = JSON.parse(this.storage?.getItem(STORAGE_KEY) ?? 'null') as SessionData | null;
      if (stored?.accessToken && stored.user && Date.parse(stored.expiresAt) > Date.now()) return stored;
    } catch {
      // corrupted JSON: treat it as logged out
    }
    this.storage?.removeItem(STORAGE_KEY);
    return null;
  }
}
