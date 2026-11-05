namespace Server.Api.Models.Entities;

// ENTITIES = the database's shape. They are NEVER sent to or accepted from clients (plan.md: "DTOs everywhere"):
//  - returning an entity leaks internal columns (RowVersion, IsActive, future cost prices...)
//  - accepting one allows OVER-POSTING (a client could set Id, IsActive or CategoryId freely)
//  - navigation properties can create JSON cycles (Product -> Category -> Products -> ...)

public class Category
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public required string Slug { get; set; }

    public List<Product> Products { get; set; } = [];
}

public class Product
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public string Description { get; set; } = "";
    public decimal Price { get; set; }
    public string? ImageUrl { get; set; }

    public int CategoryId { get; set; }          // the FOREIGN KEY column
    public Category Category { get; set; } = null!; // the NAVIGATION property (EF fills it when asked)

    public bool IsActive { get; set; } = true;  // soft delete: orders (Phase 13) may still point at old products
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }

    // OPTIMISTIC CONCURRENCY: SQL Server changes this value on EVERY update. An UPDATE only succeeds if the row
    // still has the RowVersion the client loaded, so two admins editing at once can't silently overwrite each other.
    public byte[] RowVersion { get; set; } = [];
}
