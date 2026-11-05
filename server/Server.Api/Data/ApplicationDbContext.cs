using Microsoft.EntityFrameworkCore;
using Server.Api.Models.Entities;

namespace Server.Api.Data;

// The DbContext = a UNIT OF WORK plus a CHANGE TRACKER over one database connection.
// It is registered as SCOPED (one instance per HTTP request) because it is NOT thread-safe and it caches the
// entities it loaded. A singleton DbContext would be shared by concurrent requests, which corrupts it.
public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : DbContext(options)
{
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Picks up every IEntityTypeConfiguration<T> in this assembly (Data/Configurations)
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
    }
}
