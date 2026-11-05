using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Server.Api.Data;
using Server.Api.Models;
using Server.Api.Models.Dto;
using Server.Api.Models.Entities;

namespace Server.Api.Services;

public enum ProductWriteError { None, NotFound, UnknownCategory, RowVersionRequired, Concurrency }

public record ProductWriteResult(AdminProductDto? Product, ProductWriteError Error = ProductWriteError.None)
{
    public bool Succeeded => Error == ProductWriteError.None;
}

public interface IProductAdminService
{
    Task<PagedResult<AdminProductDto>> FindAsync(string? search, PageRequest paging, CancellationToken ct = default);
    Task<AdminProductDto?> GetAsync(int id, CancellationToken ct = default);
    Task<ProductWriteResult> CreateAsync(SaveProductDto input, CancellationToken ct = default);
    Task<ProductWriteResult> UpdateAsync(int id, SaveProductDto input, CancellationToken ct = default);
    Task<bool> DeactivateAsync(int id, CancellationToken ct = default);
    Task<(ProductWriteResult Result, string? OldImageUrl)> SetImageAsync(int id, string imageUrl, CancellationToken ct = default);
}

// WRITE side, used by the admin endpoints. Admins see inactive products too, so these queries call IgnoreQueryFilters().
public class EfProductAdminService(ApplicationDbContext db, TimeProvider clock) : IProductAdminService
{
    private static readonly Expression<Func<Product, AdminProductDto>> ToDto = p => new AdminProductDto(
        p.Id, p.Name, p.Description, p.Price, p.CategoryId, p.Category.Name, p.ImageUrl, p.IsActive, p.CreatedAt, p.UpdatedAt,
        Convert.ToBase64String(p.RowVersion));

    private IQueryable<Product> AllProducts => db.Products.IgnoreQueryFilters();

    public async Task<PagedResult<AdminProductDto>> FindAsync(string? search, PageRequest paging, CancellationToken ct = default)
    {
        var q = AllProducts.AsNoTracking();
        var term = search?.Trim();
        if (!string.IsNullOrEmpty(term)) q = q.Where(p => p.Name.Contains(term));
        q = q.OrderBy(p => p.Name).ThenBy(p => p.Id);

        var total = await q.CountAsync(ct);
        var items = await q.Skip(paging.Skip).Take(paging.PageSize).Select(ToDto).ToListAsync(ct);
        return new PagedResult<AdminProductDto>(items, paging.Page, paging.PageSize, total);
    }

    public Task<AdminProductDto?> GetAsync(int id, CancellationToken ct = default) =>
        AllProducts.AsNoTracking().Where(p => p.Id == id).Select(ToDto).FirstOrDefaultAsync(ct);

    public async Task<ProductWriteResult> CreateAsync(SaveProductDto input, CancellationToken ct = default)
    {
        if (!await db.Categories.AnyAsync(c => c.Id == input.CategoryId, ct)) return new(null, ProductWriteError.UnknownCategory);

        // Map the DTO onto a NEW entity field by field. Only these fields can be set: no over-posting.
        var product = new Product
        {
            Name = input.Name.Trim(),
            Description = input.Description?.Trim() ?? "",
            Price = input.Price,
            CategoryId = input.CategoryId,
            IsActive = input.IsActive,
            CreatedAt = clock.GetUtcNow(),
        };
        db.Products.Add(product);         // tracked as "Added"
        await db.SaveChangesAsync(ct);    // INSERT; the new Id and RowVersion are read back into the entity
        return new(await GetAsync(product.Id, ct));
    }

    public async Task<ProductWriteResult> UpdateAsync(int id, SaveProductDto input, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(input.RowVersion)) return new(null, ProductWriteError.RowVersionRequired);
        byte[] rowVersion;
        try { rowVersion = Convert.FromBase64String(input.RowVersion); }
        catch (FormatException) { return new(null, ProductWriteError.RowVersionRequired); }

        // A TRACKED query (no AsNoTracking): EF remembers the loaded values and sends only what changed
        var product = await AllProducts.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (product is null) return new(null, ProductWriteError.NotFound);
        if (product.CategoryId != input.CategoryId && !await db.Categories.AnyAsync(c => c.Id == input.CategoryId, ct))
            return new(null, ProductWriteError.UnknownCategory);

        // The concurrency check: compare against the RowVersion the CLIENT loaded, not the one we just read.
        // EF adds "WHERE Id = @id AND RowVersion = @original" to the UPDATE; if 0 rows change, someone else saved first.
        db.Entry(product).Property(p => p.RowVersion).OriginalValue = rowVersion;

        product.Name = input.Name.Trim();
        product.Description = input.Description?.Trim() ?? "";
        product.Price = input.Price;
        product.CategoryId = input.CategoryId;
        product.IsActive = input.IsActive;
        product.UpdatedAt = clock.GetUtcNow();

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return new(null, ProductWriteError.Concurrency); // -> 409: reload and try again
        }
        return new(await GetAsync(id, ct));
    }

    // SOFT delete: the row stays (Phase 13 orders keep a snapshot, and history stays intact), but the
    // global query filter hides it from every public query
    public async Task<bool> DeactivateAsync(int id, CancellationToken ct = default)
    {
        // ExecuteUpdateAsync: ONE "UPDATE ... SET IsActive = 0 WHERE Id = @id" with no SELECT first
        var rows = await AllProducts.Where(p => p.Id == id)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsActive, false).SetProperty(p => p.UpdatedAt, clock.GetUtcNow()), ct);
        return rows > 0;
    }

    public async Task<(ProductWriteResult Result, string? OldImageUrl)> SetImageAsync(int id, string imageUrl, CancellationToken ct = default)
    {
        var product = await AllProducts.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (product is null) return (new(null, ProductWriteError.NotFound), null);
        var old = product.ImageUrl;
        product.ImageUrl = imageUrl;
        product.UpdatedAt = clock.GetUtcNow();
        await db.SaveChangesAsync(ct);
        return (new(await GetAsync(id, ct)), old);
    }
}
