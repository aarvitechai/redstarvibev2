using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Server.Api.Models.Entities;

namespace Server.Api.Data.Configurations;

public class OrderHeaderConfiguration : IEntityTypeConfiguration<OrderHeader>
{
    public void Configure(EntityTypeBuilder<OrderHeader> b)
    {
        b.Property(o => o.Status).HasConversion<string>().HasMaxLength(20); // stored as "Pending", not 0
        b.Property(o => o.Total).HasPrecision(10, 2);
        b.Property(o => o.RowVersion).IsRowVersion();

        // An order must never vanish because its user was deleted (orders are financial records)
        b.HasOne(o => o.User).WithMany().HasForeignKey(o => o.UserId).OnDelete(DeleteBehavior.Restrict);
        // Deleting a header deletes its lines: they make no sense on their own
        b.HasMany(o => o.Details).WithOne(d => d.OrderHeader).HasForeignKey(d => d.OrderHeaderId).OnDelete(DeleteBehavior.Cascade);

        // "My orders" (newest first) and the admin list filtered by status
        b.HasIndex(o => new { o.UserId, o.CreatedAt });
        b.HasIndex(o => new { o.Status, o.CreatedAt });
    }
}

public class OrderDetailConfiguration : IEntityTypeConfiguration<OrderDetail>
{
    public void Configure(EntityTypeBuilder<OrderDetail> b)
    {
        b.Property(d => d.ProductName).HasMaxLength(100).IsRequired();
        b.Property(d => d.UnitPrice).HasPrecision(10, 2);
        b.Property(d => d.LineTotal).HasPrecision(10, 2);
        b.ToTable(t =>
        {
            // The database ITSELF refuses impossible values, even if a bug in the code tried to write them
            t.HasCheckConstraint("CK_OrderDetails_Quantity", "[Quantity] BETWEEN 1 AND 20");
            t.HasCheckConstraint("CK_OrderDetails_Rating", "[Rating] IS NULL OR [Rating] BETWEEN 1 AND 5");
        });
        // ProductId is a plain column (no foreign key or navigation to Products) on purpose: a line is a SNAPSHOT
        // and must not depend on the product row. (Products are only ever soft-deleted anyway.)
        b.HasIndex(d => d.ProductId);
    }
}
