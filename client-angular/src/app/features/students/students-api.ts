import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, unwrap } from '../../core/http/api';
import { Student } from './student.model';

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
    return this.http
      .get<ApiResponse<Student[]>>(this.baseUrl, { params })
      .pipe(unwrap(), map((students) => students ?? []));
  }
}
