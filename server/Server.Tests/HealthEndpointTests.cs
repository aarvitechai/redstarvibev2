using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Server.Tests;

// Phase 0 smoke test: proves the API boots in-memory and /health answers.
public class HealthEndpointTests(ApiFactory factory)
    : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Health_ReturnsOk()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
