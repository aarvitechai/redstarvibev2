using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;
using Microsoft.IdentityModel.Tokens;
using Server.Api.Auth;
using Server.Api.Controllers;
using Server.Api.Models;
using Server.Api.Models.Entities;

namespace Server.Tests;

// Phase 12: Identity + signed JWTs, tested the way an attacker would probe them: directly, without any UI
public class AuthTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    private async Task<AuthResultDto> Login(string email = "asha@redstar.dev", string password = "Customer@123")
    {
        var response = await _client.PostAsJsonAsync("/api/auth/login", new LoginDto(email, password));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ApiResponse<AuthResultDto>>())!.Data!;
    }

    private async Task<HttpResponseMessage> Get(string url, string? token)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        if (token is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await _client.SendAsync(request);
    }

    private static JwtOptions Jwt(string? key = null) => new()
    {
        Issuer = "https://api.redstarvibe.local",
        Audience = "redstarvibe-clients",
        SigningKey = key ?? ApiFactory.TestSigningKey,
    };

    private static string TokenFor(ApplicationUser user, string[] roles, JwtOptions? options = null, TimeProvider? clock = null) =>
        new TokenService(Options.Create(options ?? Jwt()), clock ?? TimeProvider.System).CreateAccessToken(user, roles).Token;

    private static async Task<ApiResponse<object>> Body(HttpResponseMessage r) => (await r.Content.ReadFromJsonAsync<ApiResponse<object>>())!;

    // ---------- register ----------
    [Fact]
    public async Task Register_CreatesACustomer_AndSignsIn_AndStoresOnlyAPasswordHash()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/register", new { name = "Neha Patel", email = "neha@example.com", password = "Str0ng!Pass", role = "Admin" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var result = (await response.Content.ReadFromJsonAsync<ApiResponse<AuthResultDto>>())!.Data!;
        Assert.Equal(["Customer"], result.User.Roles); // "role": "Admin" in the body was ignored (no such DTO field)
        Assert.Equal(HttpStatusCode.OK, (await Get("/api/auth/me", result.AccessToken)).StatusCode);

        var hash = await factory.WithDbAsync(db => db.Users.Where(u => u.Email == "neha@example.com").Select(u => u.PasswordHash).SingleAsync());
        Assert.DoesNotContain("Str0ng!Pass", hash);
    }

    [Fact]
    public async Task Register_DuplicateEmail_Is409_OnTheEmailField()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/register", new RegisterDto("Copy", "ASHA@redstar.dev", "Str0ng!Pass"));
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal(["An account with this email already exists."], (await Body(response)).FieldErrors!["email"]);
    }

    [Fact]
    public async Task Register_WeakPassword_Is400_WithIdentitysRules()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/register", new RegisterDto("Weak", "weak@example.com", "password1"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await Body(response)).FieldErrors!["password"];
        Assert.Contains(errors, e => e.Contains("uppercase"));
        Assert.Contains(errors, e => e.Contains("non alphanumeric"));
    }

    // ---------- login ----------
    [Fact]
    public async Task Login_ReturnsAShortLivedJwt_AndARefreshTokenStoredOnlyAsAHash()
    {
        var result = await Login();

        Assert.Equal(3, result.AccessToken.Split('.').Length); // header.payload.signature
        Assert.InRange(result.ExpiresAt - DateTimeOffset.UtcNow, TimeSpan.FromMinutes(14), TimeSpan.FromMinutes(16));
        Assert.True(result.RefreshToken.Length > 60);

        var me = (await (await Get("/api/auth/me", result.AccessToken)).Content.ReadFromJsonAsync<ApiResponse<UserDto>>())!.Data!;
        Assert.Equal(("Asha Verma", "asha@redstar.dev"), (me.Name, me.Email));
        Assert.Equal(["Customer"], me.Roles);

        Assert.False(await factory.WithDbAsync(db => db.RefreshTokens.AnyAsync(t => t.TokenHash == result.RefreshToken)));
        Assert.True(await factory.WithDbAsync(db => db.RefreshTokens.AnyAsync(t => t.TokenHash == TokenService.Hash(result.RefreshToken))));
    }

    [Theory]
    [InlineData("asha@redstar.dev", "wrong")]
    [InlineData("nobody@redstar.dev", "Customer@123")]
    public async Task Login_Failure_IsA401_WithTheSameMessage(string email, string password)
    {
        var response = await _client.PostAsJsonAsync("/api/auth/login", new LoginDto(email, password));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(["Invalid email or password."], (await Body(response)).Errors);
    }

    [Fact]
    public async Task Lockout_AfterFiveWrongPasswords_EvenTheRightPasswordIsRefused()
    {
        await _client.PostAsJsonAsync("/api/auth/register", new RegisterDto("Lock Me", "lock@example.com", "Str0ng!Pass"));
        for (var i = 0; i < 5; i++) await _client.PostAsJsonAsync("/api/auth/login", new LoginDto("lock@example.com", "wrong"));

        var response = await _client.PostAsJsonAsync("/api/auth/login", new LoginDto("lock@example.com", "Str0ng!Pass"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(["Too many failed attempts. Try again in a few minutes."], (await Body(response)).Errors);
    }

    // ---------- the token is VALIDATED: each common JWT mistake is closed ----------
    [Fact]
    public async Task TamperedPayload_PromotingMyselfToAdmin_Is401()
    {
        var parts = (await Login()).AccessToken.Split('.');
        var payload = JsonSerializer.Deserialize<Dictionary<string, object>>(Base64UrlEncoder.Decode(parts[1]))!;
        payload["role"] = "Admin";
        var forged = $"{parts[0]}.{Base64UrlEncoder.Encode(JsonSerializer.Serialize(payload))}.{parts[2]}"; // the old signature no longer matches

        Assert.Equal(HttpStatusCode.Unauthorized, (await Get("/api/admin/summary", forged)).StatusCode);
    }

    [Fact]
    public async Task TheForgeablePhase8DemoToken_IsNowRejected()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await Get("/api/admin/summary", "demo.1.99999999999")).StatusCode);
    }

    [Fact]
    public async Task TokenSignedWithAnotherKey_Is401()
    {
        var mallory = new ApplicationUser { Id = Guid.NewGuid().ToString(), Name = "Mallory", Email = "m@evil.example" };
        var token = TokenFor(mallory, ["Admin"], Jwt("an-attackers-own-key-that-is-long-enough-0123456789"));
        Assert.Equal(HttpStatusCode.Unauthorized, (await Get("/api/admin/summary", token)).StatusCode);
    }

    [Fact]
    public async Task WrongIssuerOrAudience_Is401()
    {
        var user = new ApplicationUser { Id = Guid.NewGuid().ToString(), Name = "X", Email = "x@x.com" };
        var wrongIssuer = Jwt(); wrongIssuer.Issuer = "https://someone-else.example";
        var wrongAudience = Jwt(); wrongAudience.Audience = "another-app";
        Assert.Equal(HttpStatusCode.Unauthorized, (await Get("/api/auth/me", TokenFor(user, [], wrongIssuer))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Get("/api/auth/me", TokenFor(user, [], wrongAudience))).StatusCode);
    }

    [Fact]
    public async Task ExpiredToken_Is401()
    {
        var user = await factory.WithDbAsync(db => db.Users.SingleAsync(u => u.Email == "asha@redstar.dev"));
        var anHourAgo = new FakeTimeProvider(DateTimeOffset.UtcNow.AddHours(-1)); // issued an hour ago, valid for 15 minutes
        Assert.Equal(HttpStatusCode.Unauthorized, (await Get("/api/auth/me", TokenFor(user, ["Customer"], clock: anHourAgo))).StatusCode);
    }

    [Fact]
    public async Task UnsignedAlgNoneToken_Is401()
    {
        var header = Base64UrlEncoder.Encode("""{"alg":"none","typ":"JWT"}""");
        var payload = Base64UrlEncoder.Encode($$"""{"sub":"x","role":"Admin","iss":"https://api.redstarvibe.local","aud":"redstarvibe-clients","exp":{{DateTimeOffset.UtcNow.AddHours(1).ToUnixTimeSeconds()}}}""");
        Assert.Equal(HttpStatusCode.Unauthorized, (await Get("/api/admin/summary", $"{header}.{payload}.")).StatusCode);
    }

    // ---------- 401 vs 403 ----------
    [Fact]
    public async Task AdminEndpoint_Anonymous401_Customer403_Admin200()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await Get("/api/admin/summary", null)).StatusCode);
        var forbidden = await Get("/api/admin/summary", (await Login()).AccessToken);
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
        Assert.Equal(["You don't have permission to do that."], (await Body(forbidden)).Errors);
        Assert.Equal(HttpStatusCode.OK, (await Get("/api/admin/summary", (await Login("admin@redstar.dev", "Admin@123")).AccessToken)).StatusCode);
    }

    // ---------- refresh tokens ----------
    private Task<HttpResponseMessage> Refresh(string refreshToken) => _client.PostAsJsonAsync("/api/auth/refresh", new RefreshDto(refreshToken));

    [Fact]
    public async Task Refresh_RotatesBothTokens()
    {
        var first = await Login();
        var response = await Refresh(first.RefreshToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var second = (await response.Content.ReadFromJsonAsync<ApiResponse<AuthResultDto>>())!.Data!;
        Assert.NotEqual(first.RefreshToken, second.RefreshToken);
        Assert.Equal(HttpStatusCode.OK, (await Get("/api/auth/me", second.AccessToken)).StatusCode);
    }

    [Fact]
    public async Task ReusingAnOldRefreshToken_RevokesTheWholeSession()
    {
        var first = await Login();
        var second = (await (await Refresh(first.RefreshToken)).Content.ReadFromJsonAsync<ApiResponse<AuthResultDto>>())!.Data!;

        // Someone replays the OLD token (was it stolen?): refused, AND the newer one is revoked too
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(first.RefreshToken)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(second.RefreshToken)).StatusCode);
    }

    [Fact]
    public async Task Refresh_WithAnUnknownToken_Is401()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh("not-a-real-token")).StatusCode);
    }

    [Fact]
    public async Task Logout_RevokesTheRefreshToken()
    {
        var session = await Login();
        Assert.Equal(HttpStatusCode.NoContent, (await _client.PostAsJsonAsync("/api/auth/logout", new RefreshDto(session.RefreshToken))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(session.RefreshToken)).StatusCode);
    }

    // ---------- configuration safety ----------
    [Fact]
    public void AShortSigningKey_StopsTheAppAtStartup()
    {
        using var weak = factory.WithWebHostBuilder(b => b.ConfigureAppConfiguration((_, c) =>
            c.AddInMemoryCollection(new Dictionary<string, string?> { ["Jwt:SigningKey"] = "short" })));

        var error = Assert.ThrowsAny<Exception>(() => weak.CreateClient());
        Assert.Contains("Jwt:SigningKey must be at least 32 characters", error.ToString());
    }

    [Fact]
    public void DemoUsers_RefuseToSeed_OutsideDevelopment()
    {
        using var production = factory.WithWebHostBuilder(b =>
        {
            b.UseEnvironment("Production");
            b.ConfigureAppConfiguration((_, c) => c.AddInMemoryCollection(new Dictionary<string, string?> { ["Auth:SeedDemoUsers"] = "true" }));
        });
        var error = Assert.ThrowsAny<Exception>(() => production.CreateClient());
        Assert.Contains("must only be true in Development", error.ToString());
    }

    // ---------- CORS: the browser's rules, checked with a preflight ----------
    [Theory]
    [InlineData("http://localhost:5173", true)]
    [InlineData("http://localhost:4200", true)]
    [InlineData("https://evil.example", false)]
    public async Task CorsPreflight_OnlyAllowsTheKnownClients(string origin, bool allowed)
    {
        var preflight = new HttpRequestMessage(HttpMethod.Options, "/api/auth/login");
        preflight.Headers.Add("Origin", origin);
        preflight.Headers.Add("Access-Control-Request-Method", "POST");
        preflight.Headers.Add("Access-Control-Request-Headers", "content-type,authorization");

        var response = await _client.SendAsync(preflight);

        var granted = response.Headers.TryGetValues("Access-Control-Allow-Origin", out var values) && values.Single() == origin;
        Assert.Equal(allowed, granted);
    }
}

// A separate factory with a SMALL limit, so the rate limiter can be tested without slowing every other test
public class LowRateLimitApiFactory : ApiFactory
{
    protected override int RateLimit => 3;
}

public class RateLimitTests(LowRateLimitApiFactory factory) : IClassFixture<LowRateLimitApiFactory>
{
    [Fact]
    public async Task Login_IsRateLimited_429_WithRetryAfter_OtherEndpointsAreNot()
    {
        var client = factory.CreateClient();
        for (var i = 0; i < 3; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", new LoginDto("x@x.com", "wrong"))).StatusCode);

        var blocked = await client.PostAsJsonAsync("/api/auth/login", new LoginDto("x@x.com", "wrong"));

        Assert.Equal(HttpStatusCode.TooManyRequests, blocked.StatusCode);
        Assert.Equal("60", blocked.Headers.GetValues("Retry-After").Single());
        Assert.Equal(["Too many attempts. Please wait a minute and try again."], (await blocked.Content.ReadFromJsonAsync<ApiResponse<object>>())!.Errors);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/products")).StatusCode);
    }
}
