# Phase 7: Routing (Project 3: Product Filter)

**Goal:** real URLs for every page, nested layouts, a product filter whose state lives **in the URL**, a detail page by id, and a 404. Plus why deep links break on a static host, and the fix.

## What was built

| Piece | React (React Router 8) | Angular (Router) | Backend |
| --- | --- | --- | --- |
| Route tree | `App.jsx` → `AppRoutes` | `app.routes.ts` (lazy `loadComponent`) | — |
| Router | `<BrowserRouter>` in `main.jsx`, `<MemoryRouter>` in tests | `provideRouter(routes, withComponentInputBinding())` | — |
| Shell | `Layout.jsx` → `<Outlet />` | `layout.ts` → `<router-outlet />` | — |
| Nav | `<NavLink>` (adds `aria-current`) | `routerLink` + `routerLinkActive` + `ariaCurrentWhenActive` | — |
| Nested layout | `pages/products/ProductsLayout.jsx` | `features/products/products-layout.ts` | — |
| Filters in URL | `useSearchParams` | query params bound to `input()`s + `router.navigate([], { queryParamsHandling: 'merge' })` | `GET /api/products?category=&search=&sort=` |
| Detail by id | `useParams()` | `id = input.required<string>()` | `GET /api/products/{id}` |
| 404 | `path="*"` → `NotFoundPage` | `path: '**'` → `NotFound` | 404 envelope |
| Page title | React 19 `<title>` in each page | route `title` + the `Title` service | — |
| SPA fallback | `public/_redirects`, `vercel.json` | `public/_redirects`, `vercel.json` | — |

Route paths live in `constants/routes.js` (React). Categories come from `GET /api/categories`.

## The URL is the state
```
/products?category=pizza&q=paneer&sort=priceDesc
```
- **Refresh** gives the same results, **share the link** and the other person sees the same results, and **Back** restores the previous filters.
- The filters are **not** in `useState`. Changing a filter means navigating to a new URL; the page reads the URL and loads.
- Changing one filter keeps the others: build from the current params (React), or use `queryParamsHandling: 'merge'` (Angular).
- Typing in search updates `?q=` after a 300 ms pause, with `replace: true` / `replaceUrl: true` so there's no history entry per pause.
- **Back to results:** the list passes `state={{ from }}` / `[state]`, and the detail page links back to that exact URL. A pasted link has no state, so it falls back to `/products`.

## Route tree (React)
```
<Layout>                      header, footer, <Outlet/>
  /                HomePage   (index route)
  /products        ProductsLayout  (sidebar + <Outlet/>)
     (index)       ProductListPage     ?category&q&sort
     :id           ProductDetailPage
  /students /directory /contacts /playground
  *                NotFoundPage   (catch-all: last)
```

## Why a deep-link refresh 404s in production (shown live)
The same `dist/` folder, served two ways:
```
Plain static server (no fallback):      vite preview (SPA fallback):
  GET /             -> 200                GET /             -> 200 index.html
  GET /products/4   -> 404                GET /products/4   -> 200 index.html
```
Clicking a `<Link>` never asks the server for anything; the router just changes the page. But **refresh** or a **pasted link** makes the browser request `/products/4` from the server, and there's no such file. **Fix:** configure the host to serve `index.html` for every unknown path, so the router takes over: `_redirects` (Netlify), `vercel.json` (Vercel), `try_files $uri /index.html` (nginx, used in Phase 15). API routes (`/api/...`) must be excluded so they still reach the API.

## Bugs the tests caught
- **React: a side effect during render.** My first draft wrote the debounced search to the URL from the render body (`queueMicrotask(...)`). Typing is an **event**, so the debounce now lives in `onChange` with a `useRef` timer, cleared on unmount.
- **Angular: a string in `[routerLink]` encodes `?`.** `[routerLink]="'/products?category=pizza'"` became `/products%3Fcategory%3Dpizza` (a 404). Pass a `UrlTree` (`router.parseUrl(...)`), or use `[queryParams]`.
- **Angular: `withComponentInputBinding` wipes input defaults.** For a routed component, every input with no matching route param is set to `undefined`, so `input('Page not found')` lost its default. Apply defaults in a `computed`.
- **Angular: `linkedSignal`** keeps the search box writable while typing, but resets it when `?q` changes from outside (Back, Clear). React needed a small `{ forUrl, value }` trick for the same thing.

## Backend notes
- `sort` binds to an `enum ProductSort { Name, PriceAsc, PriceDesc }`, so `?sort=price;DROP TABLE` gets a **400** on the `sort` field. Never pass sort strings into a query.
- Category is matched by **slug** (`pizza`), not id: readable, stable URLs.

## Checkpoint: answer these out loud before Phase 8

**Q1. `Link` vs `<a>`?**
A plain `<a href>` makes the browser do a **full page load**: it downloads `index.html` and the JavaScript again, and **all in-memory state is lost** (form drafts, the theme, and later the Redux store). `<Link>` (and `routerLink`) stops that default, calls `history.pushState`, and lets the router render the new route in place. It's instant and keeps state. It still renders a real `<a href>`, so middle-click, "open in new tab" and accessibility all keep working. Use `<a>` only for external sites or downloads.

**Q2. Why does a deep-link refresh 404 in production?**
The routes exist only **in the browser's JavaScript**. On refresh, the browser asks the **server** for `/products/4`, and a static host looks for that file, finds nothing and returns 404 before your app even loads. Configure an **SPA fallback** (serve `index.html` for unknown paths). The router then reads the URL and renders the right page. The dev server already does this, which is why the problem only shows up after deployment.

**Self-check:**
- Why is the category in the query string and the id in the path?
- What does `replace: true` change in the browser history?
- Why does `ProductDetailPage` validate `id` before calling the API?
- Why must the `*` / `**` route be last (Angular), and why doesn't order matter as much in React Router?
- What would break if the SPA fallback also caught `/api/*`?
