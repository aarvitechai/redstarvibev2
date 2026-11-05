import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, mapApiErrors, unwrap } from '../../core/http/api';

export interface Contact {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly phone: string | null;
  readonly isFavourite: boolean;
  readonly createdAt: string;
}

// What the API accepts: no id or createdAt, since the server sets them
export type ContactPayload = Pick<Contact, 'name' | 'email' | 'phone' | 'isFavourite'>;

@Injectable({ providedIn: 'root' })
export class ContactsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/contacts`;

  list(): Observable<Contact[]> {
    return this.http.get<ApiResponse<Contact[]>>(this.url).pipe(unwrap());
  }

  create(contact: ContactPayload): Observable<Contact> {
    return this.http.post<ApiResponse<Contact>>(this.url, contact).pipe(unwrap());
  }

  update(id: number, contact: ContactPayload): Observable<Contact> {
    return this.http.put<ApiResponse<Contact>>(`${this.url}/${id}`, contact).pipe(unwrap());
  }

  setFavourite(id: number, isFavourite: boolean): Observable<Contact> {
    return this.http.put<ApiResponse<Contact>>(`${this.url}/${id}/favourite`, { isFavourite }).pipe(unwrap());
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`).pipe(mapApiErrors()); // 204: no envelope to unwrap
  }
}
