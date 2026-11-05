using System.Text.Json;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Server.Api.Middleware;

// Phase 15: health endpoints, as a container platform (Docker, Kubernetes, Azure App Service) uses them:
//   /health/live   "is the process running?"   NO dependencies checked. If this fails, RESTART the container.
//   /health/ready  "can it serve requests?"    checks SQL Server. If this fails, STOP SENDING TRAFFIC, but don't
//                                              restart: a database blip shouldn't make every API instance reboot.
//   /health        everything (kept from Phase 0)
// The body is a small JSON summary. Exception messages are NOT included: they can reveal server names and versions.
public static class HealthResponses
{
    public const string ReadyTag = "ready";

    public static Task WriteJson(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json; charset=utf-8";
        context.Response.Headers.CacheControl = "no-store"; // a cached "Healthy" is worse than none
        var body = new
        {
            status = report.Status.ToString(),
            totalDurationMs = Math.Round(report.TotalDuration.TotalMilliseconds),
            checks = report.Entries.ToDictionary(e => e.Key, e => e.Value.Status.ToString()),
        };
        return context.Response.WriteAsync(JsonSerializer.Serialize(body, JsonSerializerOptions.Web));
    }
}
