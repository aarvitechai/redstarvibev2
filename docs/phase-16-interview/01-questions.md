# Interview questions, answered from this project

Each answer has three parts: a **short answer** (what you'd say), **in this repo** (where it lives), and **proof** (the test). *Angular:* gives the equivalent, for "how would Angular do it?" follow-ups.

---

## 1. React fundamentals

**Q: What is JSX, and is it HTML?**
It's JavaScript syntax that compiles to `React.createElement`/`jsx()` calls, which return plain objects describing the UI. It isn't HTML: `className`, `htmlFor`, camelCase events, and `{}` holds expressions, not statements. Text inside `{}` is **escaped**, which is React's default XSS protection.
*In this repo:* the lint rule `react/no-danger` (`client-react/.oxlintrc.json`) bans the one escape hatch, `dangerouslySetInnerHTML`.

**Q: Props vs state?**
Props are inputs owned by the parent and read-only. State is memory owned by the component, and changing it re-renders. Data flows **down** through props, and events flow **up** through callbacks.
*In this repo:* `StudentsPage` lifts state so the form, list and stats stay in sync. *Proof:* `StudentsPage.test.jsx` "the form adds a student, and the list AND the stats update". *Angular:* `input()` / `output()`, in `students-page.spec.ts`.

**Q: Why do lists need `key`, and why not the index?**
Keys tell React which item is which between renders. With the index as the key, inserting at the top shifts every key, so React reuses the wrong DOM node and the typed text "jumps" rows.
*Proof:* `KeysDemo.test.jsx` "key={index}: the typed text jumps to the NEW row (bug)". *Angular:* `track item.id` vs `track $index` (`playground.spec.ts`).

**Q: Why does `setCount(count + 1)` three times add only 1?**
State is a **snapshot** for this render. All three calls read the same `count`. Use the updater form, `setCount(c => c + 1)`.
*Proof:* `Counter.test.jsx`. *Angular contrast:* signals update synchronously, so `set(count() + 1)` three times adds 3 (`playground.spec.ts`).

**Q: Derived state, should I store it?**
No. Compute it during render (filtered lists, totals). Storing it creates two sources of truth that drift apart.
*Proof:* `StudentsPage.test.jsx` "'Show active only' is derived from state". Cart totals are selectors, not state (`redux.test.jsx`).

## 2. Hooks

**Q: What does `useEffect` cleanup do? Give a real bug it prevents.**
It undoes the effect: it runs before the next effect and on unmount. Without it you get leaked intervals, or a slow old response overwriting a newer one.
*In this repo:* `useStudents` aborts the previous request with an `AbortController`. *Proof:* `hooks.test.jsx` "aborts the previous request, so a slow old response can never overwrite a newer one", and `phase04Components.test.jsx` "clears the interval on unmount". *Angular:* `switchMap` cancels (`directory.spec.ts`), and `DestroyRef`/effect cleanup.

**Q: When do `useMemo`/`useCallback`/`React.memo` help?**
Only when a measured re-render is expensive, or when a stable reference is needed (a memoised child, or an effect dependency). `memo` alone doesn't help if the parent passes a new function every render: you need `memo` **plus** `useCallback`.
*Proof:* `phase04Components.test.jsx` "only memo + useCallback skips re-rendering".
*A real bug from this project:* the admin `Modal` put an inline `onClose` in an effect's dependency list, so the effect re-ran on every keystroke and stole focus. The fix was the "latest ref" pattern (`components/admin/Modal.jsx`).

**Q: Custom hooks: what are they for?**
They let you reuse **stateful logic**, not UI: `useDebouncedValue`, `useStudents`, `useAuth`, `useNetworkActivity` (which uses `useSyncExternalStore` over an external store). *Proof:* `hooks.test.jsx`, `apiClient.test.jsx` "network activity".

**Q: Context: when, and what's the catch?**
For values many components need that change rarely (theme, current user). The catch is that every consumer re-renders when the value changes. This project moved theme and auth to Redux in Phase 9, for DevTools, middleware and selector-based updates. *Angular:* an injectable service (`ThemeService`, `providedIn: 'root'`).

## 3. Router and Auth

**Q: How do protected routes work, and are they security?**
`ProtectedRoute` is a layout route. Anonymous users go to `/login`, remembering `state.from`. A user without the role goes to `/unauthorized`. Otherwise it renders `<Outlet/>`. It is **not** security, because anyone can edit the JavaScript. Security is the API returning 401/403.
*Proof:* `auth.test.jsx` "a customer opening /admin by URL gets /unauthorized (403), not /login (401)" and "THE LESSON: a customer calling the admin API directly is refused by the SERVER (403)". *Angular:* functional `roleGuard()` (`auth.spec.ts`).

**Q: Where do you store tokens? Defend it.**
The session (access + refresh token) is in `localStorage`, so it survives reloads and is shared by tabs. The risk is XSS: any script can read it. The mitigations are a **15-minute** access token, refresh **rotation with reuse detection**, a strict **CSP** (`script-src 'self'`), and no raw HTML. The alternative is an httpOnly cookie for the refresh token: safer against XSS, but you then need CSRF protection and SameSite care. Say the trade-off; don't claim one is free.
*In this repo:* `services/session.js` (the comment lists the options).

**Q: How does silent refresh work, and what's "single-flight"?**
On a 401 for a request that *had* a token: refresh once, retry with the new token. If five requests fail together, they **share one** refresh call. Otherwise the second refresh would use a refresh token already rotated by the first, which the server sees as **reuse** and responds by revoking the session.
*Proof:* `refresh.test.jsx` "SINGLE-FLIGHT: five requests failing together share ONE refresh call". A 401 *without* a token (wrong password) never refreshes. *Angular:* `refresh.spec.ts`; the refresh uses `HttpBackend` so it skips the interceptors (no loop).

**Q: The URL as state, why?**
Filters, search and page live in the query string (`?category=pizza&q=…&page=2`). A deep link reproduces the screen, Back works, and nothing is lost on reload. *Proof:* `routing.test.jsx` "a deep link with filters renders those exact results". *Angular:* query params bound as component inputs (`withComponentInputBinding`).

## 4. Redux vs Context

**Q: When would you choose Redux Toolkit over Context?**
Context is a *transport*: it passes a value down. Redux is a *state container*: one store, pure reducers, actions you can log and replay, DevTools, middleware, and selectors so components re-render only for the slice they read. Choose Redux when many unrelated components read and write shared state (cart, auth), or when you need predictability and debugging. Choose Context for small, rarely-changing values.

**Q: What does Immer do in `createSlice`?**
It lets you "mutate" a draft, and produces a new immutable state. Reducers stay pure. *Proof:* `redux.test.jsx` "state + action -> new state, without touching the old one (Immer)".

**Q: How do you reset state on logout?**
`extraReducers` in each slice listen for `auth/loggedOut`, so the cart doesn't know about auth, but reacts to it. *Proof:* `redux.test.jsx` "RESETS ON LOGOUT". *Angular:* `cart.spec.ts` "RESETS ON LOGOUT".

**Q: Thunks?**
`createAsyncThunk` dispatches pending → fulfilled/rejected. Keep errors serialisable (plain messages). *Proof:* `redux.test.jsx` "authSlice: createAsyncThunk lifecycle".

## 5. RTK Query

**Q: What does RTK Query give you over `useEffect` + `fetch`?**
A cache keyed by endpoint + arguments, de-duplication (two components share one request), loading/error flags, refetch on invalidation, prefetching and optimistic updates, with no hand-written "reload" code.
*Proof:* `rtkQuery.test.jsx` "two components asking for the same data share ONE request", "PREFETCHES page 2".

**Q: Explain tags.**
Queries `provide` tags (`{type:'Destination', id}`, plus a `LIST` tag). Mutations `invalidate` them. Adding an item invalidates `LIST`, so the list refetches. Deleting invalidates the item and `LIST`.
*Proof:* `rtkQuery.test.jsx` "adding invalidates LIST". Admin products/orders use the `AdminProduct`/`AdminOrder` tags (`store/api/adminApi.js`). *Angular:* a version signal read inside `httpResource` (`admin-api.ts`).

**Q: Optimistic update, and what if it fails?**
`onQueryStarted` patches the cache immediately and **undoes** the patch if the request fails. *Proof:* "OPTIMISTIC ROLLBACK: if the server refuses, the checkbox goes back".

## 6. .NET Web API

**Q: Walk through the middleware pipeline.**
Forwarded headers → correlation id → security headers → request log → exception handler → HSTS/HTTPS → compression → static files → CORS → rate limiter → authentication → authorization → controllers. The order matters. CORS runs before auth so a 401/403 still carries CORS headers the browser can read. Forwarded headers run first so the logs and rate limiter see the real client IP. *In this repo:* `server/Server.Api/Program.cs`.

**Q: DI lifetimes, and the classic bug?**
Singleton (one per app), scoped (one per request: `DbContext`), transient (new each time). The bug is a **captive dependency**: a scoped service inside a singleton lives forever, so one `DbContext` gets shared across requests. Development scope validation catches it. *Proof:* `ScopeValidation_CatchesACaptiveDependency`.

**Q: How are errors returned?**
There's one envelope: `ApiResponse<T>` with `success`, `data`, `errors` and per-field `fieldErrors`. Validation 400s come from `InvalidModelStateResponseFactory`. Unhandled exceptions → `GlobalExceptionHandler` → a 500 with a reference id and **no stack trace**. *Proof:* `UnhandledException_Returns500Envelope_WithReference_AndNoInternals`.

**Q: What is over-posting?**
A client sends fields you didn't intend to accept (`"id": 99`, `"price": 0.01`, `"role": "Admin"`). The defence is input **DTOs** that contain only what the client may set. *Proof:* `Place_IgnoresEverythingButIdsAndQuantities_NoOverPosting`, `IgnoresAnyPriceTheClientTriesToSend`.

**Q: Why log with a correlation id?**
One id per request: in the response header, in every log line's scope, and shown to users on errors. A support ticket's id finds the exact server logs. *Proof:* `RequestLog_IsStructured_AndCarriesTheCorrelationScope`; the clients read the id from the exposed header.

## 7. EF Core, Identity, JWT

**Q: How do you avoid N+1 queries? Prove it.**
Project with `Select` into DTOs (or `Include`), and use `AsNoTracking` for reads. The test **counts SQL commands**. *Proof:* `ProductList_IsTwoQueries_CountAndOnePage_NoMatterHowManyRows`, `CartPricing_IsOneQuery_ForAnyNumberOfLines`.

**Q: Optimistic concurrency?**
A `rowversion` column. The client sends back the version it loaded; EF adds `WHERE RowVersion = @original`. If 0 rows change, EF throws `DbUpdateConcurrencyException`, which becomes a **409**. The UI shows "someone else changed this" and refetches. *Proof:* `Update_WithAStaleRowVersion_Is409_AndNothingIsOverwritten`; admin 409 tests in React and Angular.

**Q: Soft delete?**
`IsActive` plus a **global query filter**: deleted products vanish from every query, but past orders keep their lines. *Proof:* `Delete_IsSoft_HiddenByTheGlobalQueryFilter_ButStillInTheDatabase`.

**Q: Snapshot pricing: why copy the price into the order?**
An order is a historical record. Repricing a product must not change what someone already paid. `OrderDetail` stores `ProductName` and `UnitPrice`. *Proof:* `Snapshot_ARepricedProduct_DoesNotChangeAnExistingOrder`.

**Q: What does Identity give you?**
Password hashing (never plain text), lockout (5 failures → 5 minutes), unique emails, roles. *Proof:* `Register_CreatesACustomer_AndSignsIn_AndStoresOnlyAPasswordHash`, `Lockout_AfterFiveWrongPasswords_EvenTheRightPasswordIsRefused`.

**Q: What must JWT validation check?**
Signature (with a pinned algorithm, HS256, which refuses `alg: none`), issuer, audience and lifetime (30 s clock skew, not the default 5 minutes). Also a signing key of at least 32 bytes, from secrets. *Proof:* `TamperedPayload_PromotingMyselfToAdmin_Is401`, `UnsignedAlgNoneToken_Is401`, `TokenSignedWithAnotherKey_Is401`, `WrongIssuerOrAudience_Is401`, `ExpiredToken_Is401`, `AShortSigningKey_StopsTheAppAtStartup`.

**Q: Refresh tokens: storage and rotation?**
They're random, stored only as a **SHA-256 hash** (so a DB leak doesn't leak usable tokens), and single-use: each refresh issues a new pair. Presenting an already-used token means theft, so **every** session of that user is revoked. *Proof:* `Refresh_RotatesBothTokens`, `ReusingAnOldRefreshToken_RevokesTheWholeSession`.

## 8. System design

**Q: Design the order flow.**
Clarify (guest checkout? payment?). The client sends `{productId, quantity}` only. The server loads current prices, merges duplicate lines, rejects unavailable products, snapshots name/price, computes the total and saves the header + details in **one** `SaveChanges`, which is one transaction. Status is a state machine (`Pending → Confirmed → Ready → Completed`, cancel before completion), and `allowedNextStatuses` is sent to the UI so the client never duplicates the rules. A rating is allowed only on a Completed order's own lines, 1–5. *Proof:* `OrdersTests` (the whole file) and `TheWholeShop_FromSignUpToRating`.

**Q: How would this scale?**
The API is stateless (JWT), so you can run N instances behind a load balancer. The things that are *not* stateless yet: the in-memory rate limiter is per instance (move it to Redis or the gateway), and uploaded images live on a disk volume (move them to blob storage + a CDN). Readiness checks take a sick instance out of rotation. Add read caching for the catalogue only once it's measured.

## 9. Debugging scenario

**Q: "It works on my machine but production returns 500." Your steps?**
1. Get the **correlation id** from the error message the user sees.
2. Search the JSON logs for it: the exception and the request.
3. Check config differences first: connection string, signing key, CORS origins. The app fails fast at startup for most of these, so a running app usually means a *data* or *environment* issue.
4. Reproduce with a failing **test**, then fix it, and keep the test.
This project's own incident is a good story: an eager config read made the tests use the *development* database and delete it. The fix was lazy config, a name-guard (`GuardedDb`) and a regression test (`TheAppUsesTheThrowawayTestDatabase`). It's documented in `docs/phase-11-efcore.md`.

## 10. Deployment

**Q: How is this deployed?**
Containers: SQL Server, a one-shot **migration bundle**, the API (non-root, port 8080, not published), and nginx for each client. nginx serves the SPA with an `index.html` fallback and proxies `/api` and `/images`, so it's one origin and needs no CORS. Secrets come from environment variables (a git-ignored `.env`). CI builds, tests against a real SQL Server, audits dependencies, produces an idempotent migration script and builds the images. *In this repo:* `docker-compose.yml`, `server/Dockerfile`, `.github/workflows/ci.yml`. *Proof:* `npm run drill -- deployment`.

**Q: Why not run migrations on app start?**
With several instances they race. A failed migration crash-loops every instance. And production schema changes deserve review. So run them as a release step: a bundle, or a reviewed idempotent script.
