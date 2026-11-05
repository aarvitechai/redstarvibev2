namespace Server.Api.Middleware;

// Phase 15: security headers on EVERY API response. An API returns JSON (and images), never HTML pages,
// so it can use the strictest settings:
//   X-Content-Type-Options: nosniff   the browser must trust Content-Type and never "guess" that JSON is a script
//   X-Frame-Options: DENY             no page may put the API in an <iframe> (clickjacking); the modern twin is
//   Content-Security-Policy:          frame-ancestors 'none', and default-src 'none': if a response were ever
//                                     rendered as a page, it could load NOTHING (no scripts, styles or images)
//   Referrer-Policy: no-referrer      URLs (which can carry ids or search terms) never leak to other sites
// The interactive API docs (/scalar, Development only) need scripts, so they're skipped.
public sealed class SecurityHeadersMiddleware(RequestDelegate next)
{
    public Task InvokeAsync(HttpContext context)
    {
        if (!context.Request.Path.StartsWithSegments("/scalar"))
        {
            // OnStarting: set just before the headers are sent, so they're on EVERY response,
            // including error responses written later by other middleware
            context.Response.OnStarting(() =>
            {
                var headers = context.Response.Headers;
                headers.XContentTypeOptions = "nosniff";
                headers.XFrameOptions = "DENY";
                headers.ContentSecurityPolicy = "default-src 'none'; frame-ancestors 'none'";
                headers["Referrer-Policy"] = "no-referrer";
                headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
                return Task.CompletedTask;
            });
        }
        return next(context);
    }
}
