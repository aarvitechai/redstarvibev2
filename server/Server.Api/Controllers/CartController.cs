using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Server.Api.Models;
using Server.Api.Services;

namespace Server.Api.Controllers;

// The client sends ONLY ids and quantities. Never trust a price, name or total from the browser:
// anyone can edit the Redux state in DevTools and "buy" a pizza for 1 rupee.
public record CartItemInput(
    [Range(1, int.MaxValue, ErrorMessage = "Unknown product.")] int ProductId,
    [Range(1, 20, ErrorMessage = "Quantity must be 1 to 20.")] int Quantity);

public record PriceCartDto(
    [Required, MaxLength(50, ErrorMessage = "A cart can hold at most 50 different products.")] IReadOnlyList<CartItemInput> Items);

public record CartLineDto(int ProductId, string Name, decimal UnitPrice, int Quantity, decimal LineTotal);
public record CartQuoteDto(IReadOnlyList<CartLineDto> Lines, decimal Subtotal, int ItemCount, IReadOnlyList<int> UnavailableProductIds);

[ApiController]
[Route("api/[controller]")] // -> /api/cart
public class CartController(IProductCatalog catalog) : ControllerBase
{
    // POST /api/cart/price  { items: [{ productId, quantity }] }
    // Returns the SERVER's prices and totals. Phase 13 checkout uses the same calculation (snapshot pricing).
    [HttpPost("price")]
    [ProducesResponseType<ApiResponse<CartQuoteDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<CartQuoteDto>>> Price(PriceCartDto input, CancellationToken ct)
    {
        // The same product twice? Merge the lines (and cap at the max quantity)
        var merged = input.Items
            .GroupBy(i => i.ProductId)
            .Select(g => (ProductId: g.Key, Quantity: Math.Min(20, g.Sum(i => i.Quantity))))
            .ToList();

        // ONE query for every product in the cart (WHERE Id IN (...)). Calling GetByIdAsync inside the loop
        // below would send one query per line: the N+1 problem.
        var found = (await catalog.GetByIdsAsync([.. merged.Select(m => m.ProductId)], ct)).ToDictionary(p => p.Id);

        var lines = new List<CartLineDto>();
        var unavailable = new List<int>();
        foreach (var (productId, quantity) in merged)
        {
            var product = found.GetValueOrDefault(productId);
            if (product is null)
            {
                unavailable.Add(productId); // deleted or never existed: tell the client so it can drop the line
                continue;
            }
            lines.Add(new CartLineDto(product.Id, product.Name, product.Price, quantity, product.Price * quantity));
        }

        // decimal (not double) for money: 0.1 + 0.2 is exactly 0.3 with decimal
        var quote = new CartQuoteDto(lines, lines.Sum(l => l.LineTotal), lines.Sum(l => l.Quantity), unavailable);
        return Ok(ApiResponse<CartQuoteDto>.Ok(quote));
    }
}
