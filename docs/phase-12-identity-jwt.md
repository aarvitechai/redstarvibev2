# Phase 12: Identity, JWT, Roles and CORS (Project 7: Auth API)

**Goal:** replace the Phase 8 demo auth with real authentication: users and hashed passwords in SQL Server (ASP.NET Core Identity), **signed** JWT access tokens, rotating refresh tokens, lockout, rate limiting and properly configured CORS. The clients keep the same login flow, plus a register page and silent token refresh.

## Setup (once per machine)
```bash
cd server/Server.Api
dotnet user-secrets set "Jwt:SigningKey" "<64 random bytes, base64>"   # already done on this machine
cd .. && ASPNETCORE_ENVIRONMENT=Development dotnet ef database update --project Server.Api    # Identity tables + roles
```
User Secrets live in your **Windows profile**, not in the repository. Production sets `Jwt__SigningKey` as an environment variable or reads it from Key Vault. A missing or short key **stops the app at startup**: `ValidateOnStart` plus `[MinLength(32)]`.

Demo accounts (Development only, created at startup when `Auth:SeedDemoUsers` is true): `admin@redstar.dev` / `Admin@123`, `asha@redstar.dev` / `Customer@123`.

## What was built

| Piece | File |
| --- | --- |
| User + refresh token entities | `Models/Entities/IdentityEntities.cs` |
| Identity tables, role seed (via migration), refresh token config | `Data/ApplicationDbContext.cs` (`IdentityDbContext`), `Data/Configurations/IdentityConfigurations.cs` |
| Migration | `Data/Migrations/*_AddIdentityAndRefreshTokens.cs` (only CREATEs plus the 2 roles) |
| JWT creation | `Auth/TokenService.cs` (`JwtOptions`, HMAC-SHA256, 15-minute tokens) |
| Register / login / refresh / logout logic | `Auth/AuthService.cs` |
| Endpoints | `Controllers/AuthController.cs`: `POST register`, `login`, `refresh`, `logout`; `GET me` |
| Wiring | `Program.cs`: `AddIdentityCore` (password and lockout rules), `AddJwtBearer` (validation), the rate limiter, lazy CORS |
| Dev users | `Auth/IdentitySeeder.cs` (refuses outside Development) |
| React | `services/tokenRefresh.js` (single-flight refresh), `apiClient.js` and `baseApi.js` (refresh then retry), `SessionWatcher.jsx` (proactive refresh), `pages/auth/RegisterPage.jsx` |
| Angular | `core/auth/session.ts` (refresh over `HttpBackend`), `core/http/interceptors.ts` (refresh then retry), `features/auth/register-page.ts` |

The Phase 8 demo auth (`Auth/DemoAuth.cs`) was **deleted**. The forged token that used to work (`demo.1.<exp>`) now gets **401**, shown both live and in a test.

## Authentication flow
```
register / login ──► { accessToken (JWT, 15 min), expiresAt, refreshToken (random, 7 days), user }
every request    ──► Authorization: Bearer <accessToken>   (added by an interceptor / prepareHeaders)
access expires   ──► 401 ──► POST /auth/refresh { refreshToken }      (ONE call, shared by every waiting request)
                         ◄── a NEW access token + a NEW refresh token (the old one is revoked: ROTATION)
                     retry the original request with the new token     (the user never notices)
refresh fails    ──► log out with "Your session has expired"
logout           ──► POST /auth/logout { refreshToken } (revoked on the server) + clear the client
```
Both clients also refresh **proactively**, a minute before expiry, so most requests never see a 401.

## The JWT, and the common mistakes this phase closes
A JWT is `header.payload.signature`. The payload is just base64, so **anyone can read it**: never put secrets in it. Nobody can **change** it without the key, because the signature would no longer match.

| Mistake | How it's closed | Test |
| --- | --- | --- |
| Weak or committed signing key | 64 random bytes in User Secrets; at least 32 characters enforced at startup | `AShortSigningKey_StopsTheAppAtStartup` |
| Not validating the signature | `ValidateIssuerSigningKey` | tampered payload, and another key: both 401 |
| Accepting `alg: none` | `ValidAlgorithms = [HS256]` | `UnsignedAlgNoneToken_Is401` |
| No expiry, or a long expiry | 15-minute tokens, `ValidateLifetime`, `ClockSkew` 30 s (the default is 5 minutes) | `ExpiredToken_Is401` |
| Not checking who issued it, or who it's for | `ValidateIssuer`, `ValidateAudience` | `WrongIssuerOrAudience_Is401` |
| Trusting a user id from the client | the user id comes from the token's `sub` claim only | `/auth/me` |

## Refresh tokens
- **Random, not a JWT.** It means nothing on its own, only as a row in the database.
- **Stored as a SHA-256 hash**, like a password. A database leak doesn't leak usable tokens.
- **Rotation:** every refresh revokes the old token and issues a new one (`ReplacedByTokenHash`).
- **Reuse detection:** if a *revoked* token comes back, someone copied it. Every session of that user is revoked, so both the user and the thief must log in again. A test covers this.
- **Single-flight on the client:** five requests that fail together share **one** refresh. Five separate refreshes would look like reuse and log the user out. Tests: React (5 requests → 1 refresh) and Angular (3 → 1).

## Identity
- **Password hashing:** PBKDF2 with a salt (the `AQAAAAIAAYag…` hashes you can see in `AspNetUsers`). A test checks that the stored hash doesn't contain the password.
- **Password policy:** at least 8 characters, with upper and lower case, a digit and a symbol. Errors come back per field (`fieldErrors.password`).
- **Lockout:** 5 wrong passwords lock the account for 5 minutes, even for the correct password (a test covers this).
- **The same message** for an unknown email and a wrong password ("Invalid email or password."), so attackers can't discover which emails exist.
- **Register always creates a Customer**: `"role": "Admin"` in the request body is ignored, because the DTO has no such field.
- **Roles come from the migration** (`Roles.Admin`, `Roles.Customer`, the same constants as `[Authorize(Roles = …)]`), so they exist in every environment. Demo users exist in Development only.

## Rate limiting and CORS
- **Rate limiting** (`[EnableRateLimiting("auth")]` on register, login and refresh): 10 attempts per minute per IP address, then **429 + `Retry-After: 60`** in the envelope. Other endpoints aren't limited. A dedicated test factory uses a limit of 3.
- **Middleware order:** `CorrelationId → RequestLog → ExceptionHandler → HTTPS → static images → CORS → RateLimiter → Authentication → Authorization → endpoints`. CORS comes before the limiter and auth, so 401, 403 and 429 responses still carry CORS headers and the browser can read them.
- **CORS preflight tests:** `OPTIONS` from `localhost:5173` and `localhost:4200` gets `Access-Control-Allow-Origin`, while `https://evil.example` gets **nothing**, and the browser blocks the call. That's the "trigger a CORS error on purpose" exercise. To see it in a browser, add a third client port that isn't in `Cors:AllowedOrigins` and watch the console error, then add the port to fix it.

## Lesson repeated (and fixed everywhere)
The rate limit was first read **eagerly** (`builder.Configuration.GetValue(...)` at the top of `Program.cs`), the same mistake that caused the Phase 11 database incident. The test override was ignored. It was harmless this time, but **every** setting is now read lazily (`AddOptions<T>().Configure<IConfiguration>(...)` or `BindConfiguration`): JWT, rate limit, CORS and the connection string. The only eager read left in `Program.cs` is a comment that explains why.

## Checkpoint: answer these out loud before Phase 13

**Q1. The JWT flow, end to end?**
The user sends their email and password to `/auth/login`. Identity checks the password hash (and lockout). The API signs a JWT containing `sub`, `name`, `role`, `iss`, `aud` and `exp` with its secret key, and returns it with a refresh token. The client stores both and sends `Authorization: Bearer <jwt>` with every request. On each request, the JWT bearer middleware checks the signature, issuer, audience and expiry, then builds `User` from the claims, and `[Authorize(Roles = "Admin")]` checks the `role` claim. When the token expires, the API answers 401, and the client swaps the refresh token for a new pair (rotation) and retries. Logout revokes the refresh token on the server.

**Q2. Why does middleware order matter?**
Each middleware sees the request only after the ones before it. **Authentication** must run before **Authorization**, or `[Authorize]` sees an anonymous user and rejects everyone. **CORS** must run before both (and before the rate limiter), so that 401, 403 and 429 responses carry the CORS headers; otherwise the browser hides the response and the app sees an unhelpful "network error". The **correlation id and exception handler** come first, so that even a crash has an id and an envelope.

**Self-check:**
- Why is the access token short (15 minutes) but the refresh token long (7 days)?
- What does the server do when it sees a revoked refresh token, and why?
- Why does the client need *single-flight* refresh?
- Why is the refresh token stored as a hash?
- What's the difference between 401 and 403, and what does each client do with them?
- Why do the Angular refresh and logout calls use `HttpBackend`?
