using Microsoft.EntityFrameworkCore;

namespace TheHat.Backend.Persistence;

public sealed class TheHatDbContext(DbContextOptions<TheHatDbContext> options) : DbContext(options)
{
    public DbSet<RoomDocument> Rooms => Set<RoomDocument>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<RoomDocument>(entity =>
        {
            entity.ToTable("Rooms");
            entity.HasKey(room => room.RoomId);
            entity.Property(room => room.RoomId).HasMaxLength(64);
            entity.Property(room => room.InviteCode).HasMaxLength(32);
            entity.Property(room => room.PayloadJson).HasColumnType("TEXT");
            entity.Property(room => room.Phase).HasConversion<string>().HasMaxLength(32);
            entity.HasIndex(room => room.InviteCode).IsUnique();
        });
    }
}
