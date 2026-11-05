using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Server.Api.Models;
using Server.Api.Models.Dto;
using Server.Api.Services;

namespace Server.Tests;

// Phase 4: search. Unit tests for the matching rules, plus integration tests for the query string and validation.
public class StudentSearchServiceTests
{
    private readonly InMemoryStudentService _service = new();

    [Theory]
    [InlineData("comp", new[] { 1, 4 })]      // course
    [InlineData("COMP", new[] { 1, 4 })]      // case-insensitive
    [InlineData("ravi@", new[] { 2 })]         // email
    [InlineData("  meera  ", new[] { 3 })]     // trimmed
    [InlineData("zzz", new int[0])]            // no match
    public void Search_MatchesNameEmailOrCourse(string term, int[] expectedIds)
    {
        Assert.Equal(expectedIds, _service.GetAll(term).Select(s => s.Id));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void EmptySearch_ReturnsEveryone(string? term)
    {
        Assert.Equal(4, _service.GetAll(term).Count);
    }
}

public class StudentSearchEndpointTests(ApiFactory factory)
    : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Search_QueryString_FiltersResults()
    {
        var body = await _client.GetFromJsonAsync<ApiResponse<List<StudentDto>>>("/api/students?search=mech");

        Assert.Equal(["Ravi Kumar"], body!.Data!.Select(s => s.Name));
    }

    [Fact]
    public async Task Search_TooLong_Returns400_WithEnvelope()
    {
        var response = await _client.GetAsync($"/api/students?search={new string('a', 101)}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        Assert.True(body!.FieldErrors!.ContainsKey("search"));
    }
}
