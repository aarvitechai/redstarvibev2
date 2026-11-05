using System.Diagnostics;

namespace Server.Api.Middleware;

// One STRUCTURED log line per request. The {Placeholders} become named fields (Method, Path, StatusCode, ElapsedMs),
// not just text, so a log tool can filter "StatusCode >= 500" or chart ElapsedMs.
// Never use string interpolation ($"...") in log messages: you would lose those fields.
public class RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var started = Stopwatch.GetTimestamp();
        try
        {
            await next(context);
        }
        finally
        {
            var elapsedMs = Stopwatch.GetElapsedTime(started).TotalMilliseconds;
            var status = context.Response.StatusCode;
            var level = status >= 500 ? LogLevel.Error : status >= 400 ? LogLevel.Warning : LogLevel.Information;

            // The path only, never the query string: it can contain personal data or tokens
            logger.Log(level, "HTTP {Method} {Path} responded {StatusCode} in {ElapsedMs:0.0} ms",
                context.Request.Method, context.Request.Path.Value, status, elapsedMs);
        }
    }
}
