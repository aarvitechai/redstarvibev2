# RedStarVibe — Full-Stack E-Commerce

Built one feature at a time, in three projects:

| Folder | Stack | Dev URL |
| --- | --- | --- |
| `server/` | .NET 10 Web API, EF Core + SQL Server (`RedStarVibeDb`), xUnit | http://localhost:5240 (Scalar: `/scalar`, health: `/health`) |
| `client-react/` | React 19 + Vite + React Router + Redux Toolkit + RTK Query | http://localhost:5173 |
| `client-angular/` | Angular 21 (standalone, signals, Vitest) | http://localhost:4200 |

The roadmap is in [plan.md](plan.md). Mistakes and fixes go in [NOTES.md](NOTES.md).

## Phase guides
- [Phase 1: Modern JavaScript (JS / TS / C#)](docs/phase-01-modern-js.md)
- [Phase 2: React Fundamentals (Project 1, part 1)](docs/phase-02-react-fundamentals.md)
- [Phase 3: State and Events (Project 1, part 2)](docs/phase-03-state-and-events.md)
- [Phase 4: Hooks Beyond State](docs/phase-04-hooks-beyond-state.md)
- [Phase 5: Forms and React 19 Actions (Project 2: Contact List)](docs/phase-05-forms-and-actions.md)
- [Phase 6: Axios Service Layer](docs/phase-06-axios-service-layer.md)
- [Phase 7: Routing (Project 3: Product Filter)](docs/phase-07-routing.md)
- [Phase 8: Client-Side Auth](docs/phase-08-client-side-auth.md)
- [Phase 9: Redux Toolkit (Project 4: counter and cart)](docs/phase-09-redux-toolkit.md)
- [Phase 10: RTK Query (Project 5: Destination Manager)](docs/phase-10-rtk-query.md)
- [Phase 11: EF Core + SQL Server (Project 6: Product API)](docs/phase-11-efcore.md)
- [Phase 12: Identity, JWT, Roles and CORS (Project 7: Auth API)](docs/phase-12-identity-jwt.md)
- [Phase 13: Orders and Ratings (Project 8)](docs/phase-13-orders-ratings.md)
- [Phase 14: Capstone – Admin app, polish, one-command run (Projects 9 and 10)](docs/phase-14-capstone.md)

## Prerequisites
Node LTS, .NET 10 SDK, `dotnet-ef`, Angular CLI, and SQL Server instance `DESKTOP-2ERCDGB\MSSQLSERVER01` (Windows auth).

## Database (once, and after pulling new migrations)
```bash
npm run db:update        # from the repo root (same as: dotnet ef database update --project server/Server.Api -- --environment Development)
```
Tests create and delete their own `RedStarVibeDb_Test_*` databases; they never touch `RedStarVibeDb`.

## Run (one command)
```bash
npm run install:all      # once: root + client-react + client-angular
npm run dev              # API :5240 + React :5173 + Angular :4200, colour-coded output; Ctrl+C stops all three
```
Copy `client-react/.env.example` to `.env` first. Single apps: `npm run dev:api`, `npm run dev:react`, `npm run dev:angular`.

## Test
```bash
npm test                 # all three suites (or: npm run test:api / test:react / test:angular)
```

## Config and secrets
- Dev connection string: `server/Server.Api/appsettings.Development.json`. It uses Windows auth, so it holds no password.
- CORS origins: `Cors:AllowedOrigins` in appsettings, or override with env vars such as `Cors__AllowedOrigins__0`.
- Auth (Phase 12): ASP.NET Core Identity + JWT. Development demo accounts (seeded when `Auth:SeedDemoUsers` is true): `admin@redstar.dev` / `Admin@123`, `asha@redstar.dev` / `Customer@123`.
- JWT signing key: `cd server/Server.Api && dotnet user-secrets set "Jwt:SigningKey" "<64 random bytes, base64>"`. Never in Git; production uses the `Jwt__SigningKey` environment variable or Key Vault.

## Committing a phase
```bash
git add -A          # NEW files too (git commit -am skips them)
git commit -m "Phase N: ..."
git status          # must say: nothing to commit, working tree clean
```
