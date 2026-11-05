# Phase 10: RTK Query (Project 5: Destination Manager)

**Goal:** server data with caching, de-duplication, automatic refetching through **tags**, pagination, optimistic updates, and one place for headers and 401s. Built on a real paged .NET API instead of json-server.

## What was built

| Piece | React (RTK Query) | Angular (`httpResource`) | Backend |
| --- | --- | --- | --- |
| Base | `store/api/baseApi.js`: `createApi`, `fetchBaseQuery`, `prepareHeaders`, a wrapper `baseQuery` | interceptors (Phase 6) | — |
| Endpoints | `store/api/destinationsApi.js` (`injectEndpoints`) | `features/destinations/destinations-api.ts` | `DestinationsController` |
| Page | `pages/DestinationsPage.jsx` | `destinations-page.ts` + `.html` | `GET /api/destinations?page&pageSize&search&visited` |
| Card / form | `components/destinations/*` | `destination-form.ts` | `POST`, `PUT /{id}`, `PUT /{id}/visited`, `DELETE /{id}` |
| Paging | `?page=` in the URL + `usePrefetch` for the next page | `?page=` bound as an input | `PageRequest` + `PagedResult<T>` |
| "Tags" | `providesTags` / `invalidatesTags` | a `version` signal read by every list resource | — |
| Optimistic | `onQueryStarted` + `updateQueryData` + `undo()` | `resource.update()` + `resource.set(snapshot)` | — |

Reads are public. Writes need login: `[Authorize]` on the class, `[AllowAnonymous]` on the reads, so a new endpoint is **protected by default**.

## Tags: how the UI stays in sync
```
getDestinations({page:1})  provides  [Destination:1 … Destination:6, Destination:LIST]
getDestinations({page:2})  provides  [Destination:7 … Destination:12, Destination:LIST]

addDestination     invalidates [LIST]                  -> both pages refetch (the new item could land anywhere)
updateDestination  invalidates [Destination:3, LIST]   -> the pages holding item 3 refetch
deleteDestination  invalidates [Destination:3, LIST]
setVisited         invalidates nothing                 -> it patches the cache optimistically instead
```
Components never call "reload". They use their query hooks; the mutation's tags tell RTK Query **which cached queries are stale**, and every mounted hook using them refetches. Tests prove it: add, then the list shows 15 items; delete, then 13 and the item is gone.

## RTK Query vs Axios + `useEffect`
| | Axios + `useEffect` (Phase 4–6) | RTK Query |
| --- | --- | --- |
| Loading / error state | your own `useState` | `isLoading`, `isFetching`, `error` |
| Race conditions | `AbortController` by hand | handled (the latest arguments win) |
| Two components, same data | two requests | **one** (de-duplicated by the cache key), as a test shows |
| Navigate away and back | refetch + spinner | **instant from the cache** (`keepUnusedDataFor`), as a test shows |
| After saving | "reload the list" code | **tags** refetch whatever is stale |
| Optimistic update | `useOptimistic` per component | `updateQueryData` on the **cache**, so every view updates |
| Prefetching | — | `usePrefetch` (the next page is ready before the click) |

Use RTK Query for **server state**, and slices (Phase 9) for **client state** such as cart, auth and theme.

## Plumbing
- **Register both** `api.reducer` (at `state.api`) and `api.middleware` in `configureStore`. Forgetting either is the plan's "common mistake"; without the middleware, queries never run.
- **`prepareHeaders`** reads the token straight from `state.auth`, so there's no separate token variable to keep in sync.
- **The wrapper `baseQuery`** unwraps the envelope, maps errors to one *serialisable* shape `{ status, message, fieldErrors }`, logs out on a 401 *for a request that carried a token*, and feeds the activity bar.
- **On logout**, `baseApi.util.resetApiState()` clears the cache, so the next user never sees the previous user's responses.
- **No import cycles:** `authSlice ← baseApi ← sessionActions`. The `logout` thunk moved into its own file so the imports point one way.
- **Angular:** `httpResource` re-requests when the signals it reads change (the query from the URL, and the API's `version`), and cancels the stale request. Its `value` is writable, which makes optimistic updates simple.

## Bugs caught while building
1. **MVC prefix binding:** a complex query parameter named `page` made `?page=2` bind to `page.Page`, so it **silently** used the defaults. Renamed to `paging`, and a test covers it.
2. **Rollback after a 401 crashed Immer:** the 401 handler reset the cache, and then `undo()` patched an entry that no longer existed. The fix is to undo only where the cached entry still exists.
3. **A test checked too early:** the optimistic patch *was* in the store, but React hadn't re-rendered yet. The test now waits, and also asserts that the mutation is still `pending`.
4. **A circular import (my first draft):** `authSlice` ↔ `baseApi`, patched with a dynamic `import()`. I replaced that hack with a cleaner module structure.

## Backend notes
- `PageRequest` validates `page ≥ 1` and `pageSize` 1–50 (no unbounded lists). `PagedResult<T>` adds `totalCount`, `totalPages`, `hasNext` and `hasPrevious`.
- Paging needs a **stable order** (name, then id), or an item can show up on two pages or none. A test walks all pages and checks each item appears exactly once.
- `Skip/Take` here becomes `OFFSET/FETCH` in SQL when EF Core takes over in Phase 11.

## Checkpoint: answer these out loud before Phase 11

**Q1. How do tags keep the UI in sync?**
Each query declares the tags its data **provides**: one per item, plus a `LIST` tag. Each mutation declares the tags it **invalidates**. When a mutation succeeds, RTK Query finds every cached query that provided an invalidated tag and refetches the ones still in use. So adding a destination (which invalidates `LIST`) refreshes every page of the list, wherever it's shown, without the component calling anything.

**Q2. RTK Query vs Axios + `useEffect`?**
Axios is a *transport*: you still write the loading and error state, cancellation, caching, de-duplication and "refresh after save" yourself, in every component. RTK Query is a *server-state cache*: it gives you those for free, shares one request between many components, keeps data between navigations, refetches by tags, and supports optimistic cache updates and prefetching. Axios (or `fetch`) still has its place for one-off calls; RTK Query fits whenever data is shown in more than one place or changes after mutations.

**Self-check:**
- What's the difference between `isLoading` and `isFetching`?
- Why does `setVisited` use `onQueryStarted` instead of `invalidatesTags`?
- Why does the add mutation invalidate `LIST` rather than one item tag?
- Why is the cache reset on logout?
- In Angular, which signal plays the role of a tag, and who bumps it?
