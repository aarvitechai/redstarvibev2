import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Student } from './student.model';

// The envelope every API endpoint returns (server/Server.Api/Models/ApiResponse.cs)
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  errors: string[];
}

// A data-access SERVICE: the Angular equivalent of React's services/studentsApi.js + useStudents hook.
// Components inject it; tests replace HttpClient with HttpTestingController.
@Injectable({ providedIn: 'root' })
export class StudentsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/students`;

  // HttpClient returns a COLD Observable: no request is sent until someone subscribes.
  // Unsubscribing (switchMap does it for you) CANCELS the request, like AbortController.
  search(term = ''): Observable<Student[]> {
    const params = term.trim() ? new HttpParams().set('search', term.trim()) : undefined;

    return this.http.get<ApiResponse<Student[]>>(this.baseUrl, { params }).pipe(
      map((res) => res.data ?? []),
      catchError((err: HttpErrorResponse) => {
        // Prefer the server's message from the envelope; fall back to a generic one
        const message = (err.error as ApiResponse<unknown> | null)?.errors?.[0]
          ?? (err.status === 0 ? 'Failed to fetch' : `Request failed (${err.status})`);
        return throwError(() => new Error(message));
      }),
    );
  }
}
