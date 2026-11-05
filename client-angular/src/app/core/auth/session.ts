import { Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { ApiError } from '../http/api';

// Phase 6: what the interceptors need to know about the user's session.
// Phase 12 calls setAccessToken() after login, and listens to unauthorized$ to log out.
@Injectable({ providedIn: 'root' })
export class Session {
  private readonly _token = signal<string | null>(null);
  readonly accessToken = this._token.asReadonly();

  private readonly _unauthorized = new Subject<ApiError>();
  readonly unauthorized$: Observable<ApiError> = this._unauthorized.asObservable();

  setAccessToken(token: string | null): void {
    this._token.set(token || null);
  }

  notifyUnauthorized(error: ApiError): void {
    this._unauthorized.next(error);
  }
}
