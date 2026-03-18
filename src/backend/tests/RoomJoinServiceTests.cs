using Microsoft.EntityFrameworkCore;
using TheHat.Backend.Domain;
using TheHat.Backend.Persistence;
using Xunit;

namespace TheHat.Backend.Tests;

public sealed class RoomJoinServiceTests : IAsyncDisposable
{
    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"the-hat-room-join-tests-{Guid.NewGuid():N}.db");

    [Fact]
    public async Task JoinRoomAsync_AddsPlayerUsingTrimmedDisplayName()
    {
        await using var dbContext = CreateContext();
        await dbContext.Database.EnsureCreatedAsync();

        var displayNameNormalizer = new DisplayNameNormalizer();
        var room = new RoomFactory(displayNameNormalizer).CreateRoom(
            "Alice",
            new RoomSettings
            {
                WordsPerPlayer = 5,
                TurnDurationSeconds = 60,
                PlayerOrderMode = PlayerOrderMode.Random,
            },
            nowUtc: DateTime.UtcNow,
            inviteCode: "ABCD1234");

        dbContext.Rooms.Add(room);
        await dbContext.SaveChangesAsync();

        var service = new RoomJoinService(dbContext, displayNameNormalizer);

        var updatedRoom = await service.JoinRoomAsync("abcd1234", "  Bob  ");

        Assert.Equal(2, updatedRoom.Players.Count);

        var joinedPlayer = Assert.Single(updatedRoom.Players, player => !player.IsHost);
        Assert.Equal("Bob", joinedPlayer.DisplayName);
        Assert.Equal(displayNameNormalizer.Normalize("Bob"), joinedPlayer.NormalizedDisplayName);
        Assert.True(joinedPlayer.IsActive);
        Assert.Equal(1, joinedPlayer.OrderIndex);
        Assert.Equal(0, joinedPlayer.Score);

        var persistedRoom = await dbContext.Rooms.AsNoTracking().SingleAsync(existingRoom => existingRoom.RoomId == room.RoomId);
        Assert.Equal(2, persistedRoom.Players.Count);
        Assert.Contains(persistedRoom.Players, player => player.IsHost && player.DisplayName == "Alice");
        Assert.Contains(persistedRoom.Players, player => !player.IsHost && player.DisplayName == "Bob");
    }

    [Fact]
    public async Task JoinRoomAsync_ThrowsDomainValidationExceptionForAmbiguousDuplicateDisplayName()
    {
        await using var dbContext = CreateContext();
        await dbContext.Database.EnsureCreatedAsync();

        var displayNameNormalizer = new DisplayNameNormalizer();
        var room = new RoomFactory(displayNameNormalizer).CreateRoom(
            "Alice",
            new RoomSettings
            {
                WordsPerPlayer = 5,
                TurnDurationSeconds = 60,
                PlayerOrderMode = PlayerOrderMode.Random,
            },
            nowUtc: DateTime.UtcNow,
            inviteCode: "ABCD1234");

        dbContext.Rooms.Add(room);
        await dbContext.SaveChangesAsync();

        var service = new RoomJoinService(dbContext, displayNameNormalizer);

        var exception = await Assert.ThrowsAsync<DomainValidationException>(() => service.JoinRoomAsync("ABCD1234", "  alice  "));

        Assert.Equal("This display name is already taken in the room.", exception.Errors["displayName"][0]);
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