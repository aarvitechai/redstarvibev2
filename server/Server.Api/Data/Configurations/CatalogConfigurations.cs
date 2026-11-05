using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Server.Api.Models.Entities;

namespace Server.Api.Data.Configurations;

// FLUENT CONFIGURATION, one class per entity (picked up by ApplyConfigurationsFromAssembly).
// It keeps the entities plain, and puts database rules (lengths, precision, indexes, seed data) in one place.

public class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> b)
    {
        b.Property(c => c.Name).HasMaxLength(60).IsRequired();
        b.Property(c => c.Slug).HasMaxLength(60).IsRequired();
        b.HasIndex(c => c.Slug).IsUnique(); // used in every filtered URL (?category=pizza), and must be unique

        b.HasData(CatalogSeed.Categories);
    }
}

public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> b)
    {
        b.Property(p => p.Name).HasMaxLength(100).IsRequired();
        b.Property(p => p.Description).HasMaxLength(500).IsRequired();
        b.Property(p => p.Price).HasPrecision(10, 2); // money: an exact decimal(10,2), never float
        b.Property(p => p.ImageUrl).HasMaxLength(300);
        b.Property(p => p.RowVersion).IsRowVersion(); // SQL Server "rowversion": set automatically on every update

        // Restrict: a category that still has products can't be deleted (no accidental cascade wipe-out)
        b.HasOne(p => p.Category).WithMany(c => c.Products).HasForeignKey(p => p.CategoryId).OnDelete(DeleteBehavior.Restrict);

        // Indexes for the columns the catalogue filters and sorts on
        b.HasIndex(p => new { p.IsActive, p.CategoryId });
        b.HasIndex(p => p.Name);
        b.HasIndex(p => p.Price);

        // GLOBAL QUERY FILTER: every query on Products adds "WHERE IsActive = 1" automatically, so a soft-deleted
        // product can't leak into a public list by accident. Admin screens opt out with IgnoreQueryFilters().
        b.HasQueryFilter(p => p.IsActive);

        b.HasData(CatalogSeed.Products);
    }
}

// SEED DATA (HasData) becomes part of the migration. It must use FIXED values (ids, dates):
// a value like DateTimeOffset.UtcNow would change on every build and create a new migration each time.
public static class CatalogSeed
{
    private static readonly DateTimeOffset Seeded = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

    public static readonly Category[] Categories =
    [
        new() { Id = 1, Name = "Burgers", Slug = "burgers" },
        new() { Id = 2, Name = "Pizza", Slug = "pizza" },
        new() { Id = 3, Name = "Drinks", Slug = "drinks" },
        new() { Id = 4, Name = "Desserts", Slug = "desserts" },
    ];

    public static readonly object[] Products =
    [
        P(1, "Classic Burger", "Beef patty, cheddar, pickles and house sauce.", 8.50m, 1),
        P(2, "Veggie Burger", "Spiced chickpea patty with avocado and slaw.", 7.75m, 1),
        P(3, "Double Smash", "Two smashed patties, double cheese, caramelised onions.", 11.25m, 1),
        P(4, "Margherita", "Tomato, mozzarella and fresh basil.", 9.00m, 2),
        P(5, "Pepperoni", "Spicy pepperoni with mozzarella.", 10.50m, 2),
        P(6, "Paneer Tikka Pizza", "Tandoori paneer, peppers and red onion.", 11.00m, 2),
        P(7, "Lemon Iced Tea", "Brewed black tea with fresh lemon.", 2.50m, 3),
        P(8, "Mango Lassi", "Yoghurt, ripe mango and a pinch of cardamom.", 3.25m, 3),
        P(9, "Cold Coffee", "Chilled espresso shaken with milk.", 3.75m, 3),
        P(10, "Chocolate Brownie", "Warm fudge brownie with vanilla ice cream.", 4.50m, 4),
        P(11, "Gulab Jamun", "Two warm milk dumplings in rose syrup.", 3.50m, 4),
    ];

    // Anonymous objects: HasData can't set the database-generated RowVersion, and it doesn't need navigations
    private static object P(int id, string name, string description, decimal price, int categoryId) =>
        new { Id = id, Name = name, Description = description, Price = price, CategoryId = categoryId, IsActive = true, CreatedAt = Seeded, ImageUrl = (string?)null };
}
