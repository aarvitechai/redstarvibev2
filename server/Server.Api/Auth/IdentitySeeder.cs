using Microsoft.AspNetCore.Identity;
using Server.Api.Constants;
using Server.Api.Models.Entities;

namespace Server.Api.Auth;

// DEVELOPMENT demo accounts, created on startup when Auth:SeedDemoUsers is true (only appsettings.Development.json sets it).
// Program.cs refuses to seed outside Development: well-known passwords must never exist in production.
// (Roles are seeded by the migration in EVERY environment: see Data/Configurations/IdentityConfigurations.cs.)
public static class IdentitySeeder
{
    public static readonly (string Name, string Email, string Password, string Role)[] DemoUsers =
    [
        ("Admin User", "admin@redstar.dev", "Admin@123", Roles.Admin),
        ("Asha Verma", "asha@redstar.dev", "Customer@123", Roles.Customer),
    ];

    public static async Task SeedDemoUsersAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        foreach (var (name, email, password, role) in DemoUsers)
        {
            if (await users.FindByEmailAsync(email) is not null) continue; // idempotent: safe to run on every start

            var user = new ApplicationUser { UserName = email, Email = email, Name = name, EmailConfirmed = true };
            var created = await users.CreateAsync(user, password);
            if (!created.Succeeded)
                throw new InvalidOperationException($"Could not seed {email}: {string.Join("; ", created.Errors.Select(e => e.Description))}");
            await users.AddToRoleAsync(user, role);
        }
    }

    // Phase 15: PRODUCTION'S FIRST ADMIN. Demo users are refused outside Development, so a fresh production database
    // has no way to log in to the admin app. Auth:BootstrapAdmin:Email/Password (environment variables or a secret
    // store, never appsettings.json) create ONE admin, only while there is NO admin yet. Once one exists this does nothing,
    // so the secret can (and should) be removed after the first start.
    public static async Task<bool> EnsureBootstrapAdminAsync(IServiceProvider services, string? email, string? password)
    {
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password)) return false;

        using var scope = services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        if ((await users.GetUsersInRoleAsync(Roles.Admin)).Count > 0) return false; // already bootstrapped

        var user = await users.FindByEmailAsync(email);
        if (user is null)
        {
            user = new ApplicationUser { UserName = email, Email = email, Name = "Administrator", EmailConfirmed = true };
            var created = await users.CreateAsync(user, password); // the normal password rules apply
            if (!created.Succeeded)
                throw new InvalidOperationException($"Could not create the bootstrap admin: {string.Join("; ", created.Errors.Select(e => e.Description))}");
        }
        await users.AddToRoleAsync(user, Roles.Admin);
        return true;
    }
}
