namespace Server.Api.Models.Entities;

// ONE status list, used by the API and both clients (plan.md: "One status name in the enum, used by API and UI").
// Stored as TEXT in SQL ("Pending"), so the data is readable, and adding a status in the middle never renumbers old rows.
public enum OrderStatus { Pending, Confirmed, Ready, Completed, Cancelled }

// The allowed moves. Anything else is refused, so an order can't jump from Pending to Completed,
// and a Completed (or Cancelled) order can never change again.
public static class OrderStatusFlow
{
    private static readonly Dictionary<OrderStatus, OrderStatus[]> Next = new()
    {
        [OrderStatus.Pending] = [OrderStatus.Confirmed, OrderStatus.Cancelled],
        [OrderStatus.Confirmed] = [OrderStatus.Ready, OrderStatus.Cancelled],
        [OrderStatus.Ready] = [OrderStatus.Completed, OrderStatus.Cancelled],
        [OrderStatus.Completed] = [],
        [OrderStatus.Cancelled] = [],
    };

    public static bool CanMove(OrderStatus from, OrderStatus to) => Next[from].Contains(to);
    public static IReadOnlyList<OrderStatus> AllowedFrom(OrderStatus from) => Next[from];
}

// HEADER-DETAIL pattern: one header row per order, one detail row per product line
public class OrderHeader
{
    public int Id { get; set; }
    public required string UserId { get; set; }          // from the TOKEN, never from the request body
    public ApplicationUser User { get; set; } = null!;
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
    public decimal Total { get; set; }                   // computed by the SERVER from the snapshot prices
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];         // two admins changing the status at once: the second gets a 409
    public List<OrderDetail> Details { get; set; } = [];
}

public class OrderDetail
{
    public int Id { get; set; }
    public int OrderHeaderId { get; set; }
    public OrderHeader OrderHeader { get; set; } = null!;

    // SNAPSHOT: the product's name and price AT PURCHASE TIME. If the product is renamed, repriced or removed later,
    // this order still shows what the customer actually paid. ProductId is kept only as a reference.
    public int ProductId { get; set; }
    public required string ProductName { get; set; }
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
    public decimal LineTotal { get; set; }

    public int? Rating { get; set; }                     // 1-5, set by the buyer after the order is Completed
    public DateTimeOffset? RatedAt { get; set; }
}
