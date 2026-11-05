using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Server.Api.Models;
using Server.Api.Models.Dto;

namespace Server.Tests;

// Phase 2: integration tests run the real pipeline in memory (routing, DI, JSON) without a browser.
public class StudentsEndpointTests(WebApplicationFactory<Program> factory)
    : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task GetAll_Returns200_WithEnvelope()
    {
        var response = await _client.GetAsync("/api/students");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<List<StudentDto>>>();
        Assert.NotNull(body);
        Assert.True(body.Success);
        Assert.Equal(4, body.Data!.Count);
        Assert.Empty(body.Errors);
    }

    [Fact]
    public async Task GetAll_UsesCamelCaseJson_ForJavaScriptClients()
    {
        var json = await _client.GetStringAsync("/api/students");

        Assert.Contains("\"success\":true", json);
        Assert.Contains("\"isActive\":", json);
    }

    [Fact]
    public async Task GetById_Existing_Returns200()
    {
        var body = await _client.GetFromJsonAsync<ApiResponse<StudentDto>>("/api/students/1");

        Assert.Equal("Asha Verma", body!.Data!.Name);
    }

    [Fact]
    public async Task GetById_Missing_Returns404_WithErrorMessage()
    {
        var response = await _client.GetAsync("/api/students/99");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<StudentDto>>();
        Assert.False(body!.Success);
        Assert.Null(body.Data);
        Assert.Contains("Student 99 not found", body.Errors);
    }
}
