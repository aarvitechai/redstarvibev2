using Scalar.AspNetCore;
using Server.Api.Services;

// Phase 0 baseline. Later phases add: DbContext (11), Identity + JWT (12), services (13).
var builder = WebApplication.CreateBuilder(args);

const string ClientCorsPolicy = "ClientCors";

// Allowed client origins come from configuration (appsettings / env vars), never hard-coded for prod.
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];

builder.Services.AddControllers();
builder.Services.AddSingleton<IStudentService, InMemoryStudentService>(); // Phase 2: in-memory, Phase 11: EF Core
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();   // consistent RFC 7807 error shape
builder.Services.AddHealthChecks();     // DB health check is added in Phase 11

builder.Services.AddCors(options =>
{
    options.AddPolicy(ClientCorsPolicy, policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var app = builder.Build();

// Middleware order matters: exception handler -> HTTPS -> CORS -> AuthN -> AuthZ -> endpoints
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
