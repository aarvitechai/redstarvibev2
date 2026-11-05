using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Server.Api.Models.Entities;

namespace Server.Api.Data;

// The DbContext = a UNIT OF WORK plus a CHANGE TRACKER over one database connection.
// It is registered as SCOPED (one instance per HTTP request) because it is NOT thread-safe and it caches the
// entities it loaded. A singleton DbContext would be shared by concurrent requests, which corrupts it.
//
// Phase 12: IdentityDbContext<ApplicationUser> adds the AspNetUsers, AspNetRoles, AspNetUserRoles (and more) tables.
public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder); // REQUIRED with IdentityDbContext: it maps the Identity tables
        // Picks up every IEntityTypeConfiguration<T> in this assembly (Data/Configurations)
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
    }
}
