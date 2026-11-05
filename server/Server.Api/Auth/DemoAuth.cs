using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using Server.Api.Constants;
using Server.Api.Models;

namespace Server.Api.Auth;

// ============================================================================================
//  PHASE 8 DEMO AUTH: DEVELOPMENT ONLY. Phase 12 replaces ALL of this with ASP.NET Core Identity + signed JWTs.
//  The token is "demo.<userId>.<expiresUnix>". It is NOT signed, so anyone can forge one (change the id or
//  the expiry). That is exactly the problem a JWT signature solves. Program.cs refuses to start with this
//  enabled outside Development.
// ============================================================================================

public record DemoAuthSettings(bool Enabled);

public record DemoUser(int Id, string Name, string Email, string Password, IReadOnlyList<string> Roles);

public static class DemoUsers
{
    // Demo credentials, shown on the login page. Real passwords are hashed by Identity in Phase 12.
    public static readonly IReadOnlyList<DemoUser> All =
    [
        new(1, "Admin User", "admin@redstar.dev", "Admin@123", [Roles.Admin]),
        new(2, "Asha Verma", "asha@redstar.dev", "Customer@123", [Roles.Customer]),
    ];

    public static DemoUser? FindByCredentials(string email, string password) =>
        All.FirstOrDefault(u => string.Equals(u.Email, email.Trim(), StringComparison.OrdinalIgnoreCase) && u.Password == password);

    public static DemoUser? FindById(int id) => All.FirstOrDefault(u => u.Id == id);
}

public static class DemoTokens
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(30); // short-lived, like a real access token

    public static string Create(DemoUser user, DateTimeOffset expiresAt) => $"demo.{user.Id}.{expiresAt.ToUnixTimeSeconds()}";

    public static bool TryParse(string token, out int userId, out DateTimeOffset expiresAt)
    {
        userId = 0;
        expiresAt = default;
        var parts = token.Split('.');
        if (parts is not ["demo", var id, var exp] || !int.TryParse(id, out userId) || !long.TryParse(exp, out var unix))
            return false;
        expiresAt = DateTimeOffset.FromUnixTimeSeconds(unix);
        return true;
    }
}

// An AUTHENTICATION HANDLER answers "who is calling?" for each request:
//   no token -> NoResult (anonymous) | bad or expired token -> Fail | good token -> a ClaimsPrincipal
// AUTHORIZATION ([Authorize], roles) then decides "are they allowed?" using those claims.
public class DemoAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    TimeProvider clock,
    DemoAuthSettings settings) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "Demo";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!settings.Enabled) return Task.FromResult(AuthenticateResult.NoResult()); // switched off: nobody is authenticated
        var header = Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) return Task.FromResult(AuthenticateResult.NoResult());

        var token = header["Bearer ".Length..].Trim();
        if (!DemoTokens.TryParse(token, out var userId, out var expiresAt)) return Fail("Malformed token");
        if (expiresAt <= clock.GetUtcNow()) return Fail("Token expired");
        if (DemoUsers.FindById(userId) is not { } user) return Fail("Unknown user");

        Claim[] claims =
        [
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Name),
            new(ClaimTypes.Email, user.Email),
            .. user.Roles.Select(r => new Claim(ClaimTypes.Role, r)),
        ];
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, SchemeName));
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(principal, SchemeName)));
    }

    private static Task<AuthenticateResult> Fail(string reason) => Task.FromResult(AuthenticateResult.Fail(reason));

    // 401 = "I don't know who you are" (no token, or a bad/expired one). Use our envelope, not an empty body.
    protected override async Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        Response.StatusCode = StatusCodes.Status401Unauthorized;
        Response.Headers.WWWAuthenticate = "Bearer";
        await Response.WriteAsJsonAsync(ApiResponse<object>.Fail("Please log in to continue."));
    }

    // 403 = "I know who you are, but you're not allowed" (e.g. a Customer calling an Admin endpoint)
    protected override async Task HandleForbiddenAsync(AuthenticationProperties properties)
    {
        Response.StatusCode = StatusCodes.Status403Forbidden;
        await Response.WriteAsJsonAsync(ApiResponse<object>.Fail("You don't have permission to do that."));
    }
}
