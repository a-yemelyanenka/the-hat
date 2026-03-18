using Microsoft.EntityFrameworkCore;
using TheHat.Backend.Domain;
using TheHat.Backend.Persistence;
using Xunit;

namespace TheHat.Backend.Tests;

public sealed class RoomWordSubmissionServiceTests : IAsyncDisposable
{
    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"the-hat-room-word-submission-tests-{Guid.NewGuid():N}.db");

    [Fact]
    public async Task SubmitWordsAsync_ReplacesExistingWordsAndAllowsDuplicates()
    {
        await using var dbContext = CreateContext();
        await dbContext.Database.EnsureCreatedAsync();

        var room = CreateRoom();
        room.Words.Add(new WordEntry
        {
            Id = "old-word",
            Text = "old",
            SubmittedByPlayerId = room.HostPlayerId,
        });

        dbContext.Rooms.Add(room);
        await dbContext.SaveChangesAsync();

        var service = new RoomWordSubmissionService(dbContext);

        var updatedRoom = await service.SubmitWordsAsync(room.RoomId, room.HostPlayerId, ["  echo  ", "echo"]);

        var hostWords = updatedRoom.Words.Where(word => word.SubmittedByPlayerId == room.HostPlayerId).ToList();
        Assert.Equal(2, hostWords.Count);
        Assert.Equal(2, hostWords.Count(word => word.Text == "echo"));

        var persistedRoom = await dbContext.Rooms.AsNoTracking().SingleAsync(existingRoom => existingRoom.RoomId == room.RoomId);
        Assert.Equal(2, persistedRoom.Words.Count(word => word.SubmittedByPlayerId == room.HostPlayerId));
        Assert.DoesNotContain(persistedRoom.Words, word => word.Id == "old-word");
    }

    [Fact]
    public async Task SubmitWordsAsync_ThrowsDomainValidationExceptionForWrongCountOrWhitespace()
    {
        await using var dbContext = CreateContext();
        await dbContext.Database.EnsureCreatedAsync();

        var room = CreateRoom();
        dbContext.Rooms.Add(room);
        await dbContext.SaveChangesAsync();

        var service = new RoomWordSubmissionService(dbContext);

        var exception = await Assert.ThrowsAsync<DomainValidationException>(() => service.SubmitWordsAsync(room.RoomId, room.HostPlayerId, ["meteor", "   ", "forest"]));

        Assert.Equal("Exactly 2 words are required.", exception.Errors["words"][0]);
        Assert.Equal("Words cannot be empty or whitespace.", exception.Errors["words[1]"][0]);
    }

    private TheHatDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<TheHatDbContext>()
            .UseSqlite($"Data Source={_databasePath}")
            .Options;

        return new TheHatDbContext(options);
    }

    private static RoomState CreateRoom()
    {
        var room = new RoomFactory(new DisplayNameNormalizer()).CreateRoom(
            "Alice",
            new RoomSettings
            {
                WordsPerPlayer = 2,
                TurnDurationSeconds = 60,
                PlayerOrderMode = PlayerOrderMode.Manual,
            },
            nowUtc: new DateTime(2026, 3, 18, 12, 0, 0, DateTimeKind.Utc),
            roomId: Guid.NewGuid().ToString("N"),
            hostPlayerId: "player-host",
            inviteCode: "WORDS123");

        room.Players.Add(new PlayerState
        {
            Id = "player-guest",
            DisplayName = "Bob",
            NormalizedDisplayName = new DisplayNameNormalizer().Normalize("Bob"),
            OrderIndex = 1,
            IsActive = true,
        });

        return room;
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