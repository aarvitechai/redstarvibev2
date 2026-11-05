using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Server.Api.Constants;
using Server.Api.Data;
using Server.Api.Models.Entities;

namespace Server.Api.Auth;

public record UserDto(string Id, string Name, string Email, IReadOnlyList<string> Roles);
public record AuthResultDto(string AccessToken, DateTimeOffset ExpiresAt, string RefreshToken, UserDto User);

public enum AuthError { None, InvalidCredentials, LockedOut, EmailTaken, WeakPassword, InvalidRefreshToken }

public record AuthOutcome(AuthResultDto? Result, AuthError Error = AuthError.None, IReadOnlyDictionary<string, string[]>? FieldErrors = null)
{
    public bool Succeeded => Error == AuthError.None;
}

public class AuthService(
    UserManager<ApplicationUser> users,
    SignInManager<ApplicationUser> signIn,
    ApplicationDbContext db,
    TokenService tokens,
    IOptions<JwtOptions> jwt,
    TimeProvider clock,
    ILogger<AuthService> logger)
{
    public async Task<AuthOutcome> RegisterAsync(string name, string email, string password, CancellationToken ct)
    {
        var user = new ApplicationUser { UserName = email.Trim(), Email = email.Trim(), Name = name.Trim() };
        // Identity HASHES the password (PBKDF2 with a salt and many iterations). The plain password is never stored.
        var created = await users.CreateAsync(user, password);
        if (!created.Succeeded)
        {
            if (created.Errors.Any(e => e.Code is "DuplicateUserName" or "DuplicateEmail"))
                return new(null, AuthError.EmailTaken, new Dictionary<string, string[]> { ["email"] = ["An account with this email already exists."] });
            return new(null, AuthError.WeakPassword, new Dictionary<string, string[]> { ["password"] = [.. created.Errors.Select(e => e.Description)] });
        }

        // Everyone who signs up is a Customer. Admins are made by an existing admin, never by the register form.
        await users.AddToRoleAsync(user, Roles.Customer);
        logger.LogInformation("New account {UserId} registered", user.Id); // never log emails or passwords
        return new(await IssueAsync(user, ct));
    }

    public async Task<AuthOutcome> LoginAsync(string email, string password, CancellationToken ct)
    {
        var user = await users.FindByEmailAsync(email.Trim());
        if (user is null) return new(null, AuthError.InvalidCredentials);

        // lockoutOnFailure: after too many wrong passwords, the account is locked for a while (slows down guessing)
        var check = await signIn.CheckPasswordSignInAsync(user, password, lockoutOnFailure: true);
        if (check.IsLockedOut) return new(null, AuthError.LockedOut);
        if (!check.Succeeded) return new(null, AuthError.InvalidCredentials);

        return new(await IssueAsync(user, ct));
    }

    // REFRESH TOKEN ROTATION, with REUSE DETECTION:
    //   valid, active token -> revoke it, link its successor, issue a NEW pair
    //   an already-REVOKED token is used again -> someone copied it (the user or the thief has the newer one).
    //     We can't tell who is who, so revoke EVERY active token of that user: both must log in again.
    public async Task<AuthOutcome> RefreshAsync(string refreshToken, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var stored = await db.RefreshTokens.Include(t => t.User).FirstOrDefaultAsync(t => t.TokenHash == TokenService.Hash(refreshToken), ct);
        if (stored is null) return new(null, AuthError.InvalidRefreshToken);

        if (stored.RevokedAt is not null)
        {
            logger.LogWarning("Refresh token reuse detected for user {UserId}; revoking all sessions", stored.UserId);
            await db.RefreshTokens.Where(t => t.UserId == stored.UserId && t.RevokedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);
            return new(null, AuthError.InvalidRefreshToken);
        }
        if (stored.ExpiresAt <= now) return new(null, AuthError.InvalidRefreshToken);

        // Lockout and deleted users are checked again: a refresh token must not outlive the account's right to log in
        if (await users.IsLockedOutAsync(stored.User)) return new(null, AuthError.LockedOut);

        var result = await IssueAsync(stored.User, ct, replacing: stored);
        return new(result);
    }

    // Logout revokes the refresh token, so it can't be used again even if it was copied
    public async Task LogoutAsync(string refreshToken, CancellationToken ct)
    {
        var hash = TokenService.Hash(refreshToken);
        await db.RefreshTokens.Where(t => t.TokenHash == hash && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, clock.GetUtcNow()), ct);
    }

    public async Task<UserDto?> GetUserAsync(string userId)
    {
        var user = await users.FindByIdAsync(userId);
        return user is null ? null : new UserDto(user.Id, user.Name, user.Email ?? "", [.. await users.GetRolesAsync(user)]);
    }

    private async Task<AuthResultDto> IssueAsync(ApplicationUser user, CancellationToken ct, RefreshToken? replacing = null)
    {
        var roles = await users.GetRolesAsync(user);
        var access = tokens.CreateAccessToken(user, roles);
        var refresh = TokenService.NewRefreshToken();
        var now = clock.GetUtcNow();

        var entity = new RefreshToken
        {
            UserId = user.Id,
            TokenHash = TokenService.Hash(refresh),
            CreatedAt = now,
            ExpiresAt = now.AddDays(jwt.Value.RefreshTokenDays),
        };
        db.RefreshTokens.Add(entity);
        if (replacing is not null)
        {
            replacing.RevokedAt = now;
            replacing.ReplacedByTokenHash = entity.TokenHash;
        }
        await db.SaveChangesAsync(ct); // the new token and the revocation of the old one are saved TOGETHER

        return new AuthResultDto(access.Token, access.ExpiresAt, refresh, new UserDto(user.Id, user.Name, user.Email ?? "", [.. roles]));
    }
}
