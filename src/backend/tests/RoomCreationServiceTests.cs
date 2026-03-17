using Microsoft.EntityFrameworkCore;
using TheHat.Backend.Domain;
using TheHat.Backend.Persistence;
using Xunit;

namespace TheHat.Backend.Tests;

public sealed class RoomCreationServiceTests : IAsyncDisposable
{
    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"the-hat-room-creation-tests-{Guid.NewGuid():N}.db");

    [Fact]
    public async Task CreateRoomAsync_PersistsLobbyRoomUsingDomainService()
    {
        await using var dbContext = CreateContext();
        await dbContext.Database.EnsureCreatedAsync();

        var displayNameNormalizer = new DisplayNameNormalizer();
        var service = new RoomCreationService(dbContext, new RoomFactory(displayNameNormalizer));

        var room = await service.CreateRoomAsync(
            "  Alice  ",
            new RoomSettings
            {
                WordsPerPlayer = 4,
                TurnDurationSeconds = 90,
                PlayerOrderMode = PlayerOrderMode.Random,
            });

        Assert.Equal(RoomPhase.Lobby, room.Phase);
        Assert.Equal(4, room.Settings.WordsPerPlayer);
        Assert.Equal(90, room.Settings.TurnDurationSeconds);
        Assert.Equal(PlayerOrderMode.Random, room.Settings.PlayerOrderMode);
        Assert.Single(room.Players);
        Assert.Equal("Alice", room.Players[0].DisplayName);
        Assert.Equal(displayNameNormalizer.Normalize("Alice"), room.Players[0].NormalizedDisplayName);

        var persistedRoom = await dbContext.Rooms.AsNoTracking().SingleAsync(entity => entity.RoomId == room.RoomId);
        Assert.Equal(room.InviteCode, persistedRoom.InviteCode);
        Assert.Equal(room.HostPlayerId, persistedRoom.HostPlayerId);
    }

    [Fact]
    public async Task CreateRoomAsync_ThrowsDomainValidationExceptionForInvalidSettings()
    {
        await using var dbContext = CreateContext();
        await dbContext.Database.EnsureCreatedAsync();

        var service = new RoomCreationService(dbContext, new RoomFactory(new DisplayNameNormalizer()));

        var exception = await Assert.ThrowsAsync<DomainValidationException>(() => service.CreateRoomAsync(
            "   ",
            new RoomSettings
            {
                WordsPerPlayer = 0,
                TurnDurationSeconds = 0,
                PlayerOrderMode = PlayerOrderMode.Random,
            }));

        Assert.Contains(nameof(RoomSettings.WordsPerPlayer), exception.Errors.Keys.Single(key => key.EndsWith(nameof(RoomSettings.WordsPerPlayer), StringComparison.Ordinal)));
        Assert.Contains(nameof(RoomSettings.TurnDurationSeconds), exception.Errors.Keys.Single(key => key.EndsWith(nameof(RoomSettings.TurnDurationSeconds), StringComparison.Ordinal)));
        Assert.Contains("hostDisplayName", exception.Errors.Keys);
        Assert.Equal("The host display name is required.", exception.Errors["hostDisplayName"][0]);
        Assert.Equal("Words per player must be greater than zero.", exception.Errors["settings.WordsPerPlayer"][0]);
        Assert.Equal("Turn duration must be greater than zero.", exception.Errors["settings.TurnDurationSeconds"][0]);
    }

    private TheHatDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<TheHatDbContext>()
            .UseSqlite($"Data Source={_databasePath}")
            .Options;

        return new TheHatDbContext(options);
    }

    public ValueTask DisposeAsync()
    {
        if (File.Exists(_databasePath))
        {
            File.Delete(_databasePath);
        }

        return ValueTask.CompletedTask;
    }
}