# Scenario drills

Read the prompt, answer **out loud** using the five steps (clarify → data flow → trade-offs → security → testing), and only then read the model answer. Finish with `npm run drill -- <name>`: the tests that prove the answer, in all three stacks.

---

## 1. Slow list: `npm run drill -- slow-list`

> "The product list is slow. What do you check, in what order?"

**Clarify:** how slow, for whom, on which page size? Is it the first load or typing in search?

**Measure before fixing.** DevTools Network: is it the request or the rendering? Then work back to front:
1. **Database:** paging in SQL (`Skip/Take` + a count, so two queries, not "load all, page in C#"). Projection with `Select` (no N+1). `AsNoTracking`. Indexes on the filtered/sorted columns (`IsActive+CategoryId`, `Name`, `Price`). *Proof:* `ProductList_IsTwoQueries_CountAndOnePage_NoMatterHowManyRows` counts the SQL commands.
2. **Network:** Brotli/gzip compression (`JsonResponses_AreCompressed…`). Small DTOs, not entities.
3. **Client requests:** debounce search typing into one request, and cancel stale requests (`switchMap` / `AbortController`). Cache and de-duplicate (RTK Query), and prefetch the next page.
4. **Rendering:** only now consider `memo`/`useCallback` (measured), and virtualisation (`react-window`) only if one screen really shows thousands of rows. Here every list is paged at 10–20 rows, so it isn't needed.

**Trade-off to mention:** caching makes reads fast but data stale. Tags (next drill) are how you get both.

## 2. Stale table: `npm run drill -- stale-table`

> "An admin edits a product, but the table still shows the old value."

**Two different problems, so separate them:**
- **The client cache didn't refresh.** The mutation must invalidate what the table reads. RTK Query: `updateProduct` invalidates `{AdminProduct, id}` and `LIST`. Angular: bump the version signal that `httpResource` reads. No `window.location.reload()`, and no hand-written "fetch again" calls scattered around.
- **Another admin changed it meanwhile.** It's not stale display; it's a **lost update**. A `rowversion` makes the second save a **409**, nothing is overwritten, and the UI shows a toast and refetches. *Proof:* `Update_WithAStaleRowVersion_Is409_AndNothingIsOverwritten`; React/Angular "a 409 … toast … refetched".

**Bonus detail:** rows are keyed by `id + rowVersion`, so after a refetch the row (and its status dropdown) starts fresh instead of keeping old local state.

## 3. Security end to end: `npm run drill -- security`

> "What stops a customer from becoming an admin?"

Go layer by layer, and say **which layer actually enforces**:
1. **Login:** Identity hashes passwords, locks out after 5 failures, rate-limits the auth endpoints (429), and returns the same message for "no such user" and "wrong password" (no user enumeration).
2. **The token:** a signed JWT (HS256, pinned algorithm) with 15-minute expiry, validated issuer/audience/lifetime/signature. Editing `"role": "Admin"` into the payload breaks the signature → **401**. `alg: none` → 401.
3. **Every request:** `[Authorize(Roles = "Admin")]` on admin endpoints → **403** for customers. This is the real wall.
4. **Data access:** customers query only `WHERE UserId = me`, so guessing an order id returns nothing. Input DTOs prevent over-posting (no `price`, `userId` or `status` from the client).
5. **Sessions:** rotating refresh tokens, stored hashed. Reuse revokes every session.
6. **The browser:** CSP `script-src 'self'`, no raw HTML, short-lived tokens. These limit what an XSS bug can do.
7. **UI role checks:** convenience only. *Proof:* "THE LESSON: a customer calling the admin API directly is refused by the SERVER (403)".

## 4. `/admin` by URL: `npm run drill -- admin-url`

> "A customer types `/admin` into the address bar. What happens?"

1. nginx serves `index.html` (SPA fallback); this is a client route.
2. The router's guard (`ProtectedRoute` / `roleGuard`) sees a logged-in user without the Admin role → **`/unauthorized`** (403-style), not `/login`, because they *are* logged in. Sending them to `/login` creates a login loop.
3. The admin code is **lazy-loaded**, so the customer never even downloads it.
4. Even if they bypass all of that in DevTools, every admin API call returns **403**. That's where safety comes from.

## 5. CORS error: `npm run drill -- cors`

> "The browser says 'blocked by CORS policy', but Postman works."

CORS is a **browser** rule: a page from origin A may only read responses from origin B if B says so (`Access-Control-Allow-Origin`). Postman isn't a browser, so it doesn't care. CORS is **not** API security; it protects users' browsers.

**Diagnose:** look for the `OPTIONS` preflight in the Network tab. Common causes:
- The origin isn't listed: config `Cors:AllowedOrigins`. The scheme/port must match exactly, and there must be **no trailing slash**.
- `UseCors` is in the wrong place, so an error or 401 response has no CORS headers. The browser reports CORS when the real problem is auth.
- A custom header the JS needs isn't **exposed** (`X-Correlation-Id`).

**In this repo:** origins are validated at startup (no `*`, no paths, https outside Development). In production, CORS isn't needed at all, because nginx serves client and API on one origin. *Proof:* `CorsPreflight_OnlyAllowsTheKnownClients`, `A_Wildcard_CorsOrigin_StopsTheApp`.

## 6. Pagination: `npm run drill -- pagination`

> "Design paging for a list that grows to a million rows."

- **API shape:** `?page=&pageSize=` (validated: page ≥ 1, pageSize 1–50) → `{ items, page, pageSize, totalCount, totalPages, hasNext, hasPrevious }`. Invalid values → 400 on that field.
- **Stable order:** always sort by something unique as a tiebreak (`… , Id`). Without it, rows can repeat or vanish between pages. *Proof:* `Paging_IsStable_AndCoversEveryItemExactlyOnce`.
- **SQL:** `OFFSET/FETCH` (Skip/Take) plus a `COUNT`, with an index on the sort column.
- **Client:** the page lives in the URL (`?page=2`), the next page is prefetched, and the cache is keyed by arguments.
- **Trade-off at a million rows:** deep `OFFSET` gets slow (the database still walks the skipped rows), and `COUNT` is costly. For "infinite scroll" feeds, use **keyset/cursor** paging (`WHERE (CreatedAt, Id) < (@lastDate, @lastId)`). It's fast at any depth, but you can't jump to page 500. Choose by UX.

## 7. Deployment: `npm run drill -- deployment`

> "How do you deploy this, and what changes between development and production?"

| | Development | Production |
|---|---|---|
| Config | `appsettings.Development.json`, User Secrets | environment variables / secret store; startup **fails** on a missing or bad value |
| DB | local instance, Windows auth | managed SQL; migrations as a **release step** (bundle or idempotent script) |
| Users | demo users seeded | demo seeding refused; one **bootstrap admin** from secrets |
| API docs | `/openapi`, `/scalar` | not mapped (404) |
| Hosting | `npm run dev` (3 dev servers, CORS) | containers; nginx serves the SPA + proxies `/api` → one origin |
| Transport | http on localhost | HTTPS at the proxy; HSTS; forwarded headers enabled |
| Logs | readable single-line | JSON, with correlation ids |
| Health | — | `/health/live` (restart), `/health/ready` (traffic) |

**Gotcha worth telling:** a relative API URL (`/api`) broke the React image helper (`new URL(x, '/api')` throws), and the migration bundle couldn't start because DbContext registration threw without a connection string. Both were found by *trying* the production shape, and both now have tests.

## 8. Out-of-sync state: `npm run drill -- out-of-sync`

> "The UI shows something the server disagrees with. How does this app prevent or repair it?"

- **The server is the source of truth for money.** The cart sends only ids + quantities; the server prices it, and the client's price is ignored (`IgnoresAnyPriceTheClientTriesToSend`). A cart change throws away the old quote.
- **Orders keep history.** A snapshot price means repricing never rewrites old orders.
- **Atomic writes.** One `SaveChanges` is one transaction: a failing line saves nothing.
- **Races in the client.** A stale response can't overwrite a newer one (abort / `switchMap`). Five parallel 401s share one refresh (single-flight).
- **Optimistic UI.** It updates first and **rolls back** on failure.
- **User changes.** Logout resets every user-specific slice (cart, cache).
- **Concurrent editors.** `rowversion` → 409 → refetch.
