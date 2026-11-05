# RedStarVibe — Full-Stack E-Commerce

Built one feature at a time, in three projects:

| Folder | Stack | Dev URL |
| --- | --- | --- |
| `server/` | .NET 10 Web API, EF Core, SQL Server, xUnit | http://localhost:5240 (Scalar: `/scalar`, health: `/health`) |
| `client-react/` | React 19 + Vite (Redux Toolkit / RTK Query come later) | http://localhost:5173 |
| `client-angular/` | Angular 21 (standalone, signals, Vitest) | http://localhost:4200 |

The roadmap is in [plan.md](plan.md). Mistakes and fixes go in [NOTES.md](NOTES.md).

## Phase guides
- [Phase 1: Modern JavaScript (JS / TS / C#)](docs/phase-01-modern-js.md)

## Prerequisites
Node LTS, .NET 10 SDK, `dotnet-ef`, Angular CLI, and SQL Server instance `DESKTOP-2ERCDGB\MSSQLSERVER01` (Windows auth).

## Run
```bash
# API
cd server && dotnet run --project Server.Api --launch-profile http

# React
cd client-react && npm install && npm run dev     # copy .env.example to .env first

# Angular
cd client-angular && npm install && npm start
```

## Test
```bash
cd server && dotnet test
cd client-react && npx vitest run
cd client-angular && npm test -- --watch=false
```

## Config and secrets
- Dev connection string: `server/Server.Api/appsettings.Development.json`. It uses Windows auth, so it holds no password.
- CORS origins: `Cors:AllowedOrigins` in appsettings, or override with env vars such as `Cors__AllowedOrigins__0`.
- JWT key (Phase 12): kept in `dotnet user-secrets`, never in Git.
