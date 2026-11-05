using System.Data.Common;
using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Server.Api.Data;
using Server.Api.Models;
using Server.Api.Models.Dto;
using Server.Api.Services;

namespace Server.Tests;

// Phase 11: the catalogue now runs on SQL Server (a throwaway test database per class, see ApiFactory)
public class ProductCatalogEfTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private Task<T> Catalog<T>(Func<IProductCatalog, Task<T>> work) =>
        factory.WithDbAsync(db => work(new EfProductCatalog(db)));

    [Fact]
    public async Task SeedData_CameFromTheMigration()
    {
        var categories = await Catalog(c => c.GetCategoriesAsync());
        Assert.Equal(["burgers", "pizza", "drinks", "desserts"], categories.Select(c => c.Slug));
        Assert.Equal(11, await Catalog(c => c.CountAsync()));
    }

    [Fact]
    public async Task Filters_SortAndPage_InSql()
    {
        var burgers = await Catalog(c => c.FindAsync(new ProductQuery("BURGERS", null, ProductSort.PriceDesc), new PageRequest { PageSize = 2 }));

        Assert.Equal(["Double Smash", "Classic Burger"], burgers.Items.Select(p => p.Name)); // page 1 of 2
        Assert.Equal((3, 2, true), (burgers.TotalCount, burgers.TotalPages, burgers.HasNext));
    }

    [Theory]
    [InlineData("paneer", new[] { "Paneer Tikka Pizza" })] // name
    [InlineData("CARDAMOM", new[] { "Mango Lassi" })]     // description, case-insensitive (SQL collation)
    [InlineData("%", new string[0])]                       // a LIKE wildcard is ESCAPED: it matches a literal "%", not everything
    [InlineData("'; DROP TABLE Products; --", new string[0])] // just a parameter value: nothing happens
    public async Task Search_IsParameterised_AndEscaped(string term, string[] expected)
    {
        var result = await Catalog(c => c.FindAsync(new ProductQuery(Search: term), new PageRequest { PageSize = 50 }));
        Assert.Equal(expected, result.Items.Select(p => p.Name));
        Assert.Equal(11, await Catalog(c => c.CountAsync())); // the table is still there
    }

    [Fact]
    public async Task GetByIds_ReturnsOnlyExistingProducts()
    {
        var found = await Catalog(c => c.GetByIdsAsync([1, 7, 999]));
        Assert.Equal([1, 7], found.Select(p => p.Id).Order());
    }
}

// Counts the SQL commands EF sends, to PROVE there is no N+1
public sealed class CommandCounter : DbCommandInterceptor
{
    private int _count;
    public int Count => _count;
    public void Reset() => Interlocked.Exchange(ref _count, 0);

    public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
        DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken ct = default)
    {
        Interlocked.Increment(ref _count);
        return base.ReaderExecutingAsync(command, eventData, result, ct);
    }
}

public class ProductQueryCountTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly CommandCounter _counter = new();

    private HttpClient Client() => factory.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        s.ConfigureDbContext<ApplicationDbContext>(o => o.AddInterceptors(_counter)))).CreateClient();

    [Fact]
    public async Task ProductList_IsTwoQueries_CountAndOnePage_NoMatterHowManyRows()
    {
        var client = Client();
        _counter.Reset();

        var body = await client.GetFromJsonAsync<ApiResponse<PagedResult<ProductDto>>>("/api/products?pageSize=11");

        Assert.Equal(11, body!.Data!.Items.Count);
        Assert.All(body.Data.Items, p => Assert.False(string.IsNullOrEmpty(p.CategoryName))); // the join is included...
        Assert.Equal(2, _counter.Count); // ...in the same query: COUNT(*) + one SELECT, NOT 1 + 11 (N+1)
    }

    [Fact]
    public async Task CartPricing_IsOneQuery_ForAnyNumberOfLines()
    {
        var client = Client();
        _counter.Reset();

        var items = Enumerable.Range(1, 11).Select(id => new { productId = id, quantity = 1 });
        (await client.PostAsJsonAsync("/api/cart/price", new { items })).EnsureSuccessStatusCode();

        Assert.Equal(1, _counter.Count); // WHERE Id IN (...), not one query per line
    }
}

public class ProductsEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Categories_ReturnsAll()
    {
        var body = await _client.GetFromJsonAsync<ApiResponse<List<CategoryDto>>>("/api/categories");
        Assert.Equal(["burgers", "pizza", "drinks", "desserts"], body!.Data!.Select(c => c.Slug));
    }

    [Fact]
    public async Task Products_AreNowPaged_WithFiltersAndSort()
    {
        var body = await _client.GetFromJsonAsync<ApiResponse<PagedResult<ProductDto>>>("/api/products?category=drinks&sort=priceAsc");
        Assert.Equal(["Lemon Iced Tea", "Mango Lassi", "Cold Coffee"], body!.Data!.Items.Select(p => p.Name));
        Assert.Equal(3, body.Data.TotalCount);
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

    [Fact]
    public async Task Health_IncludesTheDatabase()
    {
        var response = await _client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync());
    }
}

public class DependencyInjectionLifetimeTests
{
    private interface IScopedThing;
    private sealed class ScopedThing : IScopedThing;
    private sealed class SingletonThatCapturesScoped(IScopedThing scoped)
    {
        public IScopedThing Scoped { get; } = scoped;
    }

    [Fact]
    public void ScopeValidation_CatchesACaptiveDependency()
    {
        // A SINGLETON holding a SCOPED service would keep ONE request's DbContext alive forever and share it across
        // requests. ASP.NET Core checks this in Development (ValidateScopes), and fails at startup instead of in production.
        var services = new ServiceCollection();
        services.AddScoped<IScopedThing, ScopedThing>();
        services.AddSingleton<SingletonThatCapturesScoped>();
        var error = Assert.Throws<AggregateException>(() =>
            services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true, ValidateOnBuild = true }));

        Assert.Contains("Cannot consume scoped service", error.Message);
    }

    [Fact]
    public void Lifetimes_SameInstancePerScope_ForScoped()
    {
        var services = new ServiceCollection();
        services.AddScoped<IScopedThing, ScopedThing>();
        using var provider = services.BuildServiceProvider();

        using var a = provider.CreateScope();
        using var b = provider.CreateScope();
        Assert.Same(a.ServiceProvider.GetRequiredService<IScopedThing>(), a.ServiceProvider.GetRequiredService<IScopedThing>()); // same request
        Assert.NotSame(a.ServiceProvider.GetRequiredService<IScopedThing>(), b.ServiceProvider.GetRequiredService<IScopedThing>()); // another request
    }
}
