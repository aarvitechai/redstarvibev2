using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Server.Api.Data;
using Server.Api.Models;
using Server.Api.Models.Dto;
using Server.Api.Models.Entities;

namespace Server.Api.Services;

public enum OrderError { None, NotFound, UnavailableProducts, InvalidTransition, Concurrency, NotCompleted, RowVersionInvalid }

public record OrderResult<T>(T? Value, OrderError Error = OrderError.None, string? Detail = null)
{
    public bool Succeeded => Error == OrderError.None;
}

// Plan.md layering: Controller -> SERVICE -> DbContext, once the logic is more than CRUD.
// All the order RULES live here, where they can be tested without HTTP.
public class OrderService(ApplicationDbContext db, TimeProvider clock)
{
    private static readonly Expression<Func<OrderHeader, OrderDto>> ToDto = o => new OrderDto(
        o.Id, o.Status, o.Total, o.CreatedAt, o.UpdatedAt,
        o.Details.OrderBy(d => d.Id)
            .Select(d => new OrderLineDto(d.Id, d.ProductId, d.ProductName, d.UnitPrice, d.Quantity, d.LineTotal, d.Rating))
            .ToList(),
        Convert.ToBase64String(o.RowVersion),
        o.Status == OrderStatus.Completed);

    // ---------- customer ----------
    public async Task<OrderResult<OrderDto>> PlaceAsync(string userId, PlaceOrderDto input, CancellationToken ct)
    {
        // The same product twice? One line, quantities added (capped at the limit)
        var wanted = input.Items
            .GroupBy(i => i.ProductId)
            .Select(g => (ProductId: g.Key, Quantity: Math.Min(20, g.Sum(i => i.Quantity))))
            .ToList();

        // ONE query for every product. The global query filter skips inactive (soft-deleted) products,
        // so they count as unavailable: you can't buy something that's no longer for sale.
        var ids = wanted.Select(w => w.ProductId).ToList();
        var products = await db.Products.AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => new { p.Id, p.Name, p.Price })
            .ToDictionaryAsync(p => p.Id, ct);

        var missing = ids.Where(id => !products.ContainsKey(id)).ToList();
        if (missing.Count > 0) return new(null, OrderError.UnavailableProducts, $"Some products are no longer available: {string.Join(", ", missing)}.");

        // SNAPSHOT PRICING: copy the name and the CURRENT database price into each line. The client sent no prices at all.
        var details = wanted.Select(w =>
        {
            var p = products[w.ProductId];
            return new OrderDetail { ProductId = p.Id, ProductName = p.Name, UnitPrice = p.Price, Quantity = w.Quantity, LineTotal = p.Price * w.Quantity };
        }).ToList();

        var order = new OrderHeader
        {
            UserId = userId,                 // from the token (the controller passes the "sub" claim)
            Status = OrderStatus.Pending,    // every order starts here, whatever the client wanted
            Total = details.Sum(d => d.LineTotal),
            CreatedAt = clock.GetUtcNow(),
            Details = details,
        };
        db.OrderHeaders.Add(order);

        // TRANSACTIONAL SAVE: ONE SaveChangesAsync = ONE database transaction for the header AND all its lines.
        // If any INSERT fails, nothing is saved: never a header without lines, or half an order.
        await db.SaveChangesAsync(ct);
        return new(await MineAsync(userId, order.Id, ct));
    }

    // ROW-LEVEL ACCESS: every customer query starts with "WHERE UserId = <the caller>"
    public async Task<PagedResult<OrderDto>> MyOrdersAsync(string userId, PageRequest paging, CancellationToken ct)
    {
        var q = db.OrderHeaders.AsNoTracking().Where(o => o.UserId == userId).OrderByDescending(o => o.CreatedAt).ThenByDescending(o => o.Id);
        var total = await q.CountAsync(ct);
        // AsSplitQuery: orders and their lines in 2 queries, instead of one big JOIN that repeats every header per line
        var items = await q.Skip(paging.Skip).Take(paging.PageSize).Select(ToDto).AsSplitQuery().ToListAsync(ct);
        return new PagedResult<OrderDto>(items, paging.Page, paging.PageSize, total);
    }

    // Someone else's order is "not found" (404), not "forbidden" (403): we don't even confirm it exists
    public Task<OrderDto?> MineAsync(string userId, int orderId, CancellationToken ct) =>
        db.OrderHeaders.AsNoTracking().Where(o => o.Id == orderId && o.UserId == userId).Select(ToDto).FirstOrDefaultAsync(ct);

    // RATING RULE: only the BUYER (row-level), only when the order is COMPLETED, only a line of THAT order
    public async Task<OrderResult<OrderDto>> RateAsync(string userId, int orderId, int detailId, int rating, CancellationToken ct)
    {
        var order = await db.OrderHeaders.Include(o => o.Details).FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == userId, ct);
        if (order is null) return new(null, OrderError.NotFound);
        if (order.Status != OrderStatus.Completed) return new(null, OrderError.NotCompleted);
        var line = order.Details.FirstOrDefault(d => d.Id == detailId);
        if (line is null) return new(null, OrderError.NotFound);

        line.Rating = rating; // changing your mind later is allowed
        line.RatedAt = clock.GetUtcNow();
        await db.SaveChangesAsync(ct);
        return new(await MineAsync(userId, orderId, ct));
    }

    // ---------- admin ----------
    public async Task<PagedResult<AdminOrderDto>> AllAsync(OrderStatus? status, PageRequest paging, CancellationToken ct)
    {
        var q = db.OrderHeaders.AsNoTracking();
        if (status is { } s) q = q.Where(o => o.Status == s);
        q = q.OrderByDescending(o => o.CreatedAt).ThenByDescending(o => o.Id);

        var total = await q.CountAsync(ct);
        var rows = await q.Skip(paging.Skip).Take(paging.PageSize)
            .Select(o => new { o.Id, o.User.Name, o.User.Email, o.Status, o.Total, ItemCount = o.Details.Sum(d => d.Quantity), o.CreatedAt, o.RowVersion })
            .ToListAsync(ct);

        var items = rows.Select(o => new AdminOrderDto(o.Id, o.Name, o.Email ?? "", o.Status, o.Total, o.ItemCount, o.CreatedAt,
            Convert.ToBase64String(o.RowVersion), [.. OrderStatusFlow.AllowedFrom(o.Status).Select(x => x.ToString())])).ToList();
        return new PagedResult<AdminOrderDto>(items, paging.Page, paging.PageSize, total);
    }

    public async Task<OrderResult<AdminOrderDto>> UpdateStatusAsync(int orderId, OrderStatus next, string rowVersion, CancellationToken ct)
    {
        byte[] version;
        try { version = Convert.FromBase64String(rowVersion); }
        catch (FormatException) { return new(null, OrderError.RowVersionInvalid); }

        var order = await db.OrderHeaders.FirstOrDefaultAsync(o => o.Id == orderId, ct);
        if (order is null) return new(null, OrderError.NotFound);
        if (!OrderStatusFlow.CanMove(order.Status, next))
            return new(null, OrderError.InvalidTransition, $"An order can't go from {order.Status} to {next}.");

        db.Entry(order).Property(o => o.RowVersion).OriginalValue = version; // the version the admin LOADED
        order.Status = next;
        order.UpdatedAt = clock.GetUtcNow();
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return new(null, OrderError.Concurrency);
        }

        // Read it back: the NEW RowVersion (from SQL Server) and the statuses allowed from here
        var updated = await db.OrderHeaders.AsNoTracking().Where(o => o.Id == orderId)
            .Select(o => new { o.Id, o.User.Name, o.User.Email, o.Status, o.Total, ItemCount = o.Details.Sum(d => d.Quantity), o.CreatedAt, o.RowVersion })
            .FirstAsync(ct);
        return new(new AdminOrderDto(updated.Id, updated.Name, updated.Email ?? "", updated.Status, updated.Total, updated.ItemCount, updated.CreatedAt,
            Convert.ToBase64String(updated.RowVersion), [.. OrderStatusFlow.AllowedFrom(updated.Status).Select(x => x.ToString())]));
    }
}
