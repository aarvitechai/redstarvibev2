# Phase 11: .NET 10 Web API + EF Core (Project 6: Product API)

**Goal:** move the catalogue from in-memory lists to **SQL Server** with EF Core. That means migrations, seeding, DTOs, fast reads with no N+1, paging, soft deletes, optimistic concurrency, and image upload, all tested against a **real** database.

## Setup (once per machine)
```bash
dotnet tool install --global dotnet-ef          # already installed here
cd server
ASPNETCORE_ENVIRONMENT=Development dotnet ef database update --project Server.Api   # creates RedStarVibeDb + seed data
```
`dotnet ef` builds the app to find the `DbContext`, so it needs the Development settings (the connection string is in `appsettings.Development.json`). Windows PowerShell: `$env:ASPNETCORE_ENVIRONMENT='Development'; dotnet ef database update --project Server.Api`.

Adding a migration later: `dotnet ef migrations add <Name> --project Server.Api --output-dir Data/Migrations`, then **read the generated file** before applying it.

## What was built

| Piece | File |
| --- | --- |
| Entities | `Models/Entities/CatalogEntities.cs` (`Category`, `Product` with `RowVersion`, `IsActive`) |
| Mapping rules | `Data/Configurations/CatalogConfigurations.cs` (lengths, `decimal(10,2)`, indexes, a unique slug, `Restrict` delete, the global query filter, `HasData` seed) |
| DbContext | `Data/ApplicationDbContext.cs` (scoped, `ApplyConfigurationsFromAssembly`) |
| Migration | `Data/Migrations/*_InitialCatalog.cs` |
| Public reads | `Services/ProductCatalog.cs` (`EfProductCatalog`: projection, `AsNoTracking`, paging) |
| Admin writes | `Services/ProductAdminService.cs` (create, update with concurrency, soft delete, image) |
| Uploads | `Services/ProductImageStore.cs` (magic-byte check, random names, folder outside the code) |
| Endpoints | `GET /api/products` (now **paged**), `GET /api/products/{id}`, `GET /api/categories`, `/api/admin/products` (CRUD + `POST {id}/image`) |
| Health | `/health` now includes `AddDbContextCheck<ApplicationDbContext>()` |
| Tests | `ApiFactory.cs` (a throwaway SQL database per test class), `ProductsTests.cs`, `AdminProductsTests.cs` |
| Clients | the product list is paged (`?page=`), and products show images in React and Angular |

The admin **screens** come in Phase 14.5. For now, try the admin API in **Scalar** (`/scalar`) or `Server.Api.http`.

## Why DTOs (and never entities) over HTTP
- **Over-posting:** if a controller accepted a `Product`, a client could send `"isActive": false`, `"id": 1` or a new `categoryId`. `SaveProductDto` simply has no such fields.
- **Leaking internals:** an entity carries columns the client shouldn't see (`RowVersion` on public pages, future cost prices).
- **Cycles:** `Product.Category.Products[0].Category...` breaks JSON serialisation.
- **Stable contract:** you can rename a column without breaking every client.

The public `ProductDto` and the admin `AdminProductDto` are **two different views of one entity**.

## Fast reads
| Technique | Where | Why |
| --- | --- | --- |
| `AsNoTracking()` | every read | no change-tracker overhead for data you won't save |
| **Projection** (`Select(ToDto)`) | `EfProductCatalog.ToDto` | selects only the needed columns; `p.Category.Name` becomes one JOIN |
| `WHERE Id IN (...)` | cart pricing (`GetByIdsAsync`) | one query instead of one per cart line |
| `COUNT` + `OFFSET/FETCH` | paging | two queries, however many rows exist |
| Indexes | `(IsActive, CategoryId)`, `Name`, `Price`, unique `Slug` | filter and sort without scanning the table |

**N+1, proven by a test:** a `DbCommandInterceptor` counts SQL commands. The product list is **2** commands for 11 products, and pricing an 11-line cart is **1** command. With a loop calling `GetByIdAsync` it would have been 11.

`Include()` is for loading **entities with their related entities** (for example, an order with its lines in Phase 13). When you project to a DTO, the projection already joins what it reads.

## Writes
- **Tracked updates:** load without `AsNoTracking`, change properties, `SaveChangesAsync()`. EF sends `UPDATE` for the changed columns only.
- **Optimistic concurrency:** `RowVersion` is a SQL `rowversion`, changed on every update. The client sends back the version it loaded, and EF adds `WHERE RowVersion = @original`. If 0 rows change, it throws `DbUpdateConcurrencyException`, and the API returns **409**. A test: two admins load v1, the first saves (200), the second is refused (409), and the first admin's price survives.
  - **Live lesson:** an image upload also changes the row, so it creates a new `rowVersion`. A client must always save with the version from its **latest** response, or it will (correctly) get a 409.
- **Soft delete + global query filter:** `HasQueryFilter(p => p.IsActive)` adds `WHERE IsActive = 1` to **every** product query, so a deleted product can't leak into the shop. Admin code opts out with `IgnoreQueryFilters()`. The row stays, because Phase 13 orders may reference it.
- **`ExecuteUpdateAsync`:** a set-based `UPDATE ... WHERE` with no SELECT first (used by the soft delete).

## Uploads (untrusted input)
- The **size** is limited twice: `[RequestSizeLimit]` (rejects a huge body before it's read) and a 2 MB check.
- The **type is checked by magic bytes** (JPEG `FF D8 FF`, PNG `89 50 4E 47…`, WebP `RIFF…WEBP`). A test uploads text named `script.png` with `image/png` and gets 400.
- A **random file name** (`<guid>.png`), so a client name like `../../evil.png` never touches the path.
- Stored in `uploads/products` (git-ignored, outside the code), served only at `/images/products`, with `Cache-Control: immutable`. Replacing an image deletes the old file.

## DI lifetimes
| Lifetime | One instance per… | Used for |
| --- | --- | --- |
| Singleton | the whole app | in-memory stores (with a lock), `TimeProvider`, the image store |
| **Scoped** | HTTP request | **`DbContext`** and every service using it (`EfProductCatalog`, `EfProductAdminService`) |
| Transient | each injection | small stateless helpers |

**Captive dependency:** a singleton that holds a scoped `DbContext` would keep one request's context forever and share it between concurrent requests, and `DbContext` isn't thread-safe. ASP.NET Core's scope validation catches this at startup in Development, and a test shows the exact error.

## Test databases, and an incident while building this phase
`ApiFactory` gives **each test class its own database** (`RedStarVibeDb_Test_<guid>`), creates it with the **real migrations**, and deletes it afterwards.

**What went wrong:** the first version overrode the connection string with `ConfigureAppConfiguration`, but `Program.cs` read it **eagerly**, at the top of the file, before the override was applied. The tests ran against the **development** database, and the cleanup's `EnsureDeleted()` dropped it. (It held only seed data and was recreated from the migration.)

**Fixes:**
1. Read configuration **lazily**: inside `AddDbContext((services, options) => ...)`.
2. A **guard** before any destructive call: refuse unless the database the `DbContext` **actually** uses starts with `RedStarVibeDb_Test_`.
3. A regression test (`ApiFactorySafetyTests`) and an entry in `NOTES.md`.

**Rule:** verify the target before `EnsureDeleted`, `DROP` or `DELETE`. Never assume it.

## Checkpoint: answer these out loud before Phase 12

**Q1. Why DTOs?**
They're the API's public contract, separate from the database. They prevent **over-posting** (clients can only set the fields the DTO has), avoid leaking internal columns, avoid JSON cycles from navigation properties, allow different views of the same data (public vs admin), and let the database change without breaking clients.

**Q2. What do migrations do?**
A migration is generated C# describing how to move the schema from one model version to the next (`Up`), and back (`Down`). EF compares your model with the last snapshot to generate it. `database update` applies the pending migrations and records each one in `__EFMigrationsHistory`, so every environment ends up with the same schema, in the same order, from version control. Seed data from `HasData` is part of the migration. In production, apply migrations as a **controlled deployment step** (a reviewed SQL script or a migration bundle), not automatically on every app start.

**Q3. The three DI lifetimes?**
**Singleton:** one instance for the app's lifetime; it must be thread-safe. **Scoped:** one per request, which is right for `DbContext` (not thread-safe, and it caches the entities it loads). **Transient:** a new instance per injection, for lightweight stateless services. Never inject a shorter-lived service into a longer-lived one (a captive dependency).

**Self-check:**
- Why does the product list need exactly two SQL commands?
- What would happen without `.ThenBy(p => p.Id)` when paging?
- Why does a soft-deleted product disappear from `/api/products` without any `WHERE` in the service code?
- Why does the API ignore the uploaded file's name and Content-Type?
- What does the `rowVersion` from a stale form cause, and why is that good?
