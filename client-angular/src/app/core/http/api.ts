import { HttpErrorResponse } from '@angular/common/http';
import { Observable, OperatorFunction, catchError, map, throwError } from 'rxjs';

// The envelope every API endpoint returns (server/Server.Api/Models/ApiResponse.cs)
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  errors: string[];
  fieldErrors?: Record<string, string[]> | null;
}

export type FieldErrors = Record<string, string[]>;

// One error type for every API failure (the same idea as React's services/http.js).
// Forms read `fieldErrors` to put messages under the right inputs.
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 0,
    readonly fieldErrors: FieldErrors | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function toApiError(err: HttpErrorResponse): ApiError {
  const body = err.error as ApiResponse<unknown> | null;
  const message = body?.errors?.[0] ?? (err.status === 0 ? 'Failed to fetch' : `Request failed (${err.status})`);
  return new ApiError(message, err.status, body?.fieldErrors ?? null);
}

// RxJS operator: turn HTTP errors into ApiError (for responses without a body, such as DELETE -> 204)
export function mapApiErrors<T>(): OperatorFunction<T, T> {
  return (source: Observable<T>) => source.pipe(catchError((err: HttpErrorResponse) => throwError(() => toApiError(err))));
}

// RxJS operator for normal API calls: unwrap `data` from the envelope, and map errors
export function unwrap<T>(): OperatorFunction<ApiResponse<T>, T> {
  return (source: Observable<ApiResponse<T>>) =>
    source.pipe(
      map((res) => res.data as T),
      mapApiErrors(),
    );
}
