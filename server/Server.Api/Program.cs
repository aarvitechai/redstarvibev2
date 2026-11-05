using Scalar.AspNetCore;
using Server.Api.Middleware;
using Server.Api.Models;
using Server.Api.Services;

// Later phases add: DbContext (11), Identity + JWT (12), order services (13).
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
// app.UseAuthentication();  // Phase 12
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

app.Run();

// Exposes Program to WebApplicationFactory in Server.Tests (integration tests).
public partial class Program { }
