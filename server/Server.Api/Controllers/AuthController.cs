using System.ComponentModel.DataAnnotations;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Server.Api.Auth;
using Server.Api.Constants;
using Server.Api.Models;
using Server.Api.Services;

namespace Server.Api.Controllers;

public record LoginDto(
    [Required(ErrorMessage = "Email is required."), EmailAddress(ErrorMessage = "Enter a valid email address.")] string Email,
    [Required(ErrorMessage = "Password is required.")] string Password);

public record RegisterDto(
    [Required(ErrorMessage = "Name is required."), StringLength(100, MinimumLength = 2, ErrorMessage = "Name must be 2 to 100 characters.")] string Name,
    [Required(ErrorMessage = "Email is required."), EmailAddress(ErrorMessage = "Enter a valid email address.")] string Email,
    [Required(ErrorMessage = "Password is required."), StringLength(100, MinimumLength = 8, ErrorMessage = "Password must be at least 8 characters.")] string Password);

public record RefreshDto([Required] string RefreshToken);

// Phase 12: REAL authentication. ASP.NET Core Identity (users and roles in SQL Server) plus signed JWTs.
// The URLs and response shapes are the same as the Phase 8 demo, plus a refreshToken.
[ApiController]
[Route("api/[controller]")] // -> /api/auth
public class AuthController(AuthService auth) : ControllerBase
{
    // POST /api/auth/register  -> 201 + tokens (signed in straight away) | 400 | 409 email taken
    [HttpPost("register")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimits.Auth)]
    [ProducesResponseType<ApiResponse<AuthResultDto>>(StatusCodes.Status201Created)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<ApiResponse<AuthResultDto>>> Register(RegisterDto input, CancellationToken ct)
    {
        var outcome = await auth.RegisterAsync(input.Name, input.Email, input.Password, ct);
        return outcome.Error switch
        {
            AuthError.None => StatusCode(StatusCodes.Status201Created, ApiResponse<AuthResultDto>.Ok(outcome.Result!)),
            AuthError.EmailTaken => Conflict(ApiResponse<AuthResultDto>.ValidationFail(outcome.FieldErrors!)),
            _ => BadRequest(ApiResponse<AuthResultDto>.ValidationFail(outcome.FieldErrors!)),
        };
    }

    // POST /api/auth/login  -> 200 { accessToken, expiresAt, refreshToken, user } | 401 | 429
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimits.Auth)] // slows down password guessing from one address
    [ProducesResponseType<ApiResponse<AuthResultDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<ApiResponse<AuthResultDto>>> Login(LoginDto input, CancellationToken ct)
    {
        var outcome = await auth.LoginAsync(input.Email, input.Password, ct);
        return outcome.Error switch
        {
            AuthError.None => Ok(ApiResponse<AuthResultDto>.Ok(outcome.Result!)),
            AuthError.LockedOut => Unauthorized(ApiResponse<AuthResultDto>.Fail("Too many failed attempts. Try again in a few minutes.")),
            // The SAME message for "no such email" and "wrong password", so attackers can't discover which emails exist
            _ => Unauthorized(ApiResponse<AuthResultDto>.Fail("Invalid email or password.")),
        };
    }

    // POST /api/auth/refresh  { refreshToken }  -> a NEW access token AND a NEW refresh token (rotation) | 401
    [HttpPost("refresh")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimits.Auth)]
    [ProducesResponseType<ApiResponse<AuthResultDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ApiResponse<AuthResultDto>>> Refresh(RefreshDto input, CancellationToken ct)
    {
        var outcome = await auth.RefreshAsync(input.RefreshToken, ct);
        return outcome.Succeeded
            ? Ok(ApiResponse<AuthResultDto>.Ok(outcome.Result!))
            : Unauthorized(ApiResponse<AuthResultDto>.Fail("Your session has expired. Please log in again."));
    }

    // POST /api/auth/logout  { refreshToken }  -> 204. (The access token simply expires on its own within minutes.)
    [HttpPost("logout")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout(RefreshDto input, CancellationToken ct)
    {
        await auth.LogoutAsync(input.RefreshToken, ct);
        return NoContent();
    }

    // GET /api/auth/me  -> who the TOKEN says you are, with fresh data from the database
    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType<ApiResponse<UserDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ApiResponse<UserDto>>> Me()
    {
        // The user id ALWAYS comes from the validated token's "sub" claim, never from the request body or URL
        var userId = User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value;
        return await auth.GetUserAsync(userId) is { } user
            ? Ok(ApiResponse<UserDto>.Ok(user))
            : Unauthorized(ApiResponse<UserDto>.Fail("Please log in to continue."));
    }
}

// An admin-only endpoint: the SERVER enforces the role. Hiding the Admin link in the UI protects nothing by itself.
[ApiController]
[Route("api/admin")]
[Authorize(Roles = Roles.Admin)]
public class AdminController(IStudentService students, IContactService contacts, IProductCatalog catalog) : ControllerBase
{
    public record SummaryDto(int Students, int Contacts, int Products, int Categories);

    [HttpGet("summary")]
    [ProducesResponseType<ApiResponse<SummaryDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ApiResponse<SummaryDto>>> Summary(CancellationToken ct) =>
        Ok(ApiResponse<SummaryDto>.Ok(new SummaryDto(
            students.GetAll().Count, contacts.GetAll().Count, await catalog.CountAsync(ct), (await catalog.GetCategoriesAsync(ct)).Count)));
}

public static class RateLimits
{
    public const string Auth = "auth";
}
