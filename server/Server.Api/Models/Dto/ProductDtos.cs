using System.Text.Json.Serialization;

namespace Server.Api.Models.Dto;

// Phase 7: a read-only catalogue for the Product Filter (Project 3).
// Phase 11 moves products into SQL Server with EF Core, plus admin CRUD and image upload.
public record CategoryDto(int Id, string Name, string Slug);

public record ProductDto(
    int Id,
    string Name,
    string Description,
    decimal Price,
    int CategoryId,
    string CategoryName,
    string CategorySlug);

// Only these sort orders exist. Model binding turns ?sort=priceDesc into the enum and rejects anything else
// with a 400, so the client can never inject an arbitrary sort expression.
[JsonConverter(typeof(JsonStringEnumConverter<ProductSort>))]
public enum ProductSort { Name, PriceAsc, PriceDesc }
