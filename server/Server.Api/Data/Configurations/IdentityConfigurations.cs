using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Server.Api.Constants;
using Server.Api.Models.Entities;

namespace Server.Api.Data.Configurations;

public class ApplicationUserConfiguration : IEntityTypeConfiguration<ApplicationUser>
{
    public void Configure(EntityTypeBuilder<ApplicationUser> b) => b.Property(u => u.Name).HasMaxLength(100).IsRequired();
}

public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> b)
    {
        b.Property(t => t.TokenHash).HasMaxLength(64).IsRequired(); // SHA-256 as hex
        b.Property(t => t.ReplacedByTokenHash).HasMaxLength(64);
        b.HasIndex(t => t.TokenHash).IsUnique(); // looked up on every refresh
        b.HasIndex(t => new { t.UserId, t.RevokedAt });
        b.HasOne(t => t.User).WithMany().HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

// ROLES are part of the schema the app relies on, so they're seeded by the MIGRATION (in every environment),
// using the SAME constants as [Authorize(Roles = ...)]. Fixed ids and stamps keep the migration stable.
// Users are NOT seeded here: demo users exist only in Development (see Auth/IdentitySeeder.cs).
public class RoleSeedConfiguration : IEntityTypeConfiguration<IdentityRole>
{
    public void Configure(EntityTypeBuilder<IdentityRole> b) => b.HasData(
        new IdentityRole { Id = "8f3c7f8e-1d6e-4c3e-9a61-4c1b2f2a0001", Name = Roles.Admin, NormalizedName = Roles.Admin.ToUpperInvariant(), ConcurrencyStamp = "seed-admin" },
        new IdentityRole { Id = "8f3c7f8e-1d6e-4c3e-9a61-4c1b2f2a0002", Name = Roles.Customer, NormalizedName = Roles.Customer.ToUpperInvariant(), ConcurrencyStamp = "seed-customer" });
}
