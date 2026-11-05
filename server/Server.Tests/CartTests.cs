using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Server.Api.Controllers;
using Server.Api.Models;

namespace Server.Tests;

public class CartTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client = factory.CreateClient();

    private async Task<CartQuoteDto> Price(object body)
    {
        var response = await _client.PostAsJsonAsync("/api/cart/price", body);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ApiResponse<CartQuoteDto>>())!.Data!;
    }

    [Fact]
    public async Task UsesServerPrices_AndComputesTotals()
    {
        var quote = await Price(new { items = new[] { new { productId = 1, quantity = 2 }, new { productId = 7, quantity = 3 } } });

        Assert.Equal([(1, 8.50m, 17.00m), (7, 2.50m, 7.50m)], quote.Lines.Select(l => (l.ProductId, l.UnitPrice, l.LineTotal)));
        Assert.Equal(24.50m, quote.Subtotal);
        Assert.Equal(5, quote.ItemCount);
    }

    [Fact]
    public async Task IgnoresAnyPriceTheClientTriesToSend()
    {
        // A tampered request: the client claims the burger costs 0.01. The DTO has no price field, so it's dropped.
        var quote = await Price(new { items = new[] { new { productId = 1, quantity = 1, price = 0.01m, unitPrice = 0.01m } }, subtotal = 0.01m });

        Assert.Equal(8.50m, quote.Subtotal);
    }

    [Fact]
    public async Task MergesDuplicateLines_AndReportsUnknownProducts()
    {
        var quote = await Price(new { items = new[] { new { productId = 4, quantity = 1 }, new { productId = 4, quantity = 2 }, new { productId = 999, quantity = 1 } } });

        Assert.Equal([(4, 3)], quote.Lines.Select(l => (l.ProductId, l.Quantity)));
        Assert.Equal([999], quote.UnavailableProductIds);
    }

    [Fact]
    public async Task EmptyCart_IsZero()
    {
        var quote = await Price(new { items = Array.Empty<object>() });
        Assert.Equal((0m, 0), (quote.Subtotal, quote.ItemCount));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(21)]
    [InlineData(-5)]
    public async Task InvalidQuantity_Is400(int quantity)
    {
        var response = await _client.PostAsJsonAsync("/api/cart/price", new { items = new[] { new { productId = 1, quantity } } });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        Assert.Contains("Quantity must be 1 to 20.", body!.Errors);
    }

    [Fact]
    public async Task TooManyLines_Is400()
    {
        var items = Enumerable.Range(1, 51).Select(i => new { productId = i, quantity = 1 });
        var response = await _client.PostAsJsonAsync("/api/cart/price", new { items });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
