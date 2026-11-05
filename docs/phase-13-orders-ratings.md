# Phase 13: Orders and Ratings (Project 8)

**Goal:** turn a cart into an order the way a real shop must: prices from the **database**, saved **all-or-nothing**, each customer seeing **only their own** orders, status changes that follow a fixed flow, and ratings only after delivery.

## Setup
```bash
cd server && ASPNETCORE_ENVIRONMENT=Development dotnet ef database update --project Server.Api   # adds OrderHeaders + OrderDetails
```

## What was built

| Piece | File |
| --- | --- |
| Entities + status flow | `Models/Entities/OrderEntities.cs` (`OrderHeader`, `OrderDetail`, `OrderStatus`, `OrderStatusFlow`) |
| Mapping | `Data/Configurations/OrderConfigurations.cs` (status stored as text, money precision, `RowVersion`, CHECK constraints, indexes) |
| Migration | `Data/Migrations/*_AddOrders.cs` (only CREATEs) |
| Rules | `Services/OrderService.cs` |
| Endpoints | `Controllers/OrdersController.cs` |
| React | `store/api/ordersApi.js`, `pages/MyOrdersPage.jsx`, `components/orders/StarRating.jsx`, checkout in `CartPage.jsx` |
| Angular | `features/orders/*` (`OrdersApi`, `my-orders-page`, `star-rating`), checkout in `cart-page.ts` |

## Endpoints
| Endpoint | Who | Notes |
| --- | --- | --- |
| `POST /api/orders` `{ items: [{ productId, quantity }] }` | Customer | 201; 400 if empty or a product is unavailable; admins get 403 |
| `GET /api/orders/mine?page=` | Customer | only the caller's orders, newest first |
| `GET /api/orders/mine/{id}` | Customer | **404** for someone else's order |
| `PUT /api/orders/{id}/details/{detailId}/rating` `{ rating }` | Customer (the buyer) | only when `Completed`; 1–5 |
| `GET /api/orders?status=&page=` | Admin | every order, with the customer and the allowed next statuses |
| `PUT /api/orders/{id}/status` `{ status, rowVersion }` | Admin | 400 for an invalid move; **409** if someone else changed it first |

## The rules, and how each one is enforced

| Rule | How | Test |
| --- | --- | --- |
| **Snapshot pricing** | each line copies `ProductName` and `UnitPrice` from the database at purchase time | repricing and renaming a product doesn't change an existing order |
| **Server-side prices** | `PlaceOrderDto` holds only ids and quantities | a body with `unitPrice: 0.01`, `total: 0.01`, `status: "Completed"`, `userId` is ignored (shown live too: 19.50 charged) |
| **Transactional save** | the header and all lines go in **one** `SaveChangesAsync` = one SQL transaction | a CHECK constraint fails on line 2, so **nothing** is saved (no half order) |
| **Row-level access** | the user id comes from the token's `sub` claim; every query has `WHERE UserId = @me` | another customer's order is 404 (not 403); their list contains only their own |
| **Status flow** | `OrderStatusFlow.CanMove`: `Pending → Confirmed → Ready → Completed`, or `→ Cancelled`; final states stay final | `Pending → Completed` is 400, and so is `Completed → Cancelled` |
| **Concurrency** | `RowVersion` on `OrderHeader` | two admins with the same version: the second gets 409 |
| **Rating eligibility** | only the buyer, only when `Completed`, only a line of **that** order | before completion 400; another order's line under this URL 404; a rating of 6 gives 400 |
| **Unavailable products** | the global query filter hides inactive products, so they can't be bought | soft-delete a product, then order it: 400 |
| **The database as the last line** | `CHECK (Quantity BETWEEN 1 AND 20)`, `CHECK (Rating IS NULL OR Rating BETWEEN 1 AND 5)` | used by the transaction test |

**Why 404 and not 403 for someone else's order?** A 403 would confirm that order #57 exists. A 404 reveals nothing. Ids are often guessable (1, 2, 3...), so "you can't see it" and "it doesn't exist" must look the same.

**Order of checks:** an invalid status move is rejected **before** the concurrency check, so a stale save of an impossible move returns 400, not 409. (Seen live: `Completed → Cancelled` with a stale version.)

## Design notes
- **Header-detail:** one `OrderHeader` (who, when, status, total) with many `OrderDetail` lines.
- **No foreign key from `OrderDetail` to `Products`**, on purpose: a line is a snapshot and must stand on its own. Products are only ever soft-deleted anyway.
- **Status stored as text** (`HasConversion<string>()`), and JSON sends enums as text (`JsonStringEnumConverter`). The data stays readable, and adding a status never renumbers old rows.
- **`AsSplitQuery()`** for orders with their lines: two queries instead of one JOIN that repeats each header once per line.
- **Restrict delete** from users to orders: financial records must not disappear when an account is removed.
- **Clients:** checkout sends ids and quantities only, clears the cart **only after** the server accepted the order, and shows the server's error ("Some products are no longer available") without losing the cart. Rating is an accessible radio group; after saving, the list refetches (RTK Query tag invalidation, or the Angular version bump).

## Checkpoint: answer these out loud before Phase 14

**Q1. How do you prevent over-posting?**
Accept a **DTO** that contains only the fields the caller is allowed to set, and **never bind straight onto an entity**. `PlaceOrderDto` has only `productId` and `quantity`. The server sets everything else itself: `UserId` from the token, prices and names from the database, `Total` by calculation, `Status = Pending`, `CreatedAt` from the clock. Extra JSON fields (`total`, `unitPrice`, `userId`, `status`) have nowhere to go and are dropped. A test sends all of them and gets an 8.50 burger, not a 0.01 one.

**Q2. How do users only see their own orders?**
The user id is **never taken from the request**; it comes from the validated JWT's `sub` claim. Every customer query filters on it (`WHERE UserId = @me`), including the detail and rating endpoints. Asking for another customer's order returns **404**, so ids can't be probed. Admin endpoints are separate and require the Admin role.

**Self-check:**
- Why copy the product name and price into the order line instead of joining to `Products`?
- What exactly does "one `SaveChangesAsync` = one transaction" protect against?
- Why can't an admin place an order, and where is that enforced?
- Why does the cart only clear after the API answers 201?
- What does a CHECK constraint add if the API already validates the input?
