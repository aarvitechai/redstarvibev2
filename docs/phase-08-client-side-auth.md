# Phase 8: Client-Side Auth

**Goal:** log in and out, protect routes, show role-based UI, redirect back after login, avoid redirect loops, and **prove that none of this is security**. The API is the only real boundary.

## AuthN vs AuthZ
| | Question | Fails with | Where it lives |
| --- | --- | --- | --- |
| **Authentication** | *Who are you?* | **401 Unauthorized**: no, bad or expired token → go to `/login` | `DemoAuthHandler` (Phase 12: JWT bearer) |
| **Authorization** | *What may you do?* | **403 Forbidden**: logged in, wrong role → `/unauthorized` | `[Authorize(Roles = Roles.Admin)]` |

## What was built

| Piece | React | Angular | Backend |
| --- | --- | --- | --- |
| Login | `pages/auth/LoginPage.jsx` (`useActionState`) | `features/auth/login-page.ts` (Reactive Forms) | `POST /api/auth/login` |
| Session state | `context/AuthProvider.jsx` + `services/session.js` (moved to a Redux `authSlice` in Phase 9; `useAuth()` unchanged) | `core/auth/session.ts` (signals) | — |
| HTTP | `services/authApi.js` | `core/auth/auth.ts` (`AuthService`) | `GET /api/auth/me`, `GET /api/admin/summary` |
| Route protection | `components/auth/ProtectedRoute.jsx` | `authGuard`, `roleGuard(...)`, `guestOnlyGuard` | `[Authorize]` |
| 403 page | `pages/auth/UnauthorizedPage.jsx` | `features/auth/unauthorized-page.ts` | 403 envelope |
| Role names | `constants/roles.js` | `ROLES` in `auth.ts` | `Constants/Roles.cs` |
| Safe redirect | `utility/redirect.js` | `safeRedirect()` | — |

**Demo accounts (Development only):** `admin@redstar.dev` / `Admin@123`, `asha@redstar.dev` / `Customer@123`.

## Demo auth (DEVELOPMENT ONLY; replaced by Identity + JWT in Phase 12)
- The token is `demo.<userId>.<expiresUnix>`. It's **unsigned**, so anyone can forge one. A test and a live `curl` call both showed a hand-written admin token being accepted. This is the reason for **Phase 12**: a JWT carries a **signature** the server checks, so changing the payload breaks it.
- `Auth:DemoTokensEnabled` is `true` only in `appsettings.Development.json`, and the API **refuses to start** if it's enabled anywhere else.
- The auth scheme is always registered. With the flag off it authenticates nobody, so `[Authorize]` returns 401 instead of crashing.
- Phase 12 keeps the **same endpoints and response shapes**, so the clients won't change.

## Redirect after login, without loops
```
anonymous -> /account
   ProtectedRoute / authGuard: not logged in
   -> /login   (React: state.from = /account   Angular: ?returnUrl=/account)   replace: true
login succeeds -> safeRedirect(from) -> /account   (replace: true)
```
- **No loop:** visiting `/login` while logged in redirects straight away, `safeRedirect` never returns `/login`, and `replace: true` keeps the bounce out of history.
- **No open redirect:** `safeRedirect` accepts only same-site paths. `https://evil.example` and `//evil.example` (protocol-relative) both fall back to `/`.
- **401 vs 403:** a customer on `/admin` goes to `/unauthorized`, not `/login`. Logging in again wouldn't help them.

## Session lifetime
- Restored **before the first render or request**: `restoreSession()` in `main.jsx` (React), and in the `Session` constructor (Angular). An expired or corrupted saved session is discarded.
- **Auto-logout** fires exactly at `expiresAt` (a timer in an effect, cleaned up when the session changes).
- A **401 for a request that carried our token** (expired or revoked server-side) means logout, with the message "Your session has expired". A 401 **without** a token (a wrong password) must not trigger this. Both interceptors now check that, and tests cover it.

### Where to keep the token (trade-off)
| Storage | Survives reload | XSS can steal it | Needs CSRF protection |
| --- | --- | --- | --- |
| `localStorage` (used here) | yes | **yes** | no |
| memory only | no | harder | no |
| `httpOnly` cookie | yes | **no** | **yes** (SameSite / anti-forgery token) |

Whatever you choose: short-lived access tokens (Phase 12 adds refresh tokens), no `dangerouslySetInnerHTML` / `[innerHTML]` with user data, and a Content Security Policy.

## React vs Angular: one real difference
- **React:** `ProtectedRoute` is a component, so when the user logs out it **re-renders** and redirects by itself.
- **Angular:** guards run **only on navigation**. After a logout or expiry, `App` re-runs the current navigation (`onSameUrlNavigation: 'reload'`), and the guarded routes use `runGuardsAndResolvers: 'always'` so their guards check again.

## Bugs caught while building
1. **DI picked the wrong constructor.** Registering `TimeProvider` made DI choose `InMemoryContactService(TimeProvider)`, which skipped the seed data, so the contacts page would have been empty. The fix is a single constructor, plus a regression test.
2. **No scheme when disabled.** With demo auth off, `[Authorize]` would have thrown (500). The fix is to always register the scheme.
3. **Two redirects racing (React).** `AuthProvider` navigated to `/login` on a 401 while `ProtectedRoute` also redirected, and the "session expired" message got lost. The fix is to have one place redirect (`ProtectedRoute`), with the provider only recording `logoutReason`.
4. **Login 401 treated as an expired session.** A wrong password would have triggered the global "session expired" logout. The fix is to react only to a 401 for a request that sent a token.
5. **`<output>` is `role="status"`.** The test helper clashed with real status messages, so it became a `<span>`.

## Checkpoint: answer this out loud before Phase 9

**Why are protected routes only UX?**
Everything in the browser belongs to the user. They can open DevTools, edit the JavaScript, change `localStorage`, or skip the app and call the API with `curl`. A `ProtectedRoute` or guard only decides **which screen to show**. That's good UX (no broken pages, and a helpful redirect to login), but it protects **no data**. The data is safe only because the **API checks the token and role on every request** and answers 401 or 403. This phase proves it: the Account page's "call the admin API anyway" button skips the UI, and the server refuses with **403**. The Admin link was hidden; the *data* was protected by the server.

**Self-check:**
- What's the difference between a 401 and a 403, and where does each send the user?
- Why does the login error say "Invalid email or password" for both a wrong email and a wrong password?
- What makes `//evil.example` dangerous as a `returnUrl`?
- Why must the token be restored *before* the first render?
- Why could anyone become admin with the demo tokens, and what does a JWT signature change?
