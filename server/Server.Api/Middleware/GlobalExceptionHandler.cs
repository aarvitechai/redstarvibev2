using Microsoft.AspNetCore.Diagnostics;
using Server.Api.Models;

namespace Server.Api.Middleware;

// Catches ANY unhandled exception and returns our usual envelope with a 500.
// The client gets a reference id. The details (stack trace, SQL, file paths) go ONLY to the logs:
// showing them to users would leak internals to attackers.
public class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        var correlationId = context.GetCorrelationId();

        if (exception is OperationCanceledException && context.RequestAborted.IsCancellationRequested)
        {
            // The client went away (closed the tab, or the interceptor aborted). Not a server error.
            logger.LogInformation("Request cancelled by the client");
            context.Response.StatusCode = 499; // de-facto "client closed request"
            return true;
        }

        logger.LogError(exception, "Unhandled exception for {Method} {Path}", context.Request.Method, context.Request.Path.Value);

        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await context.Response.WriteAsJsonAsync(
            ApiResponse<object>.Fail($"An unexpected error occurred. Reference: {correlationId}"),
            cancellationToken);
        return true; // handled: don't run the default handler
    }
}
