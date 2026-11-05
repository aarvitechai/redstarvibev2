using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Server.Api.Models;
using Server.Api.Models.Dto;

namespace Server.Tests;

// Phase 3: write endpoints. This class gets its OWN factory (and so its own singleton service),
// which means the writes here never affect the read tests in StudentsEndpointTests.
// Each test uses its own email, so the tests don't depend on running in a particular order.
public class StudentsWriteEndpointTests(ApiFactory factory)
    : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    private static CreateStudentDto NewStudent(string email) => new("Test Student", email, "Physics", 2);

    [Fact]
    public async Task Create_Returns201_WithLocation_AndServerAssignedFields()
    {
        var response = await _client.PostAsJsonAsync("/api/students", NewStudent("create@example.com"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<StudentDto>>();
        Assert.True(body!.Data!.Id > 4);
        Assert.True(body.Data.IsActive);
        Assert.Equal($"/api/students/{body.Data.Id}", response.Headers.Location!.AbsolutePath, ignoreCase: true);
    }

    [Fact]
    public async Task Create_IgnoresIdSentByClient_OverPostingIsImpossible()
    {
        var response = await _client.PostAsJsonAsync("/api/students",
            new { id = 1, name = "Hacker", email = "overpost@example.com", course = "Physics", year = 1, isActive = false });

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<StudentDto>>();
        Assert.NotEqual(1, body!.Data!.Id);   // the server chose the id
        Assert.True(body.Data.IsActive);       // the server chose isActive
    }

    [Fact]
    public async Task Create_Invalid_Returns400_WithEnvelopeErrors()
    {
        var response = await _client.PostAsJsonAsync("/api/students", new { name = "A", email = "not-an-email", course = "", year = 9 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        Assert.False(body!.Success);
        Assert.NotEmpty(body.Errors);
        // Phase 5: errors are also grouped per field (camelCase), so forms can show them next to each input
        Assert.Equal(["course", "email", "name", "year"], body.FieldErrors!.Keys.Order());
    }

    [Fact]
    public async Task Create_DuplicateEmail_Returns409_CaseInsensitive()
    {
        var response = await _client.PostAsJsonAsync("/api/students", NewStudent("ASHA@example.com"));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Update_Existing_Returns200_AndPersists()
    {
        var created = await (await _client.PostAsJsonAsync("/api/students", NewStudent("update@example.com")))
            .Content.ReadFromJsonAsync<ApiResponse<StudentDto>>();
        var id = created!.Data!.Id;

        var response = await _client.PutAsJsonAsync($"/api/students/{id}",
            new UpdateStudentDto("Renamed", "update@example.com", "Chemistry", 3, false));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var reloaded = await _client.GetFromJsonAsync<ApiResponse<StudentDto>>($"/api/students/{id}");
        Assert.Equal(new StudentDto(id, "Renamed", "update@example.com", "Chemistry", 3, false), reloaded!.Data);
    }

    [Fact]
    public async Task Update_Missing_Returns404()
    {
        var response = await _client.PutAsJsonAsync("/api/students/999",
            new UpdateStudentDto("Nobody", "nobody@example.com", "None", 1, true));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Delete_Returns204_ThenGetReturns404()
    {
        var created = await (await _client.PostAsJsonAsync("/api/students", NewStudent("delete@example.com")))
            .Content.ReadFromJsonAsync<ApiResponse<StudentDto>>();
        var id = created!.Data!.Id;

        Assert.Equal(HttpStatusCode.NoContent, (await _client.DeleteAsync($"/api/students/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"/api/students/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.DeleteAsync($"/api/students/{id}")).StatusCode);
    }
}
