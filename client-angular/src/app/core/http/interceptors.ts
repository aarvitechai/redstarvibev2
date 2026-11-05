import { HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, finalize, throwError, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Session } from '../auth/session';
import { CORRELATION_HEADER, toApiError } from './api';

// FUNCTIONAL INTERCEPTORS: plain functions (req, next) => Observable, registered in app.config.ts with withInterceptors([...]).
// Requests pass through them in order, and responses come back in REVERSE order (like middleware on the server).
// HttpRequest is IMMUTABLE: to change it you clone() it. You never modify it in place.

// 1. Tag every request so it can be matched with the server's logs
export const correlationIdInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.clone({ setHeaders: { [CORRELATION_HEADER]: crypto.randomUUID() } }));

// 2. Attach the access token, but only for OUR API (never send tokens to third-party URLs)
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(Session).accessToken();
  const isOurApi = req.url.startsWith(environment.apiUrl);
  return next(token && isOurApi ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);
};

// 3. Count requests in flight, for the global activity bar
@Injectable({ providedIn: 'root' })
export class NetworkActivity {
  private readonly _pending = signal(0);
  readonly pending = this._pending.asReadonly();
  readonly busy = computed(() => this._pending() > 0);
  start(): void {
    this._pending.update((n) => n + 1);
  }
  end(): void {
    this._pending.update((n) => Math.max(0, n - 1));
  }
}

export const activityInterceptor: HttpInterceptorFn = (req, next) => {
  const activity = inject(NetworkActivity);
  activity.start();
  return next(req).pipe(finalize(() => activity.end())); // finalize runs on success, error AND cancel
};

// 4. Timeout + error mapping + global 401, in ONE place for every request
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(Session);
  return next(req).pipe(
    timeout(environment.apiTimeoutMs),
    catchError((err: unknown) => {
      const apiError = toApiError(err);
      // Only when we SENT a token: a wrong password at login is also a 401, and must not log anyone out
      if (apiError.status === 401 && req.headers.has('Authorization')) session.notifyUnauthorized(apiError);
      return throwError(() => apiError);
    }),
  );
};

// In order: correlation id and auth shape the request, activity wraps everything, and errors are mapped closest to the network
export const appInterceptors = [correlationIdInterceptor, authInterceptor, activityInterceptor, errorInterceptor];
