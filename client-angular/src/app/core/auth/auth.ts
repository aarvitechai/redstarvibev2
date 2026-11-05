import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, unwrap } from '../http/api';
import { AuthUser, Session, SessionData } from './session';

// Must match server/Server.Api/Constants/Roles.cs exactly: role checks are case-sensitive
export const ROLES = { admin: 'Admin', customer: 'Customer' } as const;

export interface AdminSummary {
  students: number;
  contacts: number;
  products: number;
  categories: number;
}

// The HTTP side of auth: Phase 12's real Identity + JWT behind the same URLs as the Phase 8 demo.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(Session);
  private readonly url = environment.apiUrl;

  login(email: string, password: string): Observable<SessionData> {
    return this.http
      .post<ApiResponse<SessionData>>(`${this.url}/auth/login`, { email, password })
      .pipe(unwrap(), tap((s) => this.session.start(s)));
  }

  // Phase 12: create an account (always a Customer) and sign in with the session the API returns
  register(name: string, email: string, password: string): Observable<SessionData> {
    return this.http
      .post<ApiResponse<SessionData>>(`${this.url}/auth/register`, { name, email, password })
      .pipe(unwrap(), tap((s) => this.session.start(s)));
  }

  me(): Observable<AuthUser> {
    return this.http.get<ApiResponse<AuthUser>>(`${this.url}/auth/me`).pipe(unwrap());
  }

  adminSummary(): Observable<AdminSummary> {
    return this.http.get<ApiResponse<AdminSummary>>(`${this.url}/admin/summary`).pipe(unwrap());
  }
}

// Where to go after logging in. Only same-site paths (no open redirect), never /login itself (no loop).
export function safeRedirect(returnUrl: string | null | undefined): string {
  const path = returnUrl ?? '';
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/login')) return '/';
  return path;
}

// ---------- FUNCTIONAL GUARDS (UX only: the API checks every request anyway) ----------
// A guard returns true (go ahead) or a UrlTree (go here instead). Returning a UrlTree, rather than calling
// router.navigate() inside the guard, lets the router cancel and redirect cleanly in a single navigation.

// Logged in? Otherwise /login?returnUrl=/account
export const authGuard: CanActivateFn = (_route, state) =>
  inject(Session).isAuthenticated() ||
  inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });

// Has one of these roles? Not logged in -> /login (401); wrong role -> /unauthorized (403)
export const roleGuard =
  (...roles: string[]): CanActivateFn =>
  (route, state) => {
    const session = inject(Session);
    const router = inject(Router);
    if (!session.isAuthenticated()) return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
    return roles.some((r) => session.hasRole(r)) || router.createUrlTree(['/unauthorized'], { queryParams: { from: state.url } });
  };

// /login while already logged in -> go straight to the target (no login <-> page loop)
export const guestOnlyGuard: CanActivateFn = (route) =>
  !inject(Session).isAuthenticated() || inject(Router).parseUrl(safeRedirect(route.queryParamMap.get('returnUrl')));
