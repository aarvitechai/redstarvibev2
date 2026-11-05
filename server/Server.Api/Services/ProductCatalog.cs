using Server.Api.Models.Dto;

namespace Server.Api.Services;

public record ProductQuery(string? Category = null, string? Search = null, ProductSort Sort = ProductSort.Name);

public interface IProductCatalog
{
    IReadOnlyList<CategoryDto> GetCategories();
    IReadOnlyList<ProductDto> Find(ProductQuery query);
    ProductDto? GetById(int id);
}

// Immutable seed data, so no lock is needed (nothing is ever written). EF Core replaces this in Phase 11.
public class InMemoryProductCatalog : IProductCatalog
{
    private static readonly IReadOnlyList<CategoryDto> Categories =
    [
        new(1, "Burgers", "burgers"),
        new(2, "Pizza", "pizza"),
        new(3, "Drinks", "drinks"),
        new(4, "Desserts", "desserts"),
    ];

    private static readonly IReadOnlyList<ProductDto> Products = Build(
        (1, "Classic Burger", "Beef patty, cheddar, pickles and house sauce.", 8.50m, 1),
        (2, "Veggie Burger", "Spiced chickpea patty with avocado and slaw.", 7.75m, 1),
        (3, "Double Smash", "Two smashed patties, double cheese, caramelised onions.", 11.25m, 1),
        (4, "Margherita", "Tomato, mozzarella and fresh basil.", 9.00m, 2),
        (5, "Pepperoni", "Spicy pepperoni with mozzarella.", 10.50m, 2),
        (6, "Paneer Tikka Pizza", "Tandoori paneer, peppers and red onion.", 11.00m, 2),
        (7, "Lemon Iced Tea", "Brewed black tea with fresh lemon.", 2.50m, 3),
        (8, "Mango Lassi", "Yoghurt, ripe mango and a pinch of cardamom.", 3.25m, 3),
        (9, "Cold Coffee", "Chilled espresso shaken with milk.", 3.75m, 3),
        (10, "Chocolate Brownie", "Warm fudge brownie with vanilla ice cream.", 4.50m, 4),
        (11, "Gulab Jamun", "Two warm milk dumplings in rose syrup.", 3.50m, 4));

    public IReadOnlyList<CategoryDto> GetCategories() => Categories;

    public ProductDto? GetById(int id) => Products.FirstOrDefault(p => p.Id == id);

    public IReadOnlyList<ProductDto> Find(ProductQuery query)
    {
        IEnumerable<ProductDto> result = Products;

        var category = query.Category?.Trim();
        if (!string.IsNullOrEmpty(category))
            result = result.Where(p => string.Equals(p.CategorySlug, category, StringComparison.OrdinalIgnoreCase));

        var term = query.Search?.Trim();
        if (!string.IsNullOrEmpty(term))
            result = result.Where(p =>
                p.Name.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                p.Description.Contains(term, StringComparison.OrdinalIgnoreCase));

        result = query.Sort switch
        {
            ProductSort.PriceAsc => result.OrderBy(p => p.Price).ThenBy(p => p.Name),
            ProductSort.PriceDesc => result.OrderByDescending(p => p.Price).ThenBy(p => p.Name),
            _ => result.OrderBy(p => p.Name),
        };

        return [.. result];
    }

    private static IReadOnlyList<ProductDto> Build(params (int Id, string Name, string Description, decimal Price, int CategoryId)[] rows) =>
    [
        .. rows.Select(r =>
        {
            var c = Categories.Single(c => c.Id == r.CategoryId);
            return new ProductDto(r.Id, r.Name, r.Description, r.Price, c.Id, c.Name, c.Slug);
        }),
    ];
}
