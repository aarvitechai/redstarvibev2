using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.FileProviders;
using Scalar.AspNetCore;
using Server.Api.Data;
using Server.Api.Auth;
using Server.Api.Middleware;
using Server.Api.Controllers;
using Server.Api.Models;
using Server.Api.Models.Entities;
using Server.Api.Services;

// Later phases add: order services (13).
var builder = WebApplication.CreateBuilder(args);

const string ClientCorsPolicy = "ClientCors";


builder.Services.AddControllers()
    // [ApiController] returns 400 automatically when a DTO fails validation.
    // Wrap those errors in our ApiResponse envelope (with per-field errors) so clients see ONE error shape.
    .ConfigureApiBehaviorOptions(options => options.InvalidModelStateResponseFactory = ValidationResponses.InvalidModelState);
builder.Services.AddSingleton<IStudentService, InMemoryStudentService>(); // in-memory until Phase 11 (EF Core)
builder.Services.AddSingleton<IContactService, InMemoryContactService>(); // Phase 5
// Phase 11: SQL Server via EF Core.
// The connection string comes from configuration (appsettings.Development.json locally, an environment variable
// or Key Vault in production).
// It is read LAZILY, from the FINAL configuration, when the DbContext is created. Reading it eagerly here, at the
// top of Program.cs, would ignore configuration added later (for example by the test host), so the tests would run
// against the DEVELOPMENT database. That actually happened once while building Phase 11: see docs/phase-11.
builder.Services.AddDbContext<ApplicationDbContext>((services, options) =>
{
    var connectionString = services.GetRequiredService<IConfiguration>().GetConnectionString("DefaultConnection");
    if (string.IsNullOrWhiteSpace(connectionString))
        throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not configured.");
    options.UseSqlServer(connectionString, sql => sql.EnableRetryOnFailure(maxRetryCount: 3)); // retry brief network blips
});

// DI LIFETIMES:
//   Singleton: ONE instance for the whole app        (in-memory stores with a lock, TimeProvider)
//   Scoped:    ONE instance per HTTP request          (DbContext, and every service that uses it)
//   Transient: a NEW instance every time it's asked   (small stateless helpers)
// The rule: never inject a SCOPED service into a SINGLETON (a "captive dependency"). Development validates this at startup.
builder.Services.AddScoped<IProductCatalog, EfProductCatalog>();
builder.Services.AddScoped<IProductAdminService, EfProductAdminService>();
builder.Services.AddSingleton<IProductImageStore, FileSystemProductImageStore>();
builder.Services.AddSingleton<IDestinationService, InMemoryDestinationService>(); // Phase 10
builder.Services.AddSingleton(TimeProvider.System); // "now" as a dependency, so tests can control time

// Phase 12: REAL authentication: ASP.NET Core Identity (users, password hashing, lockout) plus signed JWT bearer tokens.
builder.Services.AddIdentityCore<ApplicationUser>(o =>
    {
        o.User.RequireUniqueEmail = true;
        o.Password.RequiredLength = 8;
        o.Lockout.MaxFailedAccessAttempts = 5;                       // 5 wrong passwords...
        o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);  // ...lock the account for 5 minutes
        o.Lockout.AllowedForNewUsers = true;
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddSignInManager(); // CheckPasswordSignInAsync = password check + lockout counting

// JWT settings, validated AT STARTUP: a missing or short signing key stops the app with a clear message,
// instead of failing on the first login (or worse, running with a weak key)
builder.Services.AddOptions<JwtOptions>().BindConfiguration(JwtOptions.Section).ValidateDataAnnotations().ValidateOnStart();
builder.Services.AddSingleton<TokenService>();
builder.Services.AddScoped<AuthService>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
// Configured through options (not inline) so the validation parameters use the FINAL configuration, the same lesson
// as the connection string in Phase 11: the test host's settings must win.
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<JwtOptions>>((bearer, jwtOptions) =>
    {
        var jwt = jwtOptions.Value;
        bearer.MapInboundClaims = false; // keep the JWT claim names ("sub", "role") instead of long legacy URIs
        bearer.TokenValidationParameters = new TokenValidationParameters
        {
            // The common JWT mistakes, all closed here: validate WHO issued it, WHO it's for, WHEN it expires, and the SIGNATURE
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Audience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30), // the default is 5 MINUTES of grace; keep expiry meaningful
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = jwt.Key(),
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256], // refuse "alg: none" and algorithm-switching tricks
            NameClaimType = "name",
            RoleClaimType = "role",
        };
        bearer.Events = new JwtBearerEvents
        {
            // 401/403 in our envelope (by default they have an empty body)
            OnChallenge = async ctx =>
            {
                ctx.HandleResponse();
                ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                ctx.Response.Headers.WWWAuthenticate = "Bearer";
                await ctx.Response.WriteAsJsonAsync(ApiResponse<object>.Fail("Please log in to continue."));
            },
            OnForbidden = async ctx =>
            {
                ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                await ctx.Response.WriteAsJsonAsync(ApiResponse<object>.Fail("You don't have permission to do that."));
            },
        };
    });
builder.Services.AddAuthorization();

// RATE LIMITING on the auth endpoints: at most N attempts per minute per client address, then 429 + Retry-After.
// Together with account lockout, this makes password guessing slow. (Behind a proxy, configure ForwardedHeaders so
// the real client IP is used: Phase 15.)
// The limit is read LAZILY from the final configuration (Configure<IConfiguration>), the same lesson as the connection
// string: an eager builder.Configuration read here would ignore the test host's settings (it did, at first).
builder.Services.AddRateLimiter(_ => { });
builder.Services.AddOptions<RateLimiterOptions>().Configure<IConfiguration>((o, config) =>
{
    var authPermitLimit = config.GetValue("RateLimiting:AuthPermitLimit", 10);
    o.AddPolicy(RateLimits.Auth, http => RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = authPermitLimit, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    o.OnRejected = async (ctx, ct) =>
    {
        ctx.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        ctx.HttpContext.Response.Headers.RetryAfter = "60";
        await ctx.HttpContext.Response.WriteAsJsonAsync(ApiResponse<object>.Fail("Too many attempts. Please wait a minute and try again."), ct);
    };
});
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();   // used for non-API errors (e.g. 404 for an unknown route)
builder.Services.AddExceptionHandler<GlobalExceptionHandler>(); // Phase 6: unhandled exceptions -> 500 envelope with a reference id
builder.Services.AddHealthChecks()
    .AddDbContextCheck<ApplicationDbContext>("database"); // /health now also checks that SQL Server answers

// Allowed client origins come from configuration (appsettings / env vars), never hard-coded for prod.
// Read lazily from the FINAL configuration, like every other setting (see the Phase 11 lesson).
builder.Services.AddCors();
builder.Services.AddOptions<CorsOptions>().Configure<IConfiguration>((options, config) =>
{
    var allowedOrigins = config.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
    options.AddPolicy(ClientCorsPolicy, policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              // Browsers hide response headers from JavaScript unless CORS EXPOSES them.
              // Without this, the client interceptors couldn't read the correlation id.
              .WithExposedHeaders(CorrelationIdMiddleware.HeaderName));
});

var app = builder.Build();

// Fail fast with a clear message if the connection string is missing (app.Configuration is the FINAL configuration)
if (string.IsNullOrWhiteSpace(app.Configuration.GetConnectionString("DefaultConnection")))
    throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not configured.");

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

// Uploaded product images: served from ONE folder at ONE URL prefix (/images/products/<random>.png).
// Cache headers: the file names are random and never reused, so browsers can cache them for a long time.
var imageStore = app.Services.GetRequiredService<IProductImageStore>();
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(imageStore.RootPath),
    RequestPath = imageStore.RequestPath,
    OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl = "public, max-age=604800, immutable",
});

app.UseCors(ClientCorsPolicy);
app.UseRateLimiter(); // after CORS, so a 429 still carries the CORS headers the browser needs to read it
// AuthN ("who are you?") must run before AuthZ ("are you allowed?"), and both after CORS,
// so a 401/403 still carries the CORS headers the browser needs in order to read it.
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

// DEVELOPMENT demo accounts (admin@redstar.dev / asha@redstar.dev). Never outside Development: well-known passwords.
if (app.Configuration.GetValue<bool>("Auth:SeedDemoUsers"))
{
    if (!app.Environment.IsDevelopment())
        throw new InvalidOperationException("Auth:SeedDemoUsers must only be true in Development.");
    await IdentitySeeder.SeedDemoUsersAsync(app.Services);
}

app.Run();

// Exposes Program to WebApplicationFactory in Server.Tests (integration tests).
public partial class Program { }
