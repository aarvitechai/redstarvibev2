using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;
using Server.Api.Auth;
using Server.Api.Controllers;
using Server.Api.Models;
using Server.Api.Services;

namespace Server.Tests;

// Phase 8: the SERVER decides who may do what. These tests call the API directly (no browser, no route guards),
// which is exactly what an attacker would do.
public class AuthTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client = factory.CreateClient();

    private async Task<string> LoginAs(string email, string password)
    {
        var response = await _client.PostAsJsonAsync("/api/auth/login", new LoginDto(email, password));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ApiResponse<LoginResultDto>>())!.Data!.AccessToken;
    }

    private async Task<HttpResponseMessage> GetWithToken(string url, string? token)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        if (token is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await _client.SendAsync(request);
    }

    [Fact]
    public async Task Login_ReturnsTokenExpiryAndUser()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/login", new LoginDto("ADMIN@redstar.dev", "Admin@123"));

        var body = (await response.Content.ReadFromJsonAsync<ApiResponse<LoginResultDto>>())!.Data!;
        Assert.StartsWith("demo.1.", body.AccessToken);
        Assert.Equal(["Admin"], body.User.Roles);
        Assert.InRange(body.ExpiresAt - DateTimeOffset.UtcNow, TimeSpan.FromMinutes(29), TimeSpan.FromMinutes(31));
    }

    [Theory]
    [InlineData("admin@redstar.dev", "wrong")]   // wrong password
    [InlineData("nobody@redstar.dev", "Admin@123")] // unknown email
    public async Task Login_Failure_IsA401_WithTheSameMessage(string email, string password)
    {
        var response = await _client.PostAsJsonAsync("/api/auth/login", new LoginDto(email, password));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        Assert.Equal(["Invalid email or password."], body!.Errors); // no hint about which part was wrong
    }

    [Fact]
    public async Task Me_WithoutToken_Is401_WithEnvelope()
    {
        var response = await GetWithToken("/api/auth/me", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("Bearer", response.Headers.WwwAuthenticate.Single().Scheme);
        Assert.Equal(["Please log in to continue."], (await response.Content.ReadFromJsonAsync<ApiResponse<object>>())!.Errors);
    }

    [Fact]
    public async Task Me_ReturnsTheUserFromTheTokenClaims()
    {
        var token = await LoginAs("asha@redstar.dev", "Customer@123");

        var me = await (await GetWithToken("/api/auth/me", token)).Content.ReadFromJsonAsync<ApiResponse<UserDto>>();

        // (Records compare lists by reference, so check the fields one by one)
        Assert.Equal((2, "Asha Verma", "asha@redstar.dev"), (me!.Data!.Id, me.Data.Name, me.Data.Email));
        Assert.Equal(["Customer"], me.Data.Roles);
    }

    [Fact]
    public async Task AdminEndpoint_Anonymous401_Customer403_Admin200()
    {
        var customer = await LoginAs("asha@redstar.dev", "Customer@123");
        var admin = await LoginAs("admin@redstar.dev", "Admin@123");

        Assert.Equal(HttpStatusCode.Unauthorized, (await GetWithToken("/api/admin/summary", null)).StatusCode);
        var forbidden = await GetWithToken("/api/admin/summary", customer);
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode); // a customer who skips the UI still can't get in
        Assert.Equal(["You don't have permission to do that."], (await forbidden.Content.ReadFromJsonAsync<ApiResponse<object>>())!.Errors);

        var ok = await GetWithToken("/api/admin/summary", admin);
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.True((await ok.Content.ReadFromJsonAsync<ApiResponse<AdminController.SummaryDto>>())!.Data!.Products > 0);
    }

    [Theory]
    [InlineData("garbage")]
    [InlineData("demo.999.99999999999")] // unknown user
    [InlineData("demo.1.notanumber")]
    public async Task BadTokens_Are401(string token)
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await GetWithToken("/api/auth/me", token)).StatusCode);
    }

    [Fact]
    public async Task ExpiredToken_Is401()
    {
        var clock = new FakeTimeProvider(DateTimeOffset.UtcNow);
        var client = factory.WithWebHostBuilder(b => b.ConfigureTestServices(s => s.AddSingleton<TimeProvider>(clock))).CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login", new LoginDto("admin@redstar.dev", "Admin@123"));
        var token = (await login.Content.ReadFromJsonAsync<ApiResponse<LoginResultDto>>())!.Data!.AccessToken;

        clock.Advance(DemoTokens.Lifetime + TimeSpan.FromSeconds(1));

        var request = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(request)).StatusCode);
    }

    [Fact]
    public void DemoTokens_AreForgeable_WhichIsWhyPhase12UsesSignedJwts()
    {
        // Anyone can write a token for user 1 (the admin) with any expiry. Nothing proves the server issued it.
        var forged = $"demo.1.{DateTimeOffset.UtcNow.AddYears(10).ToUnixTimeSeconds()}";
        Assert.True(DemoTokens.TryParse(forged, out var id, out _));
        Assert.Equal(1, id);
    }

    [Fact]
    public async Task WithDemoAuthOff_LoginIs404_AndProtectedEndpointsAre401_Not500()
    {
        var client = factory.WithWebHostBuilder(b => b.ConfigureTestServices(s => s.AddSingleton(new DemoAuthSettings(false)))).CreateClient();

        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsJsonAsync("/api/auth/login", new LoginDto("admin@redstar.dev", "Admin@123"))).StatusCode);
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", "demo.1.99999999999");
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(request)).StatusCode);
    }

    [Fact]
    public void DemoAuth_RefusesToStart_OutsideDevelopment()
    {
        using var production = factory.WithWebHostBuilder(b =>
        {
            b.UseEnvironment("Production");
            b.UseSetting("Auth:DemoTokensEnabled", "true");
        });

        var error = Assert.Throws<InvalidOperationException>(() => production.CreateClient());
        Assert.Contains("must only be true in Development", error.Message);
    }

    [Fact]
    public void SeededContacts_StillLoad_WithTimeProviderRegistered()
    {
        // Regression test for the two-constructor DI bug: the app's contact service must be seeded
        var service = factory.Services.GetRequiredService<IContactService>();
        Assert.True(service.GetAll().Count >= 3);
    }
}
