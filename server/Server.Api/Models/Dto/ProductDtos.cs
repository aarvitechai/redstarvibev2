using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Server.Api.Models.Dto;

public record CategoryDto(int Id, string Name, string Slug);

// PUBLIC view of a product: only what a shopper needs
public record ProductDto(
    int Id,
    string Name,
    string Description,
    decimal Price,
    int CategoryId,
    string CategoryName,
    string CategorySlug,
    string? ImageUrl);

// ADMIN view: adds what an editor needs (active flag, timestamps, and RowVersion for the concurrency check)
public record AdminProductDto(
    int Id,
    string Name,
    string Description,
    decimal Price,
    int CategoryId,
    string CategoryName,
    string? ImageUrl,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt,
    string RowVersion); // base64 of the SQL rowversion; the client sends it back unchanged when saving

public record SaveProductDto(
    [Required(ErrorMessage = "Name is required."), StringLength(100, MinimumLength = 2, ErrorMessage = "Name must be 2 to 100 characters.")]
    string Name,
    [StringLength(500, ErrorMessage = "Description must be at most 500 characters.")]
    string? Description,
    [Range(typeof(decimal), "0.01", "100000", ErrorMessage = "Price must be between 0.01 and 100000.")]
    decimal Price,
    [Range(1, int.MaxValue, ErrorMessage = "Choose a category.")]
    int CategoryId,
    bool IsActive = true,
    string? RowVersion = null); // REQUIRED on update (checked by the service), ignored on create

// Only these sort orders exist. Model binding turns ?sort=priceDesc into the enum and rejects anything else
// with a 400, so the client can never inject an arbitrary sort expression.
[JsonConverter(typeof(JsonStringEnumConverter<ProductSort>))]
public enum ProductSort { Name, PriceAsc, PriceDesc }
