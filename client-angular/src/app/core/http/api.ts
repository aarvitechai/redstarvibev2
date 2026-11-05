import { HttpErrorResponse } from '@angular/common/http';
import { Observable, OperatorFunction, TimeoutError, catchError, map, throwError } from 'rxjs';

export const CORRELATION_HEADER = 'X-Correlation-Id';

// The envelope every API endpoint returns (server/Server.Api/Models/ApiResponse.cs)
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  errors: string[];
  fieldErrors?: Record<string, string[]> | null;
}

export type FieldErrors = Record<string, string[]>;
export type ApiErrorCode = 'timeout' | 'network' | null;

// One error type for every API failure (the same idea as React's services/apiClient.js).
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 0,
    readonly fieldErrors: FieldErrors | null = null,
    readonly correlationId: string | null = null,
    readonly code: ApiErrorCode = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Turns ANY failure from HttpClient into an ApiError. Safe to call twice: an ApiError passes through unchanged.
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof TimeoutError) {
    return new ApiError('The server took too long to respond. Please try again.', 0, null, null, 'timeout');
  }
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return new ApiError('Network error: could not reach the server.', 0, null, null, 'network');
    const body = err.error as ApiResponse<unknown> | null;
    return new ApiError(
      body?.errors?.[0] ?? `Request failed (${err.status})`,
      err.status,
      body?.fieldErrors ?? null,
      err.headers?.get(CORRELATION_HEADER) ?? null,
    );
  }
  return new ApiError(err instanceof Error ? err.message : 'Something went wrong.');
}

// RxJS operator: make sure errors are ApiErrors (the error interceptor already does this; this keeps services safe
// even when HttpClient is provided without interceptors, as in some unit tests)
export function mapApiErrors<T>(): OperatorFunction<T, T> {
  return (source: Observable<T>) => source.pipe(catchError((err: unknown) => throwError(() => toApiError(err))));
}

// RxJS operator for normal API calls: unwrap `data` from the envelope
export function unwrap<T>(): OperatorFunction<ApiResponse<T>, T> {
  return (source: Observable<ApiResponse<T>>) =>
    source.pipe(
      map((res) => res.data as T),
      mapApiErrors(),
    );
}
