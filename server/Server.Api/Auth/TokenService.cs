using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Server.Api.Models.Entities;

namespace Server.Api.Auth;

// Bound from the "Jwt" configuration section. Issuer, Audience and lifetimes live in appsettings.json.
// The SigningKey does NOT: it comes from User Secrets (dev) or an environment variable / Key Vault (production).
public class JwtOptions
{
    public const string Section = "Jwt";

    [Required] public string Issuer { get; set; } = "";
    [Required] public string Audience { get; set; } = "";

    // HMAC-SHA256 needs at least 256 bits (32 bytes). A short key like "secret" can be brute-forced offline from one token.
    [Required, MinLength(32, ErrorMessage = "Jwt:SigningKey must be at least 32 characters. Set it with: dotnet user-secrets set Jwt:SigningKey <random value>")]
    public string SigningKey { get; set; } = "";

    [Range(1, 60)] public int AccessTokenMinutes { get; set; } = 15;   // short: a stolen access token is useful briefly
    [Range(1, 90)] public int RefreshTokenDays { get; set; } = 7;

    public SymmetricSecurityKey Key() => new(Encoding.UTF8.GetBytes(SigningKey));
}

public record AccessToken(string Token, DateTimeOffset ExpiresAt);

public class TokenService(IOptions<JwtOptions> options, TimeProvider clock)
{
    private readonly JwtOptions _jwt = options.Value;
    private readonly JsonWebTokenHandler _handler = new();

    // A JWT = header.payload.SIGNATURE. Anyone can READ the payload (it's only base64), so never put secrets in it.
    // Nobody can CHANGE it without the signing key, because the signature would no longer match.
    // (The Phase 8 demo token "demo.1.<exp>" had no signature, which is why it could be forged.)
    public AccessToken CreateAccessToken(ApplicationUser user, IEnumerable<string> roles)
    {
        var now = clock.GetUtcNow();
        var expires = now.AddMinutes(_jwt.AccessTokenMinutes);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),                       // WHO: the user id the API trusts
            new(JwtRegisteredClaimNames.Email, user.Email ?? ""),
            new(JwtRegisteredClaimNames.Name, user.Name),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),  // a unique id per token
        };
        claims.AddRange(roles.Select(r => new Claim("role", r)));            // what [Authorize(Roles = ...)] checks

        var token = _handler.CreateToken(new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Issuer = _jwt.Issuer,
            Audience = _jwt.Audience,
            IssuedAt = now.UtcDateTime,
            NotBefore = now.UtcDateTime,
            Expires = expires.UtcDateTime,
            SigningCredentials = new SigningCredentials(_jwt.Key(), SecurityAlgorithms.HmacSha256),
        });
        return new AccessToken(token, expires);
    }

    // A refresh token is just 64 random bytes. It's NOT a JWT: it means nothing on its own, only as a row in the database.
    public static string NewRefreshToken() => Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(64));

    public static string Hash(string refreshToken) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(refreshToken)));
}
