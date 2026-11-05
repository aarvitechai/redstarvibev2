# Phase 15: Production Hardening

Plan section 7, item by item. ✅ = done and tested. 🟡 = prepared, but it needs something outside this repo (a cloud account, a registry, GitHub settings).

## Security

| Item | Where | Status |
|---|---|---|
| HTTPS only; HSTS | `UseHsts()` outside Development, `UseHttpsRedirection()`. Behind a TLS proxy, `X-Forwarded-Proto` tells the API the request was HTTPS | ✅ |
| Access token 15–60 min + rotating refresh | Phase 12 (`Jwt:AccessTokenMinutes` validated 1–60, rotation with reuse detection) | ✅ |
| Signing key never in Git | User Secrets locally; `Jwt__SigningKey` env var in Docker; startup fails if it's missing or shorter than 32 chars | ✅ |
| Validate issuer, audience, lifetime, key | `TokenValidationParameters`, `ValidAlgorithms = HS256`, 30 s clock skew | ✅ |
| `[Authorize]` on non-public endpoints | Phase 12/13, plus 401/403 tests | ✅ |
| CORS `WithOrigins`, before auth | **New:** `CorsSettings` validated at startup. No `*`, exact origins only (no path, no trailing slash), https outside Development | ✅ |
| DTO validation; upload type/size | Phase 5/11 (data annotations; magic-byte image check, 2 MB). nginx also rejects bodies over 3 MB | ✅ |
| Parameterised queries; no raw HTML | EF only. **New:** oxlint `react/no-danger` makes `dangerouslySetInnerHTML` a lint error | ✅ |
| Rate limiting on auth | Phase 12. **New:** correct behind a proxy (forwarded headers, below) | ✅ |
| Dependency audit | **New:** `npm run audit`, and in CI (fails on vulnerable NuGet packages or high npm advisories). Today: 0 found | ✅ |
| **New:** security headers | API: `SecurityHeadersMiddleware` (nosniff, `X-Frame-Options: DENY`, `CSP default-src 'none'`, `no-referrer`). Pages: `security-headers.conf` in nginx with a strict CSP (`script-src 'self'`) | ✅ |
| **New:** no server banner | Kestrel `AddServerHeader = false`, nginx `server_tokens off` | ✅ |
| **New:** first admin in production | `Auth:BootstrapAdmin:*` creates one admin only while none exists (demo users stay Development-only) | ✅ |

## Performance

| Item | Where | Status |
|---|---|---|
| Pagination | Phase 11 `PagedResult<T>` on products and orders | ✅ |
| `AsNoTracking`, no N+1, indexes | Phase 11 | ✅ |
| Lazy admin pages | Phase 14 (separate chunks in both builds) | ✅ |
| memo only where measured | Phase 4/10 notes | ✅ |
| `react-window` | Not needed: every list is paged at 10–20 rows. Reach for it only when one screen must render thousands of rows | ✅ (decision) |
| Image caching | Phase 11: `Cache-Control: immutable`, 7 days (random file names). nginx: hashed JS/CSS cached 1 year, `index.html` never cached | ✅ |
| **Response compression** | **New:** Brotli then gzip (`EnableForHttps`, see the BREACH note in `Program.cs`). nginx gzips the static files | ✅ |

## Reliability and observability

| Item | Where | Status |
|---|---|---|
| Consistent error shape | Phase 6 `GlobalExceptionHandler` + `ApiResponse` envelope (ProblemDetails for non-API routes) | ✅ |
| Structured logging + correlation id | Phase 6 (JSON console logs outside Development, `X-Correlation-Id`) | ✅ |
| `/health` + database check | **New:** `/health/live` (no dependencies: restart if failing), `/health/ready` (SQL Server: stop sending traffic if failing), JSON body without exception details, `no-store` | ✅ |
| React error boundary | Phase 14 | ✅ |
| 409 on conflict | Phases 11, 13, 14 | ✅ |

## Testing

| Item | Status |
|---|---|
| Vitest + RTL: ProtectedRoute, cart reducers, product list | ✅ (Phases 7–14) |
| xUnit: snapshot pricing, row-level access, rating rule | ✅ (Phase 13) |
| `WebApplicationFactory` 401/403/200 | ✅ (Phase 12) |
| CI blocks merge on failure | 🟡 `ci.yml` runs every suite. **You** switch on blocking: GitHub → Settings → Branches → rule for `main` → "Require status checks to pass" → `api`, `react`, `angular`, `docker` |

## Deployment

| Item | Where | Status |
|---|---|---|
| Client build + SPA fallback | `npm run build`. nginx `try_files … /index.html`. Netlify uses `public/_redirects` | ✅ |
| `VITE_API_URL` per environment | Docker build arg (default `/api`). Angular: `environment.ts` (prod) vs `environment.development.ts` | ✅ |
| API publish + Docker image | `server/Dockerfile`, multi-stage, runs as the non-root `app` user, uploads in a volume | ✅ (image build runs in CI) |
| Config by environment variables | `ConnectionStrings__DefaultConnection`, `Jwt__SigningKey`, `Cors__AllowedOrigins__0`, `ForwardedHeaders__Enabled`, `Auth__BootstrapAdmin__*`. Docker reads them from a git-ignored `.env` | ✅ |
| Migrations as a controlled step | The `migrate` image (EF **bundle**) runs once before the API in `docker-compose.yml`. CI also produces an **idempotent SQL script** (`artifacts/migrate.sql`) for a DBA to review. The API never migrates on start | ✅ |
| CI/CD | 🟡 CI: restore, build, test, audit, publish artifacts, build images. CD needs a registry and a target (Azure App Service, Container Apps…), which is a choice for you, not code |
| Monitoring and alerts | 🟡 The app provides JSON logs with correlation ids, plus `/health/live` and `/health/ready`. Alert rules live in the hosting platform (e.g. Azure Monitor on 5xx rate or failed readiness) |

## Key ideas

**One origin in production.** nginx serves the client *and* proxies `/api` and `/images` to the API container. The browser never makes a cross-origin call, so CORS isn't needed, and the API and database are not published to the host at all. That's also why the clients now support a **relative** API URL. React's `imageSrc` used to throw with `/api` (`new URL(x, '/api')` has no origin), and a test now covers it.

**Forwarded headers, trusted only when switched on.** Behind a proxy, every request seems to come from the proxy, so the rate limiter would put *all* users in one bucket. `X-Forwarded-For` fixes that, but only if the API is unreachable except through the proxy. Otherwise anyone can send a fake header and get a fresh bucket per request. Two tests show both sides. nginx *overwrites* the header with `$remote_addr`, and the API reads only the last hop (`ForwardLimit = 1`).

**Liveness vs readiness.** If the database is down, restarting every API container doesn't help, and it can turn a blip into an outage. Readiness takes the instance out of rotation; liveness alone decides restarts.

**Fail fast.** A wildcard CORS origin, an http origin in Production, a short JWT key or a missing connection string stops the app *at startup* with a message naming the setting. A misconfiguration should never become a half-working app.

**A strict CSP for the pages.** `script-src 'self'` means even injected markup can't run a script. Angular's critical-CSS inlining adds an inline `onload` handler that this CSP would block, so production builds set `inlineCritical: false`.

## Bug found while doing this phase

**The migration bundle couldn't start.** It creates the DbContext through the app's DI *before* applying its `--connection` argument, and `AddDbContext` threw when no connection string was configured. Now the registration tolerates a missing connection string, and the running API still fails fast (a test covers both). Verified by applying the bundle to a throwaway `RedStarVibeDb_Test_bundle_*` database (3 migrations, 13 tables, the second run a no-op), which was then dropped.

## Run it in containers

```bash
cp .env.example .env        # then edit the values
docker compose up --build   # React http://localhost:8081, Angular http://localhost:8082
```
Log in with `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`, then remove those two lines from `.env`.

## Test totals at the end of Phase 15
Backend 166 · React 183 · Angular 143. All green; the dev database `RedStarVibeDb` was untouched (create_date checked before and after), and no `RedStarVibeDb_Test_*` databases were left behind.
