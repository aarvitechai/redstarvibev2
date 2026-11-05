import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, Signal, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, mapApiErrors, unwrap } from '../../core/http/api';

export interface Destination {
  readonly id: number;
  readonly name: string;
  readonly country: string;
  readonly description: string;
  readonly rating: number;
  readonly isVisited: boolean;
  readonly createdAt: string;
}
export type SaveDestination = Pick<Destination, 'name' | 'country' | 'description' | 'rating' | 'isVisited'>;

export interface Paged<T> {
  readonly items: T[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly totalPages: number;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
}

export interface DestinationQuery {
  page: number;
  search: string;
  visited: '' | 'true' | 'false';
}

export const PAGE_SIZE = 6;

// The Angular counterpart of RTK Query, built from parts:
//   httpResource  = a query hook: signal-driven GET with value / isLoading / error
//   version       = a "tag": every list resource READS it, and every successful mutation BUMPS it,
//                   so all destination lists on screen refetch (like invalidatesTags: ['Destination'])
@Injectable({ providedIn: 'root' })
export class DestinationsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/destinations`;
  private readonly version = signal(0);

  // Returns a RESOURCE: it re-requests whenever query() or version() changes, and cancels the previous request.
  // Must be called in an injection context (a component field initialiser).
  list(query: Signal<DestinationQuery>) {
    return httpResource<Paged<Destination>>(
      () => {
        const q = query();
        this.version(); // read it, so a bump re-runs this request (the "tag")
        return {
          url: this.url,
          params: {
            page: q.page,
            pageSize: PAGE_SIZE,
            ...(q.search.trim() ? { search: q.search.trim() } : {}),
            ...(q.visited ? { visited: q.visited } : {}),
          },
        };
      },
      { parse: (raw) => (raw as ApiResponse<Paged<Destination>>).data! }, // unwrap the envelope
    );
  }

  // ---------- mutations: HttpClient + "invalidate" on success ----------
  create(body: SaveDestination): Observable<Destination> {
    return this.http.post<ApiResponse<Destination>>(this.url, body).pipe(unwrap(), tap(() => this.invalidate()));
  }

  update(id: number, body: SaveDestination): Observable<Destination> {
    return this.http.put<ApiResponse<Destination>>(`${this.url}/${id}`, body).pipe(unwrap(), tap(() => this.invalidate()));
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`).pipe(mapApiErrors(), tap(() => this.invalidate()));
  }

  // No invalidate here: the page updates its resource OPTIMISTICALLY instead (and rolls back on error)
  setVisited(id: number, isVisited: boolean): Observable<Destination> {
    return this.http.put<ApiResponse<Destination>>(`${this.url}/${id}/visited`, { isVisited }).pipe(unwrap());
  }

  invalidate(): void {
    this.version.update((v) => v + 1);
  }
}
