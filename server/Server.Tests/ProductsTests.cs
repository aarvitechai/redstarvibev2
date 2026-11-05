using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Server.Api.Models;
using Server.Api.Models.Dto;
using Server.Api.Services;

namespace Server.Tests;

public class ProductCatalogTests
{
    private readonly InMemoryProductCatalog _catalog = new();

    [Fact]
    public void Category_IsMatchedBySlug_CaseInsensitive()
    {
        Assert.All(_catalog.Find(new ProductQuery(Category: "PIZZA")), p => Assert.Equal("pizza", p.CategorySlug));
        Assert.Empty(_catalog.Find(new ProductQuery(Category: "unknown")));
    }

    [Fact]
    public void Search_MatchesNameOrDescription()
    {
        Assert.Equal(["Paneer Tikka Pizza"], _catalog.Find(new ProductQuery(Search: "paneer")).Select(p => p.Name));
        Assert.Equal(["Mango Lassi"], _catalog.Find(new ProductQuery(Search: "cardamom")).Select(p => p.Name));
    }

    [Fact]
    public void Filters_Combine_AndSortIsApplied()
    {
        var burgers = _catalog.Find(new ProductQuery("burgers", null, ProductSort.PriceDesc));
        Assert.Equal(["Double Smash", "Classic Burger", "Veggie Burger"], burgers.Select(p => p.Name));

        var cheapFirst = _catalog.Find(new ProductQuery(Sort: ProductSort.PriceAsc));
        Assert.Equal(cheapFirst.Select(p => p.Price).Order(), cheapFirst.Select(p => p.Price));
    }
}

public class ProductsEndpointTests(WebApplicationFactory<Program> factory)
    : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Categories_ReturnsAll()
    {
        var body = await _client.GetFromJsonAsync<ApiResponse<List<CategoryDto>>>("/api/categories");
        Assert.Equal(["burgers", "pizza", "drinks", "desserts"], body!.Data!.Select(c => c.Slug));
    }

    [Fact]
    public async Task Products_QueryString_FiltersAndSorts()
    {
        var body = await _client.GetFromJsonAsync<ApiResponse<List<ProductDto>>>("/api/products?category=drinks&sort=priceAsc");
        Assert.Equal(["Lemon Iced Tea", "Mango Lassi", "Cold Coffee"], body!.Data!.Select(p => p.Name));
    }

    [Fact]
    public async Task Products_UnknownSort_Returns400_OnTheSortField()
    {
        var response = await _client.GetAsync("/api/products?sort=price;DROP TABLE");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        Assert.True(body!.FieldErrors!.ContainsKey("sort"));
    }

    [Fact]
    public async Task ProductById_200_And404()
    {
        var found = await _client.GetFromJsonAsync<ApiResponse<ProductDto>>("/api/products/4");
        Assert.Equal("Margherita", found!.Data!.Name);

        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync("/api/products/999")).StatusCode);
    }
}
