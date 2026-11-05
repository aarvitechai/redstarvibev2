using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;
using Server.Api.Middleware;
using Server.Api.Models;
using Server.Api.Models.Dto;
using Server.Api.Services;

namespace Server.Tests;

// A student service that always crashes, used to trigger the global exception handler without adding
// a "throw" endpoint to the real app
file sealed class ExplodingStudentService : IStudentService
{
    public IReadOnlyList<StudentDto> GetAll(string? search = null) =>
        throw new InvalidOperationException("SECRET connection string leaked in exception");
    public StudentDto? GetById(int id) => throw new NotImplementedException();
    public StudentWriteResult Create(CreateStudentDto input) => throw new NotImplementedException();
    public StudentWriteResult Update(int id, UpdateStudentDto input) => throw new NotImplementedException();
    public bool Delete(int id) => throw new NotImplementedException();
}

public class CorrelationAndErrorTests(ApiFactory factory)
    : IClassFixture<ApiFactory>
{
    private const string Header = CorrelationIdMiddleware.HeaderName;

    [Fact]
    public async Task EchoesASafeClientCorrelationId()
    {
        var client = factory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Get, "/health");
        request.Headers.Add(Header, "web-1234.abc_DEF");

        var response = await client.SendAsync(request);

        Assert.Equal("web-1234.abc_DEF", response.Headers.GetValues(Header).Single());
    }

    [Theory]
    [InlineData("")]                                  // missing
    [InlineData("bad id with spaces")]                // unsafe characters
    [InlineData("line1\\nFAKE LOG ENTRY")]            // log injection attempt
    public async Task ReplacesMissingOrUnsafeIds_WithAGeneratedOne(string incoming)
    {
        var client = factory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Get, "/health");
        if (incoming != "") request.Headers.TryAddWithoutValidation(Header, incoming);

        var response = await client.SendAsync(request);

        var id = response.Headers.GetValues(Header).Single();
        Assert.NotEqual(incoming, id);
        Assert.Matches("^[0-9a-f]{32}$", id); // a new Guid ("N" format)
    }

    [Fact]
    public async Task Cors_ExposesTheCorrelationHeader_ToBrowserJavaScript()
    {
        var client = factory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/students");
        request.Headers.Add("Origin", "http://localhost:5173");

        var response = await client.SendAsync(request);

        Assert.Contains(Header, response.Headers.GetValues("Access-Control-Expose-Headers").Single());
    }

    [Fact]
    public async Task UnhandledException_Returns500Envelope_WithReference_AndNoInternals()
    {
        var client = factory.WithWebHostBuilder(b => b.ConfigureTestServices(services =>
            services.AddSingleton<IStudentService, ExplodingStudentService>())).CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/students");
        request.Headers.Add(Header, "trace-me-500");

        var response = await client.SendAsync(request);
        var raw = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Equal("trace-me-500", response.Headers.GetValues(Header).Single());
        var body = System.Text.Json.JsonSerializer.Deserialize<ApiResponse<object>>(raw, System.Text.Json.JsonSerializerOptions.Web);
        Assert.False(body!.Success);
        Assert.Equal(["An unexpected error occurred. Reference: trace-me-500"], body.Errors);
        Assert.DoesNotContain("SECRET", raw);         // no exception message
        Assert.DoesNotContain("StackTrace", raw);     // no stack trace
    }

    [Fact]
    public async Task RequestLog_IsStructured_AndCarriesTheCorrelationScope()
    {
        var withFakeLogs = factory.WithWebHostBuilder(b => b.ConfigureTestServices(services =>
            services.AddLogging(logging => logging.AddFakeLogging())));
        var client = withFakeLogs.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/students/99?secret=token");
        request.Headers.Add(Header, "log-check-1");

        await client.SendAsync(request);

        var collector = withFakeLogs.Services.GetFakeLogCollector(); // the DERIVED factory's services
        var entry = collector.GetSnapshot().Last(r => r.Category == typeof(RequestLoggingMiddleware).FullName);

        Assert.Equal(LogLevel.Warning, entry.Level); // 404 -> Warning
        Assert.Contains(entry.StructuredState!, kv => kv.Key == "StatusCode" && kv.Value == "404");
        Assert.Contains(entry.StructuredState!, kv => kv.Key == "Path" && kv.Value == "/api/students/99");
        Assert.DoesNotContain("secret=token", entry.Message); // the query string is never logged
        Assert.Contains(entry.Scopes, s => s is IEnumerable<KeyValuePair<string, object>> kv &&
            kv.Any(p => p.Key == "CorrelationId" && (string)p.Value == "log-check-1"));
    }
}
