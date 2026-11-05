using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Server.Api.Constants;
using Server.Api.Models;
using Server.Api.Models.Dto;
using Server.Api.Models.Entities;
using Server.Api.Services;

namespace Server.Api.Controllers;

// Project 8: orders and ratings. [Authorize] on the class: nothing here is public.
[ApiController]
[Route("api/[controller]")] // -> /api/orders
[Authorize]
public class OrdersController(OrderService orders) : ControllerBase
{
    // The caller's id, ALWAYS from the validated token. Never accept a userId from the body, query or URL.
    private string UserId => User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value;

    // POST /api/orders  { items: [{ productId, quantity }] }  -> 201 | 400 (empty or unavailable) | 401 | 403 (admins don't shop)
    [HttpPost]
    [Authorize(Roles = Roles.Customer)]
    [ProducesResponseType<ApiResponse<OrderDto>>(StatusCodes.Status201Created)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<OrderDto>>> Place(PlaceOrderDto input, CancellationToken ct)
    {
        var result = await orders.PlaceAsync(UserId, input, ct);
        return result.Succeeded
            ? CreatedAtAction(nameof(GetMine), new { id = result.Value!.Id }, ApiResponse<OrderDto>.Ok(result.Value))
            : BadRequest(ApiResponse<OrderDto>.FieldFail("items", result.Detail!));
    }

    // GET /api/orders/mine?page=1  -> ONLY the caller's orders, newest first
    [HttpGet("mine")]
    [Authorize(Roles = Roles.Customer)]
    [ProducesResponseType<ApiResponse<PagedResult<OrderDto>>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<PagedResult<OrderDto>>>> Mine([FromQuery] PageRequest paging, CancellationToken ct) =>
        Ok(ApiResponse<PagedResult<OrderDto>>.Ok(await orders.MyOrdersAsync(UserId, paging, ct)));

    // GET /api/orders/mine/7  -> 200, or 404 for an order that doesn't exist OR belongs to someone else
    [HttpGet("mine/{id:int}")]
    [Authorize(Roles = Roles.Customer)]
    [ProducesResponseType<ApiResponse<OrderDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<OrderDto>>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<OrderDto>>> GetMine(int id, CancellationToken ct) =>
        await orders.MineAsync(UserId, id, ct) is { } order
            ? Ok(ApiResponse<OrderDto>.Ok(order))
            : NotFound(ApiResponse<OrderDto>.Fail($"Order {id} not found"));

    // PUT /api/orders/7/details/12/rating  { rating: 5 }  -> 200 | 400 (not completed yet) | 404 (not yours, or no such line)
    [HttpPut("{id:int}/details/{detailId:int}/rating")]
    [Authorize(Roles = Roles.Customer)]
    [ProducesResponseType<ApiResponse<OrderDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<OrderDto>>> Rate(int id, int detailId, RateItemDto input, CancellationToken ct)
    {
        var result = await orders.RateAsync(UserId, id, detailId, input.Rating, ct);
        return result.Error switch
        {
            OrderError.None => Ok(ApiResponse<OrderDto>.Ok(result.Value!)),
            OrderError.NotCompleted => BadRequest(ApiResponse<OrderDto>.Fail("You can rate items once the order is completed.")),
            _ => NotFound(ApiResponse<OrderDto>.Fail($"Order {id} not found")),
        };
    }

    // ---------- admin ----------
    // GET /api/orders?status=Pending&page=1  -> every customer's orders
    [HttpGet]
    [Authorize(Roles = Roles.Admin)]
    [ProducesResponseType<ApiResponse<PagedResult<AdminOrderDto>>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<PagedResult<AdminOrderDto>>>> All(
        [FromQuery] PageRequest paging, [FromQuery] OrderStatus? status, CancellationToken ct) =>
        Ok(ApiResponse<PagedResult<AdminOrderDto>>.Ok(await orders.AllAsync(status, paging, ct)));

    // PUT /api/orders/7/status  { status: "Confirmed", rowVersion }  -> 200 | 400 (not allowed from here) | 404 | 409
    [HttpPut("{id:int}/status")]
    [Authorize(Roles = Roles.Admin)]
    [ProducesResponseType<ApiResponse<AdminOrderDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ApiResponse<AdminOrderDto>>> UpdateStatus(int id, UpdateOrderStatusDto input, CancellationToken ct)
    {
        var result = await orders.UpdateStatusAsync(id, input.Status!.Value, input.RowVersion!, ct);
        return result.Error switch
        {
            OrderError.None => Ok(ApiResponse<AdminOrderDto>.Ok(result.Value!)),
            OrderError.NotFound => NotFound(ApiResponse<AdminOrderDto>.Fail($"Order {id} not found")),
            OrderError.InvalidTransition => BadRequest(ApiResponse<AdminOrderDto>.FieldFail("status", result.Detail!)),
            OrderError.RowVersionInvalid => BadRequest(ApiResponse<AdminOrderDto>.FieldFail("rowVersion", "Reload the order before changing it.")),
            OrderError.Concurrency => Conflict(ApiResponse<AdminOrderDto>.Fail("Someone else changed this order. Reload it and try again.")),
            _ => throw new InvalidOperationException($"Unhandled {result.Error}"),
        };
    }
}
