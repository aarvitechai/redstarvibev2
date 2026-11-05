using Microsoft.AspNetCore.Identity;

namespace Server.Api.Models.Entities;

// IdentityUser already has Id (a GUID string), UserName, Email, PasswordHash, SecurityStamp, LockoutEnd and more.
// We add what OUR app needs.
public class ApplicationUser : IdentityUser
{
    public string Name { get; set; } = "";
}

// A REFRESH TOKEN lets the client get a new short-lived access token without asking for the password again.
// Only a SHA-256 HASH is stored, like a password: a leaked database must not leak usable tokens.
public class RefreshToken
{
    public int Id { get; set; }
    public required string UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public required string TokenHash { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public string? ReplacedByTokenHash { get; set; } // ROTATION: every refresh revokes this token and links its successor

    public bool IsActive(DateTimeOffset now) => RevokedAt is null && ExpiresAt > now;
}
