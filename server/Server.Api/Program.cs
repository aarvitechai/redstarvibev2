using Scalar.AspNetCore;
using Server.Api.Auth;
using Server.Api.Middleware;
using Server.Api.Models;
using Server.Api.Services;

// Later phases add: DbContext (11), Identity + JWT replacing demo auth (12), order services (13).
var builder = WebApplication.CreateBuilder(args);

const string ClientCorsPolicy = "ClientCors";

// Allowed client origins come from configuration (appsettings / env vars), never hard-coded for prod.
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];

builder.Services.AddControllers()
    // [ApiController] returns 400 automatically when a DTO fails validation.
    // Wrap those errors in our ApiResponse envelope (with per-field errors) so clients see ONE error shape.
    .ConfigureApiBehaviorOptions(options => options.InvalidModelStateResponseFactory = ValidationResponses.InvalidModelState);
builder.Services.AddSingleton<IStudentService, InMemoryStudentService>(); // in-memory until Phase 11 (EF Core)
builder.Services.AddSingleton<IContactService, InMemoryContactService>(); // Phase 5
builder.Services.AddSingleton<IProductCatalog, InMemoryProductCatalog>(); // Phase 7
builder.Services.AddSingleton<IDestinationService, InMemoryDestinationService>(); // Phase 10
builder.Services.AddSingleton(TimeProvider.System); // "now" as a dependency, so tests can control time

// Phase 8: DEMO authentication (unsigned tokens). Development only. Phase 12 replaces it with Identity + JWT.
// Fail fast: never let a forgeable token scheme reach a real environment by accident.
var demoAuthEnabled = builder.Configuration.GetValue<bool>("Auth:DemoTokensEnabled");
if (demoAuthEnabled && !builder.Environment.IsDevelopment())
    throw new InvalidOperationException("Auth:DemoTokensEnabled must only be true in Development.");
builder.Services.AddSingleton(new DemoAuthSettings(demoAuthEnabled));
// The scheme is ALWAYS registered: with the flag off it authenticates nobody, so [Authorize] answers 401
// instead of crashing with "no authentication scheme" (a 500).
builder.Services.AddAuthentication(DemoAuthHandler.SchemeName)
    .AddScheme<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions, DemoAuthHandler>(DemoAuthHandler.SchemeName, null);
builder.Services.AddAuthorization();
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();   // used for non-API errors (e.g. 404 for an unknown route)
builder.Services.AddExceptionHandler<GlobalExceptionHandler>(); // Phase 6: unhandled exceptions -> 500 envelope with a reference id
builder.Services.AddHealthChecks();     // DB health check is added in Phase 11

builder.Services.AddCors(options =>
{
    options.AddPolicy(ClientCorsPolicy, policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              // Browsers hide response headers from JavaScript unless CORS EXPOSES them.
              // Without this, the client interceptors couldn't read the correlation id.
              .WithExposedHeaders(CorrelationIdMiddleware.HeaderName));
});

var app = builder.Build();

// Middleware order matters:
//   correlation id -> request log -> exception handler -> HTTPS -> CORS -> AuthN -> AuthZ -> endpoints
// The correlation id comes FIRST, so even a crash's 500 response and its log lines carry the id.
app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<RequestLoggingMiddleware>();
app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();                 // /openapi/v1.json
    app.MapScalarApiReference();      // /scalar
}
else
{
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseCors(ClientCorsPolicy);
// AuthN ("who are you?") must run before AuthZ ("are you allowed?"), and both after CORS,
// so a 401/403 still carries the CORS headers the browser needs in order to read it.
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

app.Run();

// Exposes Program to WebApplicationFactory in Server.Tests (integration tests).
public partial class Program { }
