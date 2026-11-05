# Phase 14: Capstone (Projects 9 and 10)

All earlier phases come together as one app: the customer shop (browse, cart, checkout, my orders, ratings) and the admin app (products, images, orders), each built in **React** and **Angular** on the **.NET** API.

## What was built

| Step | Backend (.NET) | React | Angular |
|---|---|---|---|
| 14.1 Wiring | `EndToEndCheckpointTests`: one test covering the whole journey | — | — |
| 14.2 Auth | (Phase 12) | silent refresh; restore reads the token's own `exp` (`utility/jwt.js`, jwt-decode) | (Phase 12) |
| 14.3 Catalogue | (Phase 11) | (Phase 10/11) | (Phase 10/11) |
| 14.4 Cart → order | snapshot pricing (Phase 13) | (Phase 13) | (Phase 13) |
| 14.5 Admin products (Project 9) | `/api/admin/products` CRUD + image upload, RowVersion | `adminApi.js`, `AdminProductsPage`, `ProductFormDialog`, `Modal` | `admin-api.ts`, `admin-products-page.ts`, `product-form-dialog.ts`, `modal.ts` |
| 14.6 Toasts | — | react-toastify `<ToastContainer>` in Layout | `ToastService` + `<app-toasts>` (`core/ui/toast.ts`) |
| 14.7 Admin orders | `PUT /api/orders/{id}/status` with rowVersion, `allowedNextStatuses` | `AdminOrdersPage` | `admin-orders-page.ts` |
| 14.8 Polish | — | theme saved in localStorage, `ErrorBoundary`, lazy admin chunks, loading/disabled states | theme saved in `ThemeService`, lazy admin child routes, loading/disabled states |
| Run | root `package.json`: `npm run dev` starts all three with **concurrently** | | |

## Key ideas

**Admin only, at two levels.** `ProtectedRoute roles={['Admin']}` (React) and `roleGuard('Admin')` (Angular) keep customers out of the screens. That's only UX. What actually protects the data is `[Authorize(Roles = "Admin")]` on the API.

**Lazy loading.** The admin pages are separate chunks (`AdminProductsPage-*.js`, `admin-products-page` chunk) loaded through `React.lazy` + `<Suspense>` and `loadComponent`. Customers never download them.

**Optimistic concurrency, end to end.** The product and order DTOs carry `rowVersion`, and the form sends back the version it *loaded*. If someone else saved first, the API answers **409**. The UI then shows a toast, closes the form and refetches. Order status options come from the server's `allowedNextStatuses`, so the client never has to duplicate the status rules.

**File upload.** First a JSON `POST`/`PUT` for the product, then `POST /admin/products/{id}/image` with a `FormData` body. Never set `Content-Type` yourself: the browser adds the multipart **boundary**. The client checks type and size only for quick feedback. The server checks again, including the image's real bytes.

**Accessible modal.** `role="dialog"`, `aria-modal`, `aria-labelledby` on the title, focus moved to the first field, Escape to close, focus given back to the opener.

**Error boundary (React).** A class component with `getDerivedStateFromError`. A crash in one page shows "Something went wrong on this page" plus a *Try again* button, not a blank screen. It's keyed by pathname, so navigating away also resets it.

## Bugs the tests caught (worth remembering)

1. **The modal lost focus while typing (React).** The effect depended on `onClose`, a new inline function on every render, so it re-ran on every keystroke and its cleanup moved the focus. Fix: keep the latest callback in a ref, and run the effect once.
2. **Edit lost the product's category (React).** The `<select>` mounted before the categories had loaded, so it had no matching option and its value became `""`. Fix: render the form only when the categories are there, and prefetch them on the products page.
3. **Focus did nothing in Angular.** The form appears after the categories arrive, which is after the modal's `ngAfterViewInit`. Fix: a `viewChild` + `effect()` focuses the Name field as soon as it exists.
4. **Uploads hung the fetch mock.** In jsdom, reading a multipart `FormData` stream never finishes. The mock now skips multipart bodies and checks the `Content-Type` header instead.

## The end-to-end checkpoint

`server/Server.Tests/EndToEndCheckpointTests.cs` covers: register → admin creates a product and uploads its image → public search finds it → cart prices it on the server → place order → rating before *Completed* is rejected (400) → admin moves it Confirmed → Ready → Completed (each step with the latest rowVersion) → customer rates 5 → "my orders" shows only their order.

## Run it

```bash
npm run install:all
npm run db:update
npm run dev          # API :5240, React :5173, Angular :4200
npm test             # every suite
```
Seeded admin: see `IdentitySeeder` / User Secrets (Phase 12).

## Test totals at the end of Phase 14
Backend 148 · React 180 · Angular 140. All green; the dev database `RedStarVibeDb` was untouched (create_date checked before and after).
