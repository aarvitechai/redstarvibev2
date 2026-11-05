using Microsoft.Extensions.Options;

namespace Server.Api.Middleware;

// Phase 15: the allowed browser origins, VALIDATED AT STARTUP. A bad value stops the app with a clear message,
// instead of silently allowing every site (a "*" typo) or silently blocking the real client.
public sealed class CorsSettings
{
    public const string Section = "Cors";
    public string[] AllowedOrigins { get; set; } = [];

    // Returns the problems; empty = valid. An EMPTY list is allowed: behind a reverse proxy the clients and the API
    // share one origin (see docker-compose.yml), so the browser never needs CORS at all.
    public static IEnumerable<string> Problems(CorsSettings settings, bool isDevelopment)
    {
        foreach (var origin in settings.AllowedOrigins)
        {
            if (origin.Contains('*'))
            {
                yield return $"Cors:AllowedOrigins must list exact origins; '{origin}' contains a wildcard.";
                continue;
            }
            if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri) || uri.PathAndQuery != "/" || origin.EndsWith('/'))
            {
                yield return $"Cors:AllowedOrigins: '{origin}' is not an origin (scheme://host[:port], no path, no trailing slash).";
                continue;
            }
            // Outside Development, a client must be served over HTTPS (http://localhost is fine for local testing)
            if (!isDevelopment && uri.Scheme != Uri.UriSchemeHttps && !uri.IsLoopback)
                yield return $"Cors:AllowedOrigins: '{origin}' must use https outside Development.";
        }
    }
}

// Runs at startup (ValidateOnStart): every problem is listed in ONE clear error
public sealed class CorsSettingsValidator(IHostEnvironment env) : IValidateOptions<CorsSettings>
{
    public ValidateOptionsResult Validate(string? name, CorsSettings options)
    {
        var problems = CorsSettings.Problems(options, env.IsDevelopment()).ToList();
        return problems.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(problems);
    }
}
