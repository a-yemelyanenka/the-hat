using System.Linq.Expressions;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TheHat.Backend.Domain;

namespace TheHat.Backend.Persistence;

public sealed class TheHatDbContext(DbContextOptions<TheHatDbContext> options) : DbContext(options), IApplicationDbContext
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    public DbSet<RoomState> Rooms => Set<RoomState>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var roomBuilder = modelBuilder.Entity<RoomState>();

        roomBuilder.ToTable("Rooms");
        roomBuilder.HasKey(room => room.RoomId);
        roomBuilder.Property(room => room.RoomId).HasMaxLength(64);
        roomBuilder.Property(room => room.InviteCode).HasMaxLength(32);
        roomBuilder.Property(room => room.HostPlayerId).HasMaxLength(64);
        roomBuilder.Property(room => room.Phase).HasConversion<string>().HasMaxLength(32);
        roomBuilder.HasIndex(room => room.InviteCode).IsUnique();

        ConfigureJsonProperty(roomBuilder, room => room.Settings);
        ConfigureJsonProperty(roomBuilder, room => room.Players);
        ConfigureJsonProperty(roomBuilder, room => room.Words);
        ConfigureJsonProperty(roomBuilder, room => room.Rounds);
        ConfigureJsonProperty(roomBuilder, room => room.CurrentTurn);
    }

    private static void ConfigureJsonProperty<TProperty>(
        EntityTypeBuilder<RoomState> roomBuilder,
        Expression<Func<RoomState, TProperty>> propertyExpression)
    {
        var comparer = new ValueComparer<TProperty>(
            (left, right) => Serialize(left) == Serialize(right),
            value => value == null ? 0 : StringComparer.Ordinal.GetHashCode(Serialize(value)),
            value => value == null ? default! : JsonSerializer.Deserialize<TProperty>(Serialize(value), SerializerOptions)!);

        roomBuilder.Property(propertyExpression)
            .HasColumnType("TEXT")
            .HasConversion(
                value => Serialize(value),
                value => JsonSerializer.Deserialize<TProperty>(value, SerializerOptions)!)
            .Metadata.SetValueComparer(comparer);
    }

    private static string Serialize<TProperty>(TProperty value) => JsonSerializer.Serialize(value, SerializerOptions);
}
