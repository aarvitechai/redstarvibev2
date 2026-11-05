using System.IO.Compression;
using System.Net;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;
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

// Phase 13 adds orders; Phase 15 adds production hardening.
var builder = WebApplication.CreateBuilder(args);

// Phase 15: don't advertise the server software ("Server: Kestrel") to attackers
builder.WebHost.ConfigureKestrel(k => k.AddServerHeader = false);

const string ClientCorsPolicy = "ClientCors";


builder.Services.AddControllers()
    // Enums travel as TEXT in JSON ("Pending", not 0), both ways: readable, and safe to reorder later
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()))
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
    // No connection string configured: register SQL Server WITHOUT one, so a tool can supply it later.
    // Phase 15: the EF migration BUNDLE creates this DbContext first and only then applies its --connection argument.
    // Throwing here broke the bundle (caught by trying it). The running API still fails fast: see the check after Build().
    if (string.IsNullOrWhiteSpace(connectionString))
        options.UseSqlServer(sql => sql.EnableRetryOnFailure(maxRetryCount: 3));
    else
        options.UseSqlServer(connectionString, sql => sql.EnableRetryOnFailure(maxRetryCount: 3)); // retry brief network blips
});

// DI LIFETIMES:
//   Singleton: ONE instance for the whole app        (in-memory stores with a lock, TimeProvider)
//   Scoped:    ONE instance per HTTP request          (DbContext, and every service that uses it)
//   Transient: a NEW instance every time it's asked   (small stateless helpers)
// The rule: never inject a SCOPED service into a SINGLETON (a "captive dependency"). Development validates this at startup.
builder.Services.AddScoped<IProductCatalog, EfProductCatalog>();
builder.Services.AddScoped<IProductAdminService, EfProductAdminService>();
builder.Services.AddScoped<OrderService>(); // Phase 13
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
    .AddDbContextCheck<ApplicationDbContext>("database", tags: [HealthResponses.ReadyTag]); // /health/ready checks SQL Server

// Phase 15: RESPONSE COMPRESSION. JSON shrinks 70-90%, so pages of products load faster on slow phones.
// EnableForHttps: compression over HTTPS opens the door to BREACH-style attacks ONLY when one response mixes a secret
// with text an attacker controls. Our token responses (login/refresh) never echo user input, so we accept it.
builder.Services.AddResponseCompression(o =>
{
    o.EnableForHttps = true;
    o.Providers.Add<BrotliCompressionProvider>(); // first = preferred, when the browser accepts both
    o.Providers.Add<GzipCompressionProvider>();
});
builder.Services.Configure<BrotliCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);
builder.Services.Configure<GzipCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);

// Phase 15: FORWARDED HEADERS. Behind a reverse proxy (nginx, a load balancer), every request seems to come from the
// PROXY's address, over plain http. The proxy passes the real values in X-Forwarded-For / X-Forwarded-Proto.
// Trust them ONLY when the API is reachable through the proxy alone. Otherwise anyone could send
// "X-Forwarded-For: <random>" and get a fresh rate-limit bucket on every request (a test proves it).
builder.Services.AddOptions<ForwardedHeadersOptions>().Configure<IConfiguration>((o, config) =>
{
    if (!config.GetValue<bool>("ForwardedHeaders:Enabled")) return; // off by default: headers ignored
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.ForwardLimit = 1; // only the LAST hop, i.e. the value OUR proxy wrote
    var proxies = config.GetSection("ForwardedHeaders:KnownProxies").Get<string[]>() ?? [];
    if (proxies.Length > 0)
    {
        o.KnownProxies.Clear();
        foreach (var ip in proxies) o.KnownProxies.Add(IPAddress.Parse(ip));
    }
    else
    {
        // In a container network the proxy's IP isn't fixed: trust whoever is in front. Safe only because
        // docker-compose publishes the API to nobody but the proxy.
        o.KnownIPNetworks.Clear();
        o.KnownProxies.Clear();
    }
});

// Allowed client origins come from configuration (appsettings / env vars), never hard-coded for prod.
// Read lazily from the FINAL configuration, like every other setting (see the Phase 11 lesson).
// Phase 15: validated at startup (no wildcards, real origins, https outside Development)
builder.Services.AddOptions<CorsSettings>().BindConfiguration(CorsSettings.Section).ValidateOnStart();
builder.Services.AddSingleton<IValidateOptions<CorsSettings>, CorsSettingsValidator>();
builder.Services.AddCors();
builder.Services.AddOptions<CorsOptions>().Configure<IOptions<CorsSettings>>((options, cors) =>
{
    var allowedOrigins = cors.Value.AllowedOrigins;
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
//   forwarded headers -> correlation id -> security headers -> request log -> exception handler -> HTTPS
//   -> compression -> static files -> CORS -> rate limit -> AuthN -> AuthZ -> endpoints
// Forwarded headers come FIRST, so everything after them (logs, HTTPS redirect, rate limiting) sees the REAL
// client IP and scheme. The correlation id is next, so even a crash's 500 response and its log lines carry the id.
app.UseForwardedHeaders(); // does nothing unless ForwardedHeaders:Enabled
app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<SecurityHeadersMiddleware>();
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
app.UseResponseCompression(); // before static files and controllers, so it can compress what they write

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
// Phase 15: liveness vs readiness (see HealthResponses)
app.MapHealthChecks("/health", new HealthCheckOptions { ResponseWriter = HealthResponses.WriteJson });
app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false, ResponseWriter = HealthResponses.WriteJson });
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains(HealthResponses.ReadyTag),
    ResponseWriter = HealthResponses.WriteJson,
});

// DEVELOPMENT demo accounts (admin@redstar.dev / asha@redstar.dev). Never outside Development: well-known passwords.
if (app.Configuration.GetValue<bool>("Auth:SeedDemoUsers"))
{
    if (!app.Environment.IsDevelopment())
        throw new InvalidOperationException("Auth:SeedDemoUsers must only be true in Development.");
    await IdentitySeeder.SeedDemoUsersAsync(app.Services);
}

// Phase 15: the first admin in production (see IdentitySeeder.EnsureBootstrapAdminAsync)
if (await IdentitySeeder.EnsureBootstrapAdminAsync(app.Services, app.Configuration["Auth:BootstrapAdmin:Email"], app.Configuration["Auth:BootstrapAdmin:Password"]))
    app.Logger.LogWarning("Created the bootstrap admin {Email}. Remove Auth:BootstrapAdmin from the configuration now.", app.Configuration["Auth:BootstrapAdmin:Email"]);

app.Run();

// Exposes Program to WebApplicationFactory in Server.Tests (integration tests).
public partial class Program { }
