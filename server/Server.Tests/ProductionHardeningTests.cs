using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Server.Api.Controllers;

namespace Server.Tests;

// Phase 15: production hardening (plan section 7)
public class ProductionHardeningTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Theory]
    [InlineData("/api/products")]
    [InlineData("/api/does-not-exist")] // error responses carry them too
    [InlineData("/health")]
    public async Task EveryResponse_CarriesTheSecurityHeaders(string url)
    {
        var response = await factory.CreateClient().GetAsync(url);

        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("DENY", response.Headers.GetValues("X-Frame-Options").Single());
        Assert.Equal("no-referrer", response.Headers.GetValues("Referrer-Policy").Single());
        Assert.Contains("frame-ancestors 'none'", response.Headers.GetValues("Content-Security-Policy").Single());
    }

    [Theory]
    [InlineData("br")]
    [InlineData("gzip")]
    public async Task JsonResponses_AreCompressed_WhenTheClientAcceptsIt(string encoding)
    {
        // A raw handler: HttpClient would otherwise decompress silently, and we couldn't see the header
        var client = factory.CreateDefaultClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/products?pageSize=20");
        request.Headers.AcceptEncoding.ParseAdd(encoding);

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(encoding, response.Content.Headers.ContentEncoding.Single());
        Assert.Contains("Accept-Encoding", response.Headers.Vary); // caches must keep compressed and plain copies apart
    }

    [Fact]
    public async Task NoCompression_WhenTheClientDoesNotAskForIt()
    {
        var response = await factory.CreateDefaultClient().GetAsync("/api/products");
        Assert.Empty(response.Content.Headers.ContentEncoding);
    }

    [Fact]
    public async Task Liveness_ChecksNothing_Readiness_ChecksTheDatabase()
    {
        var client = factory.CreateClient();

        var live = await client.GetAsync("/health/live");
        var ready = await client.GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.OK, live.StatusCode);
        Assert.Equal("no-store", live.Headers.CacheControl!.ToString());
        using var liveJson = JsonDocument.Parse(await live.Content.ReadAsStringAsync());
        Assert.Equal("Healthy", liveJson.RootElement.GetProperty("status").GetString());
        Assert.Empty(liveJson.RootElement.GetProperty("checks").EnumerateObject()); // no dependencies

        Assert.Equal(HttpStatusCode.OK, ready.StatusCode);
        using var readyJson = JsonDocument.Parse(await ready.Content.ReadAsStringAsync());
        Assert.Equal("Healthy", readyJson.RootElement.GetProperty("checks").GetProperty("database").GetString());
    }

    // ----- configuration fails FAST, at startup, with a clear message -----

    private Exception StartWith(string environment, params string[] origins) =>
        Record.Exception(() => factory.WithWebHostBuilder(b =>
        {
            b.UseEnvironment(environment);
            b.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(
                origins.Select((o, i) => new KeyValuePair<string, string?>($"Cors:AllowedOrigins:{i}", o))));
        }).CreateClient())!;

    [Fact]
    public void A_Wildcard_CorsOrigin_StopsTheApp()
    {
        var error = StartWith("Development", "*");
        var validation = Assert.IsType<OptionsValidationException>(error);
        Assert.Contains("wildcard", validation.Message);
    }

    [Theory]
    [InlineData("http://localhost:5173/")]     // trailing slash: browsers send the origin WITHOUT it, so it never matches
    [InlineData("https://shop.example.com/app")] // a path is not part of an origin
    public void A_MalformedOrigin_StopsTheApp(string origin)
    {
        var error = StartWith("Development", origin);
        Assert.Contains("is not an origin", Assert.IsType<OptionsValidationException>(error).Message);
    }

    [Fact]
    public void OutsideDevelopment_PlainHttpOrigins_AreRefused()
    {
        var error = StartWith("Production", "http://shop.example.com");
        Assert.Contains("must use https", Assert.IsType<OptionsValidationException>(error).Message);
    }

    [Fact]
    public void A_MissingConnectionString_StillStopsTheApi()
    {
        // The DbContext REGISTRATION tolerates it (the migration bundle needs that), but the API itself must not start
        var error = Record.Exception(() => factory.WithWebHostBuilder(b => b.ConfigureAppConfiguration((_, config) =>
            config.AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:DefaultConnection"] = "" }))).CreateClient());
        Assert.Contains("DefaultConnection is not configured", Assert.IsType<InvalidOperationException>(error).Message);
    }

    [Fact]
    public async Task Production_StartsWithValidSettings_AndHidesTheApiDocs()
    {
        using var production = factory.WithWebHostBuilder(b =>
        {
            b.UseEnvironment("Production");
            b.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Cors:AllowedOrigins:0"] = "https://shop.example.com",
                ["Cors:AllowedOrigins:1"] = "http://localhost:5173", // loopback over http is fine
            }));
        });
        var client = production.CreateClient();

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/live")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/openapi/v1.json")).StatusCode); // Development only
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/scalar")).StatusCode);
    }
}

// ----- forwarded headers: trusted ONLY when switched on -----

public class LowLimitFactory : ApiFactory
{
    protected override int RateLimit => 2;
}

public class BehindProxyFactory : LowLimitFactory
{
    protected override IReadOnlyDictionary<string, string?> ExtraSettings => new Dictionary<string, string?> { ["ForwardedHeaders:Enabled"] = "true" };
}

file static class Login
{
    public static async Task<HttpStatusCode> From(HttpClient client, string? forwardedFor)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login") { Content = JsonContent.Create(new LoginDto("x@x.com", "wrong")) };
        if (forwardedFor is not null) request.Headers.Add("X-Forwarded-For", forwardedFor);
        return (await client.SendAsync(request)).StatusCode;
    }
}

public class ForwardedHeadersOffTests(LowLimitFactory factory) : IClassFixture<LowLimitFactory>
{
    [Fact]
    public async Task ByDefault_A_SpoofedForwardedFor_DoesNotBuyAFreshRateLimitBucket()
    {
        var client = factory.CreateClient();
        await Login.From(client, "203.0.113.1");
        await Login.From(client, "203.0.113.2");

        // The header is IGNORED: every request still counts against the same (real) address
        Assert.Equal(HttpStatusCode.TooManyRequests, await Login.From(client, "203.0.113.3"));
    }
}

public class ForwardedHeadersOnTests(BehindProxyFactory factory) : IClassFixture<BehindProxyFactory>
{
    [Fact]
    public async Task BehindTheProxy_EachRealClientGetsItsOwnBucket()
    {
        var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, await Login.From(client, "198.51.100.7"));
        Assert.Equal(HttpStatusCode.Unauthorized, await Login.From(client, "198.51.100.7"));
        Assert.Equal(HttpStatusCode.TooManyRequests, await Login.From(client, "198.51.100.7")); // this client: over the limit

        Assert.Equal(HttpStatusCode.Unauthorized, await Login.From(client, "198.51.100.8")); // a different client: not blocked
    }
}

// ----- production's first admin -----

public class BootstrapAdminTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task CreatesTheFirstAdmin_OnlyWhileNoAdminExists()
    {
        // The database already has an admin (the demo one, or one an earlier test in this class made), so nothing happens
        Assert.False(await Server.Api.Auth.IdentitySeeder.EnsureBootstrapAdminAsync(factory.Services, "nobody@example.com", "Str0ng!Pass"));
        var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", new LoginDto("nobody@example.com", "Str0ng!Pass"))).StatusCode);
    }

    [Fact]
    public async Task OnAFreshDatabase_TheBootstrapAdminCanLogIn_AndReachTheAdminApi()
    {
        // Remove every admin, as on a fresh production database
        await factory.WithDbAsync(async db =>
        {
            var adminRole = db.Roles.Single(r => r.Name == "Admin").Id;
            db.UserRoles.RemoveRange(db.UserRoles.Where(ur => ur.RoleId == adminRole));
            return await db.SaveChangesAsync();
        });

        Assert.True(await Server.Api.Auth.IdentitySeeder.EnsureBootstrapAdminAsync(factory.Services, "boss@example.com", "Str0ng!Pass"));
        Assert.False(await Server.Api.Auth.IdentitySeeder.EnsureBootstrapAdminAsync(factory.Services, "other@example.com", "Str0ng!Pass")); // only once

        var client = factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login", new LoginDto("boss@example.com", "Str0ng!Pass"));
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        using var json = JsonDocument.Parse(await login.Content.ReadAsStringAsync());
        var token = json.RootElement.GetProperty("data").GetProperty("accessToken").GetString();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/admin/products")).StatusCode);
    }

    [Fact]
    public async Task A_WeakBootstrapPassword_StopsWithAClearMessage()
    {
        await factory.WithDbAsync(async db =>
        {
            var adminRole = db.Roles.Single(r => r.Name == "Admin").Id;
            db.UserRoles.RemoveRange(db.UserRoles.Where(ur => ur.RoleId == adminRole));
            return await db.SaveChangesAsync();
        });
        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => Server.Api.Auth.IdentitySeeder.EnsureBootstrapAdminAsync(factory.Services, "weak@example.com", "123"));
        Assert.Contains("bootstrap admin", error.Message);
    }
}
