# plan.md: Production-Ready E-Commerce with React 19 and .NET 10 API

**Course:** The Complete Full Stack Bootcamp: Master React 19 with Redux Toolkit and hooks from scratch. Build 10 projects, including an e-commerce project (.NET 10 API, EF Core).

**Goal:** Learn the stack in order, build all 10 projects, and finish with a production-ready, deployed e-commerce application you can explain end to end.

---

## 1. Scope and Success Criteria

### Product scope (capstone)

| Role | Capabilities |
| --- | --- |
| **Visitor** | Browse catalog, search, filter by category, sort, view details |
| **Customer** | Register, log in, cart, checkout, view own orders, rate completed orders |
| **Admin** | Manage products (CRUD + image upload), view all orders, update order status |

### Definition of "production-ready"

- [ ] Every endpoint authorizes on the server; client checks are UX only
- [ ] Short-lived JWT access token plus refresh token, CORS restricted to known origins
- [ ] DTOs everywhere (no entities returned or accepted), server-side validation
- [ ] Pagination on all list endpoints, `AsNoTracking` on reads, no N+1 queries
- [ ] Automated tests (frontend and backend) running in CI
- [ ] Dockerised API, static-hosted client with SPA fallback, secrets outside source control
- [ ] Structured logging, health check endpoint, global error handling
- [ ] README with setup, architecture diagram and deployment steps

---

## 2. Tech Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19, Vite, React Router, Redux Toolkit, RTK Query, Axios (learning phase), react-hook-form, react-toastify, jwt-decode |
| Backend | .NET 10 Web API, EF Core, ASP.NET Core Identity, JWT Bearer, OpenAPI + Scalar |
| Database | SQL Server (Express/LocalDB for dev, managed SQL in production) |
| Testing | Vitest + React Testing Library, xUnit |
| DevOps | Git, GitHub Actions, Docker, Azure App Service (API), Vercel/Netlify (client) |

> Verify exact package versions when you scaffold (`npm outdated`, `dotnet list package --outdated`). Pin versions in lockfiles.

### Decisions on points where learning material disagrees

| Topic | Decision |
| --- | --- |
| Role names | Define constants once (`Roles.Admin`, `Roles.Customer`); reuse in seeding, token claims and `[Authorize]`. Case-sensitive. |
| CORS | `AllowAnyOrigin` only in local dev. Production uses `WithOrigins(<client URL>)`. `UseCors` runs before authentication. |
| JWT lifetime | Access token 15 to 60 minutes plus refresh token. A 7-day token is demo-only. |
| JWT decoding on client | `jwt-decode`. Decoding is not verifying; the server verifies. |
| Protected route | Use `useLocation()` and `<Navigate to="/login" state={{ from: location }} replace />`. |
| Server Components | Not used. This is a Vite SPA. |
| API responses | Return real HTTP status codes **and** an `ApiResponse` envelope. |
| Rating eligibility | Only the buyer, only when order status is `Completed`. One status name in the enum, used by API and UI. |
| Layering | Controller, then Service, then DbContext once logic grows beyond CRUD. |
| Forms | Actions (`useActionState`) for simple forms; react-hook-form for larger validated forms. |
| Router version | Check the installed version (v6 imports from `react-router-dom`, v7 from `react-router`). |

---

## 3. Architecture

```
Browser (React 19 SPA)
  Component -> RTK Query hook/mutation -> baseApi (prepareHeaders: Bearer JWT)
        |
        v   HTTPS
.NET 10 API
  Middleware: Exception handler -> CORS -> Authentication -> Authorization
  Controller (DTO in) -> Service -> EF Core -> SQL Server
  Response: ApiResponse + correct HTTP status
        |
        v
RTK Query cache (tags) -> mutation invalidates tags -> lists refetch
401 -> clear auth slice, redirect to login | 403 -> unauthorized page
```

### State ownership (frontend)

| Need | Tool |
| --- | --- |
| Local UI (input, modal) | `useState` / `useReducer` |
| Theme or small shared values | Context |
| App-wide client state (auth, cart, theme) | Redux Toolkit slices |
| Server data (products, orders) | RTK Query |
| URL-driven state (filters, page) | Router params / search params |

---

## 4. Repository Structure

```
fullstack-ecommerce/
├── plan.md
├── README.md
├── docker-compose.yml
├── .github/workflows/ci.yml
├── client/
│   ├── .env.example                # VITE_API_URL
│   └── src/
│       ├── pages/
│       ├── components/
│       ├── store/                  # slices + api (baseApi, productApi, orderApi, authApi)
│       ├── hooks/                  # custom hooks
│       ├── utility/                # auth helpers, formatters
│       ├── constants/              # routes, roles, statuses
│       └── tests/
└── server/
    ├── Server.Api/
    │   ├── Controllers/
    │   ├── Services/
    │   ├── Data/                   # ApplicationDbContext, Migrations, Seed
    │   ├── Models/                 # Entities
    │   ├── Models/Dto/
    │   ├── Middleware/
    │   └── Program.cs
    └── Server.Tests/               # xUnit
```

---

## 5. Domain Model and API Surface

### Entities

| Entity | Key fields |
| --- | --- |
| `ApplicationUser : IdentityUser` | `Name` |
| `Category` | `Id`, `Name` |
| `Product` | `Id`, `Name`, `Description`, `Price`, `Image`, `CategoryId`, `IsActive`, `RowVersion` |
| `OrderHeader` | `Id`, `UserId`, `Total`, `Status`, `CreatedAt`, `RowVersion` |
| `OrderDetail` | `Id`, `OrderHeaderId`, `ProductId`, `ProductName` (snapshot), `UnitPrice` (snapshot), `Quantity`, `Rating` |

### Endpoints

| Area | Endpoint | Access |
| --- | --- | --- |
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh` | Public |
| Products | `GET /api/products` (paged, filter, sort), `GET /api/products/{id}` | Public |
| Products | `POST`, `PUT /{id}`, `DELETE /{id}` (multipart for image) | Admin |
| Orders | `POST /api/orders` | Customer |
| Orders | `GET /api/orders/mine` | Customer (own only, from token claims) |
| Orders | `GET /api/orders` (paged) | Admin |
| Orders | `PUT /api/orders/{id}/status` | Admin |
| Ratings | `PUT /api/orders/{id}/details/{detailId}/rating` | Buyer, order `Completed` |
| Ops | `GET /health` | Public |

### Business rules

- **Snapshot pricing:** copy product name and price into `OrderDetail` at purchase time.
- **Transactional save:** header and details in one `SaveChangesAsync`.
- **Row-level access:** user id always comes from token claims, never from the request body.
- **Status flow:** `Pending -> Confirmed -> Ready -> Completed`, or `Cancelled`. Admin only.
- **Concurrency:** `RowVersion` on products and orders.

---

## 6. Learning and Build Roadmap

Time estimates assume focused study. Commit to Git after every phase. Each phase ends with a checkpoint you must pass before moving on.

### Project map (the 10 projects)

| # | Project | Phase |
| --- | --- | --- |
| 1 | Counter and Props (student cards, layout) | 2 to 3 |
| 2 | Contact List (add, edit, delete, favourite, Actions) | 5 |
| 3 | Product Filter with Router (params, nested layout, 404) | 7 |
| 4 | Redux Counter and cart slice | 9 |
| 5 | RTK Query Destination Manager (json-server) | 10 |
| 6 | Product (MenuItem) API: CRUD, EF Core, upload | 11 |
| 7 | Auth API: Identity, JWT, roles, CORS | 12 |
| 8 | Order and Rating API | 13 |
| 9 | Admin app (React) | 14.5 |
| 10 | Customer journey (React) | 14.6 to 14.7 |

### Phase 0: Environment and Tooling (about 0.5 day)

- Install Node LTS, VS Code, .NET 10 SDK, SQL Server Express/LocalDB, SSMS or Azure Data Studio, Git.
- `dotnet tool install --global dotnet-ef`; install React DevTools, Redux DevTools; set up Scalar/Postman.
- Create `client/` (`npm create vite@latest client`) and `server/` (`dotnet new webapi`).
- **Checkpoint:** both run without errors; you can explain the Vite template files.

### Phase 1: Modern JavaScript (about 1 day)

- `let`/`const`, arrow functions, destructuring, modules, spread/rest.
- `map`, `filter`, `find`, `reduce`, `some`, `every`; `sort` mutates, so copy first.
- Truthy/falsy (`{count && <X/>}` renders `0`), reference types, promises, `async/await`.
- **Practice:** immutable add/update/remove/toggle on a users array.
- **Checkpoint:** explain why `arr.push(x)` is wrong for state; `map` vs `forEach`.

### Phase 2: React Fundamentals (about 1 day)

- JSX rules, components, props (read-only, `children`), composition, virtual DOM, StrictMode.
- Default vs named exports; CSS Modules or Bootstrap.
- **Project 1 (part 1):** Student card list, Header/Footer/Layout.
- **Checkpoint:** props vs state; what StrictMode does.

### Phase 3: State and Events (about 2 days)

- `useState`, functional updates, immutable updates, conditional rendering, keys, lifting state, `useState` vs `useReducer`.
- **Project 1 (part 2):** counter and todo/contact list; lifted state across siblings.
- **Checkpoint:** why `setState` is async; why index keys break.

### Phase 4: Hooks Beyond State (about 1.5 days)

- `useEffect` (dependency array, cleanup, AbortController), `useRef`, `useMemo`, `useCallback`, `React.memo`, custom hooks, `useContext`.
- Memoize only after measuring.
- **Practice:** timer with cleanup, debounced search with AbortController, `useMenuItems()`-style data hook.
- **Checkpoint:** three forms of the dependency array; `useRef` vs `useState`; `useMemo` vs `useCallback`.

### Phase 5: Forms and React 19 Actions (about 2 days)

- Controlled vs uncontrolled, `FormData`, validation (client for UX, server always).
- `<form action>`, `useActionState`, `useFormStatus`, `useOptimistic`; react-hook-form `Controller`.
- **Project 2:** Contact List, built once with `onSubmit` and once with `useActionState`, plus optimistic add.
- **Checkpoint:** what Actions replace; why server validation is still required.

### Phase 6: Axios Service Layer (about 1 day)

- `axios.create`, request/response interceptors, `VITE_` env variables, loading/error states.
- **Practice:** `services/api.js` against a public API with a token interceptor.
- **Checkpoint:** where API calls live; how to avoid fetch race conditions.

### Phase 7: React Router (about 1.5 days)

- `Routes`, `Link`/`NavLink`, `useNavigate`, `useParams`, `useSearchParams`, nested routes with `Outlet`, catch-all 404.
- SPA fallback to `index.html` on the host for deep links.
- **Project 3:** Product Filter (query string filter, detail by id, nested layout, 404).
- **Checkpoint:** `Link` vs `<a>`; why deep-link refresh 404s in production.

### Phase 8: Client-Side Auth (about 1 day)

- AuthN vs AuthZ, fake login, `ProtectedRoute`, role-based routes and UI, redirect-after-login, avoiding redirect loops.
- Token storage trade-offs: localStorage (XSS-exposed) vs httpOnly cookie (needs CSRF protection).
- **Checkpoint:** why protected routes are only UX.

### Phase 9: Redux Toolkit (about 1.5 days)

- `configureStore`, `Provider`, `createSlice` with Immer, `useSelector`/`useDispatch`, `extraReducers` (reset on logout), `createAsyncThunk`.
- **Project 4:** counter, `cartSlice` (add/remove/quantity/subtotal selector), `themeSlice`.
- **Checkpoint:** how "mutation" works in slices; action/reducer/dispatch/selector in one minute.

### Phase 10: RTK Query (about 1.5 days)

- `createApi`, `fetchBaseQuery` with `prepareHeaders`, `tagTypes`, `providesTags`/`invalidatesTags`, `transformResponse`, global 401 handling, pagination.
- Register `api.reducer` and `api.middleware` in the store.
- **Project 5:** Destination Manager on json-server with tag-driven refresh.
- **Checkpoint:** how tags keep the UI in sync; RTK Query vs Axios + `useEffect`.

### Phase 11: .NET 10 Web API and EF Core (about 2 days)

- Controllers, DI lifetimes (transient/scoped/singleton), middleware, OpenAPI + Scalar.
- EF Core: `DbContext`, migrations, `HasData` seeding, `AsNoTracking`, `Include`, N+1.
- DTOs, `ApiResponse`, status codes, image upload with `IFormFile` (validate type and size).
- **Project 6:** Product API (CRUD, seed data, DTOs, upload), tested in Scalar.
- **Checkpoint:** why DTOs; what migrations do; the three DI lifetimes.

### Phase 12: Identity, JWT, Roles, CORS (about 1.5 days)

- Identity with `ApplicationUser`, `RoleManager`/`UserManager`, JWT creation and validation, `[Authorize(Roles = ...)]`.
- Middleware order: CORS, Authentication, Authorization. Secrets in User Secrets/Key Vault.
- Access vs refresh tokens; common JWT mistakes (weak key, no expiry, unvalidated issuer/audience).
- **Project 7:** Auth API; confirm 401 vs 403; trigger a CORS error on purpose, then fix it.
- **Checkpoint:** JWT flow end to end; why middleware order matters.

### Phase 13: Orders and Ratings (about 1 day)

- Header-detail pattern, snapshot pricing, status flow, row-level access, transactional save, rating rule, concurrency.
- **Project 8:** create order, my orders, all orders (admin), update status (admin), rate (buyer).
- **Checkpoint:** over-posting prevention; how users only see their own orders.

### Phase 14: Capstone Integration (about 4 days)

| Step | Work | Verify |
| --- | --- | --- |
| 14.1 Scaffold | Run client and API together; folders, route constants, `VITE_API_URL` | Both start with one command |
| 14.2 Store | `baseApi` with `prepareHeaders`, injected endpoints, `Provider` | Redux DevTools shows api slice |
| 14.3 Layout | Header (role-based links, cart count), Footer, `Outlet`, 404 | Links change by role |
| 14.4 Auth | Register/Login, `jwt-decode`, `authSlice` restored from token with expiry check, `ProtectedRoute` | Refresh keeps session; expired token logs out |
| 14.5 Admin (Project 9) | Product table, modal form (react-hook-form), image upload, mutations with tag invalidation, toast and delete confirm | New product appears without manual refresh |
| 14.6 Customer (Project 10) | Home with category filter, search, sort (`useMemo`); details; `cartSlice` persisted to localStorage | Cart survives reload |
| 14.7 Orders and ratings | Checkout, My orders, All orders (admin), status update, star rating | Customer sees only own orders |
| 14.8 Polish | Theme toggle persisted, loaders, disabled submit buttons, redirect-loop test, role checks on client **and** API | Admin URL blocked for customers by API |

**Checkpoint (end-to-end):** register, log in as admin, create product with image, log in as customer, add to cart, place order, admin updates status, customer rates after `Completed`.

### Phase 15: Production Hardening (about 1 day)

See Section 7.

### Phase 16: Interview Readiness (about 2 days)

- Practise Q&A in order: React fundamentals, Hooks, Router/Auth, Redux vs Context, RTK Query, .NET API, EF Core/Identity/JWT, system design, debugging scenario, deployment.
- Scenario drills: slow list, stale table, end-to-end security, `/admin` by URL, CORS error, pagination, deployment, out-of-sync state.
- Design answer structure: clarify, data flow, trade-offs, security, testing.
- Two mock interviews (React/Redux; .NET/security). Draw the architecture from memory and explain in two minutes.
- **Checkpoint:** explain the full project end to end in about five minutes.

**Total estimate:** about 21 to 23 days of focused work.

---

## 7. Production Hardening Checklist

### Security

- [ ] HTTPS only; HSTS enabled
- [ ] Access token 15 to 60 min plus refresh token with rotation
- [ ] JWT signing key from User Secrets / Key Vault / environment variable, never in Git
- [ ] Validate issuer, audience, lifetime and signing key
- [ ] `[Authorize]` (with roles) on every non-public endpoint
- [ ] CORS restricted with `WithOrigins`; `UseCors` before `UseAuthentication`
- [ ] DTO validation (`[Required]`, ranges, lengths); upload type and size limits
- [ ] EF parameterised queries only; JSX escaping, no `dangerouslySetInnerHTML`
- [ ] Rate limiting on auth endpoints
- [ ] Dependency audit (`npm audit`, `dotnet list package --vulnerable`)

### Performance

- [ ] Pagination (`page`, `pageSize`, `Skip/Take`, total count) on products and orders
- [ ] `AsNoTracking` on read queries; `Include` instead of N+1; index frequently filtered columns
- [ ] Code splitting with `lazy` + `Suspense` for Admin pages
- [ ] `React.memo`/`useMemo`/`useCallback` only where measured
- [ ] `react-window` if a list can be very large
- [ ] Image optimisation and caching headers
- [ ] Response compression on the API

### Reliability and observability

- [ ] Global exception middleware returning a consistent error shape (ProblemDetails)
- [ ] Structured logging (Serilog or built-in `ILogger`) with correlation id
- [ ] `/health` endpoint; database health check
- [ ] React error boundary around the app shell
- [ ] Optimistic concurrency handled (409 on conflict)

### Testing

- [ ] **Frontend (Vitest + RTL):** `ProtectedRoute` redirects, `cartSlice` reducers, product list renders
- [ ] **Backend (xUnit):** order creation (snapshot pricing, total), row-level access, rating eligibility
- [ ] **Integration:** `WebApplicationFactory` test for 401/403/200 on a protected endpoint
- [ ] CI blocks merge on test failure

### Deployment

- [ ] **Client:** `npm run build`; deploy `dist/` to Vercel/Netlify/static host with SPA fallback; `VITE_API_URL` per environment
- [ ] **API:** `dotnet publish -c Release`; Docker image; Azure App Service or container service
- [ ] **Config:** connection string, JWT key, CORS origin via environment variables
- [ ] **Database:** managed SQL; apply migrations through a controlled step (not on every app start in production)
- [ ] **CI/CD (GitHub Actions):** restore, build, test, publish artifacts, deploy on main
- [ ] **Monitoring:** logs and alerts configured

---

## 8. Milestones

| Milestone | Done when |
| --- | --- |
| M1: Frontend fundamentals | Projects 1 to 3 complete (Phases 0 to 7) |
| M2: State management | Projects 4 and 5 complete (Phases 8 to 10) |
| M3: Backend | Projects 6 to 8 complete (Phases 11 to 13) |
| M4: Capstone | Phase 14 end-to-end checkpoint passes; Projects 9 and 10 complete |
| M5: Production | Section 7 checklist complete; app deployed; CI green |
| M6: Interview ready | Phase 16 checkpoints pass |

---

## 9. Common Mistakes to Avoid

- Mutating state (including Redux state outside a slice)
- Missing `useEffect` dependency array or cleanup
- Index as key in dynamic lists
- Treating hidden UI as security
- Returning entities instead of DTOs
- JWT signing key in source control
- Forgetting `api.reducer` and `api.middleware` in the store
- `UseCors` after authentication, or `AllowAnyOrigin` in production
- Redirect loops between login and protected routes
- Trusting a user id sent by the client

---

## 10. Working Agreement

1. Build every exercise yourself; do not copy-paste solutions.
2. Commit after each phase with a clear message; tag each project (`project-01` to `project-10`).
3. Pass each checkpoint (explain it aloud) before moving on.
4. Keep a short `NOTES.md` of mistakes and fixes for interview revision.
5. Do not start Section 7 until the Phase 14 end-to-end checkpoint passes.
