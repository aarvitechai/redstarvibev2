using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using Server.Api.Models.Entities;

namespace Server.Api.Models.Dto;

// ---------- input ----------
// What a customer may send to place an order: product ids and quantities, and NOTHING else.
// No userId (from the token), no prices or total (from the database), no status (always Pending): no over-posting.
public record OrderItemInput(
    [Range(1, int.MaxValue, ErrorMessage = "Unknown product.")] int ProductId,
    [Range(1, 20, ErrorMessage = "Quantity must be 1 to 20.")] int Quantity);

public record PlaceOrderDto(
    [Required, MinLength(1, ErrorMessage = "Your cart is empty."), MaxLength(50, ErrorMessage = "An order can hold at most 50 different products.")]
    IReadOnlyList<OrderItemInput> Items);

public record UpdateOrderStatusDto(
    [Required] OrderStatus? Status,
    [Required(ErrorMessage = "Reload the order before changing it (rowVersion is missing).")] string? RowVersion);

public record RateItemDto([Range(1, 5, ErrorMessage = "Rating must be 1 to 5.")] int Rating);

// ---------- output ----------
public record OrderLineDto(int Id, int ProductId, string ProductName, decimal UnitPrice, int Quantity, decimal LineTotal, int? Rating);

public record OrderDto(
    int Id,
    [property: JsonConverter(typeof(JsonStringEnumConverter<OrderStatus>))] OrderStatus Status,
    decimal Total,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt,
    IReadOnlyList<OrderLineDto> Lines,
    string RowVersion,
    bool CanRate); // true when the order is Completed (the UI shows the stars; the API still checks)

// Admin view: the same order plus who placed it, and which statuses it may move to next
public record AdminOrderDto(
    int Id,
    string CustomerName,
    string CustomerEmail,
    [property: JsonConverter(typeof(JsonStringEnumConverter<OrderStatus>))] OrderStatus Status,
    decimal Total,
    int ItemCount,
    DateTimeOffset CreatedAt,
    string RowVersion,
    IReadOnlyList<string> AllowedNextStatuses);
