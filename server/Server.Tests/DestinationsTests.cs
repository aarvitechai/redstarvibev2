using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Server.Api.Controllers;
using Server.Api.Models;
using Server.Api.Models.Dto;
using Server.Api.Services;

namespace Server.Tests;

public class PagedResultTests
{
    [Theory]
    [InlineData(1, 6, 14, 6, 3, true, false)]
    [InlineData(3, 6, 14, 2, 3, false, true)] // the last page holds the remainder
    [InlineData(9, 6, 14, 0, 3, false, true)] // past the end: empty, not an error
    [InlineData(1, 10, 0, 0, 0, false, false)]
    public void SkipTake_AndMetadata(int page, int size, int total, int count, int pages, bool next, bool prev)
    {
        var result = PagedResult<int>.From(Enumerable.Range(1, total), new PageRequest { Page = page, PageSize = size });
        Assert.Equal((count, total, pages, next, prev), (result.Items.Count, result.TotalCount, result.TotalPages, result.HasNext, result.HasPrevious));
    }
}

public class DestinationServiceTests
{
    private readonly InMemoryDestinationService _service = new(TimeProvider.System);

    [Fact]
    public void Paging_IsStable_AndCoversEveryItemExactlyOnce()
    {
        var seen = Enumerable.Range(1, 3).SelectMany(p => _service.Find(new(), new PageRequest { Page = p, PageSize = 6 }).Items).ToList();
        Assert.Equal(14, seen.Count);
        Assert.Equal(14, seen.Select(d => d.Id).Distinct().Count());
        Assert.Equal(seen.Select(d => d.Name).Order(StringComparer.OrdinalIgnoreCase), seen.Select(d => d.Name));
    }

    [Fact]
    public void Filters_SearchCountry_AndVisited()
    {
        var india = _service.Find(new("india"), new PageRequest { PageSize = 50 });
        Assert.Equal(5, india.TotalCount);
        var visitedInIndia = _service.Find(new("india", true), new PageRequest { PageSize = 50 });
        Assert.Equal(["Jaipur", "Varanasi"], visitedInIndia.Items.Select(d => d.Name));
    }

    [Fact]
    public void Duplicate_NameAndCountry_IsRejected_CaseInsensitive()
    {
        Assert.Equal(DestinationWriteError.Duplicate, _service.Create(new("  jaipur ", "INDIA", null, 3)).Error);
        Assert.True(_service.Create(new("Jaipur", "Mexico", null, 3)).Succeeded); // same name, different country: fine
    }
}

public class DestinationsEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    private async Task<HttpClient> LoggedInClient()
    {
        var login = await _client.PostAsJsonAsync("/api/auth/login", new LoginDto("asha@redstar.dev", "Customer@123"));
        var token = (await login.Content.ReadFromJsonAsync<ApiResponse<LoginResultDto>>())!.Data!.AccessToken;
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    [Fact]
    public async Task List_IsPublic_AndPaged()
    {
        var body = await _client.GetFromJsonAsync<ApiResponse<PagedResult<DestinationDto>>>("/api/destinations?page=2&pageSize=5");

        var page = body!.Data!;
        Assert.Equal((2, 5, 5), (page.Page, page.PageSize, page.Items.Count));
        Assert.True(page.TotalCount >= 14);
    }

    [Fact]
    public async Task PagingMetadata_IsInTheJson_ForClients()
    {
        var json = await _client.GetStringAsync("/api/destinations?pageSize=5");
        Assert.Contains("\"totalPages\":", json);
        Assert.Contains("\"hasNext\":true", json);
    }

    [Theory]
    [InlineData("page=0", "page")]
    [InlineData("pageSize=500", "pageSize")]
    [InlineData("visited=maybe", "visited")]
    public async Task InvalidPaging_Is400_OnThatField(string query, string field)
    {
        var response = await _client.GetAsync($"/api/destinations?{query}");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        Assert.True(body!.FieldErrors!.ContainsKey(field));
    }

    [Fact]
    public async Task Writes_RequireLogin()
    {
        var anonymous = await _client.PostAsJsonAsync("/api/destinations", new SaveDestinationDto("Goa", "India", null, 4));
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.DeleteAsync("/api/destinations/1")).StatusCode);
    }

    [Fact]
    public async Task Create_Visit_Update_Delete_WhenLoggedIn()
    {
        var client = await LoggedInClient();

        var created = await client.PostAsJsonAsync("/api/destinations", new SaveDestinationDto("Goa", "India", "Beaches", 4));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var id = (await created.Content.ReadFromJsonAsync<ApiResponse<DestinationDto>>())!.Data!.Id;

        var visited = await client.PutAsJsonAsync($"/api/destinations/{id}/visited", new SetVisitedDto(true));
        Assert.True((await visited.Content.ReadFromJsonAsync<ApiResponse<DestinationDto>>())!.Data!.IsVisited);

        var updated = await client.PutAsJsonAsync($"/api/destinations/{id}", new SaveDestinationDto("North Goa", "India", "Beaches", 5, true));
        Assert.Equal("North Goa", (await updated.Content.ReadFromJsonAsync<ApiResponse<DestinationDto>>())!.Data!.Name);

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/destinations/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/destinations/{id}")).StatusCode);
    }

    [Fact]
    public async Task Duplicate_Is409_OnTheNameField()
    {
        var client = await LoggedInClient();
        var response = await client.PostAsJsonAsync("/api/destinations", new SaveDestinationDto("Kyoto", "japan", null, 5));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        Assert.Equal(["Kyoto, japan is already in your list."], body!.FieldErrors!["name"]);
    }
}
