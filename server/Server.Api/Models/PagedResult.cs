using System.ComponentModel.DataAnnotations;

namespace Server.Api.Models;

// plan.md: "Pagination on all list endpoints". Every paged endpoint takes these query params and returns PagedResult<T>.
// Never return an unbounded list: 10 rows today can be 100,000 next year, and one request would load them all.
public record PageRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "Page must be 1 or more.")]
    public int Page { get; init; } = 1;

    [Range(1, 50, ErrorMessage = "Page size must be 1 to 50.")]
    public int PageSize { get; init; } = 10;

    public int Skip => (Page - 1) * PageSize;
}

public record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount)
{
    public int TotalPages => TotalCount == 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
    public bool HasNext => Page < TotalPages;
    public bool HasPrevious => Page > 1;

    // Skip/Take: the same shape EF Core turns into OFFSET/FETCH in SQL (Phase 11)
    public static PagedResult<T> From(IEnumerable<T> source, PageRequest page)
    {
        var all = source as IReadOnlyCollection<T> ?? [.. source];
        return new PagedResult<T>([.. all.Skip(page.Skip).Take(page.PageSize)], page.Page, page.PageSize, all.Count);
    }
}
