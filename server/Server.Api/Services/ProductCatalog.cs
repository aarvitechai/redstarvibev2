using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Server.Api.Data;
using Server.Api.Models;
using Server.Api.Models.Dto;
using Server.Api.Models.Entities;

namespace Server.Api.Services;

public record ProductQuery(string? Category = null, string? Search = null, ProductSort Sort = ProductSort.Name);

// READ side of the catalogue (public). SCOPED: it uses the per-request DbContext.
public interface IProductCatalog
{
    Task<IReadOnlyList<CategoryDto>> GetCategoriesAsync(CancellationToken ct = default);
    Task<PagedResult<ProductDto>> FindAsync(ProductQuery query, PageRequest paging, CancellationToken ct = default);
    Task<ProductDto?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<IReadOnlyList<ProductDto>> GetByIdsAsync(IReadOnlyCollection<int> ids, CancellationToken ct = default);
    Task<int> CountAsync(CancellationToken ct = default);
}

public class EfProductCatalog(ApplicationDbContext db) : IProductCatalog
{
    // A PROJECTION expression: EF translates it into SQL that selects ONLY these columns, joining Categories once.
    // No Include() is needed, and no N+1: reading p.Category.Name here is part of the same SQL query.
    public static readonly Expression<Func<Product, ProductDto>> ToDto = p =>
        new ProductDto(p.Id, p.Name, p.Description, p.Price, p.CategoryId, p.Category.Name, p.Category.Slug, p.ImageUrl);

    public async Task<IReadOnlyList<CategoryDto>> GetCategoriesAsync(CancellationToken ct = default) =>
        await db.Categories.AsNoTracking().OrderBy(c => c.Id).Select(c => new CategoryDto(c.Id, c.Name, c.Slug)).ToListAsync(ct);

    public async Task<PagedResult<ProductDto>> FindAsync(ProductQuery query, PageRequest paging, CancellationToken ct = default)
    {
        // AsNoTracking: a read-only query. EF skips the change tracker, which is faster and uses less memory.
        // (The IsActive filter is applied automatically by the global query filter.)
        IQueryable<Product> q = db.Products.AsNoTracking();

        var category = query.Category?.Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(category)) q = q.Where(p => p.Category.Slug == category);

        var term = query.Search?.Trim();
        if (!string.IsNullOrEmpty(term))
            // Becomes a PARAMETERISED "LIKE @p" (EF also escapes % and _), so this is safe from SQL injection.
            // Case-insensitivity comes from SQL Server's default collation.
            q = q.Where(p => p.Name.Contains(term) || p.Description.Contains(term));

        q = query.Sort switch
        {
            ProductSort.PriceAsc => q.OrderBy(p => p.Price).ThenBy(p => p.Name).ThenBy(p => p.Id),
            ProductSort.PriceDesc => q.OrderByDescending(p => p.Price).ThenBy(p => p.Name).ThenBy(p => p.Id),
            _ => q.OrderBy(p => p.Name).ThenBy(p => p.Id), // a stable order is required for paging
        };

        // Two SQL commands, however many products exist: SELECT COUNT(*), then one page with OFFSET/FETCH
        var total = await q.CountAsync(ct);
        var items = await q.Skip(paging.Skip).Take(paging.PageSize).Select(ToDto).ToListAsync(ct);
        return new PagedResult<ProductDto>(items, paging.Page, paging.PageSize, total);
    }

    public Task<ProductDto?> GetByIdAsync(int id, CancellationToken ct = default) =>
        db.Products.AsNoTracking().Where(p => p.Id == id).Select(ToDto).FirstOrDefaultAsync(ct);

    // ONE query for many ids (WHERE Id IN (...)), not one query per id in a loop: that loop would be the N+1 problem
    public async Task<IReadOnlyList<ProductDto>> GetByIdsAsync(IReadOnlyCollection<int> ids, CancellationToken ct = default) =>
        ids.Count == 0 ? [] : await db.Products.AsNoTracking().Where(p => ids.Contains(p.Id)).Select(ToDto).ToListAsync(ct);

    public Task<int> CountAsync(CancellationToken ct = default) => db.Products.CountAsync(ct);
}
