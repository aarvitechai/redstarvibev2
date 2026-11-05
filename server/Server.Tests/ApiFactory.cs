using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Server.Api.Data;

namespace Server.Tests;

// The test version of the app. EVERY test class gets:
//   - its OWN SQL Server database (RedStarVibeDb_Test_<guid>), built by running the REAL migrations
//   - its own temporary folder for uploaded images
// Both are deleted when the class finishes, so tests never touch the development database and never affect each other.
//
// The server comes from TEST_SQLSERVER_CONNECTION (CI sets it in Phase 15), or the local instance by default.
public class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private const string LocalServer = @"Server=DESKTOP-2ERCDGB\MSSQLSERVER01;Trusted_Connection=True;TrustServerCertificate=True";

    public string ConnectionString { get; } = new SqlConnectionStringBuilder(
        Environment.GetEnvironmentVariable("TEST_SQLSERVER_CONNECTION") ?? LocalServer)
    {
        InitialCatalog = $"RedStarVibeDb_Test_{Guid.NewGuid():N}",
    }.ConnectionString;

    public string ImagesPath { get; } = Path.Combine(Path.GetTempPath(), "redstar-tests", Guid.NewGuid().ToString("N"));

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Added LAST, so these override appsettings.Development.json (which points at the real dev database)
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = ConnectionString,
            ["Uploads:ProductImagesPath"] = ImagesPath,
        }));
    }

    public const string TestDatabasePrefix = "RedStarVibeDb_Test_";

    // SAFETY GUARD: only ever migrate or DELETE a database whose name proves it's a throwaway test database.
    // It checks the connection the app's DbContext ACTUALLY uses, not the one this factory intended to set.
    // (Without it, a configuration mistake once made these tests delete the development database.)
    private static ApplicationDbContext GuardedDb(IServiceScope scope)
    {
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var name = new SqlConnectionStringBuilder(db.Database.GetConnectionString()).InitialCatalog;
        if (!name.StartsWith(TestDatabasePrefix, StringComparison.Ordinal))
            throw new InvalidOperationException($"Refusing to touch database '{name}': tests may only use '{TestDatabasePrefix}*' databases.");
        return db;
    }

    public async Task InitializeAsync()
    {
        using var scope = Services.CreateScope();
        await GuardedDb(scope).Database.MigrateAsync(); // the real migrations
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        using (var scope = Services.CreateScope())
            await GuardedDb(scope).Database.EnsureDeletedAsync();
        if (Directory.Exists(ImagesPath)) Directory.Delete(ImagesPath, recursive: true);
        await base.DisposeAsync();
    }

    // A DbContext for arranging or inspecting data directly in a test
    public async Task<T> WithDbAsync<T>(Func<ApplicationDbContext, Task<T>> work)
    {
        using var scope = Services.CreateScope();
        return await work(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>());
    }
}

// Regression test for the incident: the app must use the TEST database, never the development one
public class ApiFactorySafetyTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task TheAppUsesTheThrowawayTestDatabase()
    {
        var name = await factory.WithDbAsync(db => Task.FromResult(new SqlConnectionStringBuilder(db.Database.GetConnectionString()).InitialCatalog));
        Assert.StartsWith(ApiFactory.TestDatabasePrefix, name);
    }
}
