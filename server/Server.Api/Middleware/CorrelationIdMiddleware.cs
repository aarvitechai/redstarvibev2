using System.Text.RegularExpressions;

namespace Server.Api.Middleware;

// A CORRELATION ID ties one user action together across systems:
//   browser (Axios/HttpClient interceptor sets X-Correlation-Id) -> API logs -> response header -> error message.
// When a user reports "it failed, reference abc123", you can find every log line for that request.
public partial class CorrelationIdMiddleware(RequestDelegate next, ILogger<CorrelationIdMiddleware> logger)
{
    public const string HeaderName = "X-Correlation-Id";
    public const string ItemKey = "CorrelationId";

    // Only accept short, safe ids from clients. Anything else is replaced, so a client can't put
    // fake lines or huge strings into our logs (log injection).
    [GeneratedRegex("^[A-Za-z0-9._-]{1,64}$")]
    private static partial Regex SafeId();

    public async Task InvokeAsync(HttpContext context)
    {
        var incoming = context.Request.Headers[HeaderName].ToString();
        var correlationId = SafeId().IsMatch(incoming) ? incoming : Guid.NewGuid().ToString("N");

        context.Items[ItemKey] = correlationId;
        context.TraceIdentifier = correlationId;

        // Send it back on EVERY response (including errors). OnStarting runs just before the headers are sent.
        context.Response.OnStarting(() =>
        {
            context.Response.Headers[HeaderName] = correlationId;
            return Task.CompletedTask;
        });

        // A logging SCOPE: every log line written during this request automatically carries CorrelationId.
        // A message-template scope prints readably in the console ("CorrelationId:abc") AND stays structured
        // (a CorrelationId field) for JSON or log tools. (A Dictionary scope prints as its type name in the console.)
        using (logger.BeginScope("CorrelationId:{CorrelationId}", correlationId))
        {
            await next(context);
        }
    }
}

public static class CorrelationIdExtensions
{
    public static string GetCorrelationId(this HttpContext context) =>
        context.Items[CorrelationIdMiddleware.ItemKey] as string ?? context.TraceIdentifier;
}
