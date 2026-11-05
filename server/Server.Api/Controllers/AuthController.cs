using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Server.Api.Auth;
using Server.Api.Constants;
using Server.Api.Models;
using Server.Api.Services;

namespace Server.Api.Controllers;

public record LoginDto(
    [Required(ErrorMessage = "Email is required."), EmailAddress(ErrorMessage = "Enter a valid email address.")] string Email,
    [Required(ErrorMessage = "Password is required.")] string Password);

public record UserDto(int Id, string Name, string Email, IReadOnlyList<string> Roles);
public record LoginResultDto(string AccessToken, DateTimeOffset ExpiresAt, UserDto User);

[ApiController]
[Route("api/[controller]")] // -> /api/auth
public class AuthController(TimeProvider clock, DemoAuthSettings demoAuth) : ControllerBase
{
    // POST /api/auth/login  -> 200 { accessToken, expiresAt, user } | 401
    // Phase 12 keeps this exact response shape, so the clients don't change.
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType<ApiResponse<LoginResultDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status401Unauthorized)]
    public ActionResult<ApiResponse<LoginResultDto>> Login(LoginDto input)
    {
        if (!demoAuth.Enabled) return NotFound(ApiResponse<LoginResultDto>.Fail("Demo login is disabled in this environment."));

        var user = DemoUsers.FindByCredentials(input.Email, input.Password);
        // The SAME message for "no such email" and "wrong password", so attackers can't discover which emails exist
        if (user is null) return Unauthorized(ApiResponse<LoginResultDto>.Fail("Invalid email or password."));

        var expiresAt = clock.GetUtcNow().Add(DemoTokens.Lifetime);
        return Ok(ApiResponse<LoginResultDto>.Ok(new LoginResultDto(DemoTokens.Create(user, expiresAt), expiresAt, ToDto(user))));
    }

    // GET /api/auth/me  -> who the TOKEN says you are. The user comes from claims, never from the request body.
    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType<ApiResponse<UserDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status401Unauthorized)]
    public ActionResult<ApiResponse<UserDto>> Me()
    {
        var user = new UserDto(
            int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!),
            User.FindFirstValue(ClaimTypes.Name)!,
            User.FindFirstValue(ClaimTypes.Email)!,
            [.. User.FindAll(ClaimTypes.Role).Select(c => c.Value)]);
        return Ok(ApiResponse<UserDto>.Ok(user));
    }

    private static UserDto ToDto(DemoUser u) => new(u.Id, u.Name, u.Email, u.Roles);
}

// An admin-only endpoint: the SERVER enforces the role. Hiding the Admin link in the UI protects nothing by itself.
[ApiController]
[Route("api/admin")]
[Authorize(Roles = Roles.Admin)] // applies to every action in this controller
public class AdminController(IStudentService students, IContactService contacts, IProductCatalog catalog) : ControllerBase
{
    public record SummaryDto(int Students, int Contacts, int Products, int Categories);

    // GET /api/admin/summary  -> 200 (Admin) | 403 (Customer) | 401 (anonymous)
    [HttpGet("summary")]
    [ProducesResponseType<ApiResponse<SummaryDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ApiResponse<SummaryDto>>> Summary(CancellationToken ct) =>
        Ok(ApiResponse<SummaryDto>.Ok(new SummaryDto(
            students.GetAll().Count, contacts.GetAll().Count, await catalog.CountAsync(ct), (await catalog.GetCategoriesAsync(ct)).Count)));
}
