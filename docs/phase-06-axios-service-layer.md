# Phase 6: Axios Service Layer (and HTTP interceptors)

**Goal:** one configured HTTP client that every call goes through. The cross-cutting work (base URL, timeout, auth header, correlation id, error mapping, global 401, loading indicator) is written **once**, in interceptors, instead of in every component.

## What was built

| Concern | React (Axios) | Angular (HttpClient) | Backend |
| --- | --- | --- | --- |
| The client | `services/apiClient.js`: `axios.create` | `provideHttpClient(withFetch(), withInterceptors(...))` | — |
| Config | `constants/config.js` (`VITE_API_URL`, `VITE_API_TIMEOUT_MS`) | `environments/*.ts` (`apiUrl`, `apiTimeoutMs`) | `appsettings*.json` |
| Correlation id | request interceptor | `correlationIdInterceptor` | `Middleware/CorrelationIdMiddleware.cs` |
| Auth header | request interceptor + `services/session.js` | `authInterceptor` (our API only) + `core/auth/session.ts` | (Phase 12) |
| Timeout | `timeout` option | `timeout()` in `errorInterceptor` | — |
| Error mapping | response interceptor → `ApiError` | `errorInterceptor` → `ApiError` | `GlobalExceptionHandler.cs` (500 envelope) |
| Global 401 | `onUnauthorized()` listeners | `Session.unauthorized$` | — |
| Loading bar | `networkActivity` + `useSyncExternalStore` | `NetworkActivity` signal + `activityInterceptor` | — |
| Request log | — | — | `Middleware/RequestLoggingMiddleware.cs` |

**The payoff:** `services/http.js` kept the **same** `request()` signature when it moved from `fetch` to Axios. No component or hook changed, and all 75 existing React tests passed against the new client.

## How a request flows
```
component -> service (contactsApi.create) -> request() -> apiClient
  REQUEST interceptor:  + X-Correlation-Id, + Authorization (if token), activity.start()
  ---- network ---->  API: CorrelationId -> RequestLog -> ExceptionHandler -> CORS -> ... -> controller
  <--- response ----  X-Correlation-Id echoed (CORS exposes it), envelope body
  RESPONSE interceptor: activity.end(); success:false or 4xx/5xx -> ApiError { status, fieldErrors, correlationId }
                        401 -> notify unauthorized; timeout/network -> friendly messages; cancel -> passed through
```

## Backend notes
- **Correlation id:** a client id is accepted only if it's safe (`^[A-Za-z0-9._-]{1,64}$`); otherwise a GUID is generated. This blocks **log injection**. The id is echoed on every response, set as `TraceIdentifier`, and added to a **logging scope**.
- **CORS `WithExposedHeaders`:** browsers hide response headers from JavaScript unless CORS exposes them. Without it, the interceptors couldn't read the id.
- **Structured logging:** use `"HTTP {Method} {Path} responded {StatusCode}"` placeholders, never `$"..."` interpolation, so log tools get named fields. Only the path is logged, never the query string, which can contain tokens or personal data.
- **500s:** `GlobalExceptionHandler` returns the usual envelope with `"Reference: <correlationId>"`. A test checks that the exception message and stack trace **never** reach the client.
- **Logs:** single-line console logs with scopes in Development, and JSON in production (`appsettings.json`), ready for a log service.
- **Bug found live:** a `Dictionary` logging scope printed as `System.Collections.Generic.Dictionary` in the console. A message-template scope (`"CorrelationId:{CorrelationId}"`) prints readably and stays structured.

## Gotchas found while building
- Axios's fetch adapter calls `fetch(Request)`, not `fetch(url, init)`, so the test mock now accepts both (`callDetails()` reads either form).
- Axios runs interceptors **asynchronously**, so a request superseded right away is cancelled **before it's even sent**. The race test now waits until the old request is really in flight.
- Axios reports a cancellation as `CanceledError`, not `AbortError`, so the hooks use `isAbortError()`.
- Angular: `fixture.whenStable()` waits for pending HTTP requests, so don't call it while a `HttpTestingController` request is unanswered.
- Angular interceptors: `HttpRequest` is immutable, so use `req.clone({ setHeaders })`. Responses pass back through the interceptors in **reverse** order.

## Checkpoint: answer these out loud before Phase 7

**Q1. Where do API calls live?**
In a **service layer** (`services/*Api.js` in React, `@Injectable` services in Angular), never directly in components. Components call `contactsApi.create(...)` and receive data or an `ApiError`. The services use **one configured client** (`apiClient` / `HttpClient` plus interceptors) that owns the base URL, timeout, headers, error mapping and the global 401. Benefits: change the transport in one place (fetch → Axios happened this phase with zero component edits), test components with a fake service, and keep auth and error rules consistent.

**Q2. How do you avoid fetch race conditions?**
Make sure an **old response can never overwrite a newer one**:
1. **Cancel** the previous request: `AbortController` + `signal` passed to Axios, aborted in the `useEffect` cleanup (React), or `switchMap` unsubscribing (Angular).
2. **Ignore cancellations** as non-errors (`isAbortError`).
3. **Debounce** fast input, so fewer requests start.
4. Or **tag** results with the request they answer and discard stale ones (`useStudents` keeps a `requestKey`).
Later, RTK Query (Phase 10) handles this for you.

**Self-check:**
- Why must CORS **expose** `X-Correlation-Id`?
- Why does the auth interceptor check that the URL is our API?
- Why does the activity counter use `finalize` / `end()` in both the success and error paths?
- What would a user see on a 500, and how would you find its logs?
- Why is anything in a `VITE_` variable public?
