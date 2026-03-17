using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TheHat.Backend.Domain;
using TheHat.Backend.Persistence;
using Xunit;

namespace TheHat.Backend.Tests;

public sealed class TheHatDbContextTests : IDisposable
{
    private readonly IDisplayNameNormalizer _displayNameNormalizer = new DisplayNameNormalizer();
    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"the-hat-tests-{Guid.NewGuid():N}.db");

    [Fact]
    public async Task SaveAndLoad_RestoresRoomStateAcrossDbContexts()
    {
        await using (var saveContext = CreateContext())
        {
            await saveContext.Database.EnsureCreatedAsync();
            var room = CreateRoom(_displayNameNormalizer);

            saveContext.Rooms.Add(room);
            await saveContext.SaveChangesAsync();
        }

        await using var loadContext = CreateContext();
        var restoredRoom = await loadContext.Rooms
            .AsNoTracking()
            .SingleOrDefaultAsync(room => room.RoomId == "room-persisted");

        Assert.NotNull(restoredRoom);
        Assert.Equal(RoomPhase.InProgress, restoredRoom!.Phase);
        Assert.Equal("HOST1", restoredRoom.Players.Single(player => player.Id == "player-1").NormalizedDisplayName);
        Assert.False(restoredRoom.Players.Single(player => player.Id == "player-2").IsActive);
        Assert.Equal(2, restoredRoom.Words.Count(word => word.Text == "echo"));
        Assert.Equal(4, restoredRoom.Players.Single(player => player.Id == "player-1").Score);
        Assert.Equal("word-3", restoredRoom.CurrentTurn!.ActiveWordId);
        Assert.Equal(1, restoredRoom.CurrentRoundNumber);
    }

    private TheHatDbContext CreateContext()
    {
        var connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = _databasePath,
        }.ToString();

        var options = new DbContextOptionsBuilder<TheHatDbContext>()
            .UseSqlite(connectionString)
            .Options;

        return new TheHatDbContext(options);
    }

    private static RoomState CreateRoom(IDisplayNameNormalizer displayNameNormalizer)
    {
        var timestamp = new DateTime(2026, 3, 17, 12, 0, 0, DateTimeKind.Utc);

        return new RoomState
        {
            RoomId = "room-persisted",
            InviteCode = "SAVE01",
            HostPlayerId = "player-1",
            Phase = RoomPhase.InProgress,
            Settings = new RoomSettings
            {
                WordsPerPlayer = 2,
                TurnDurationSeconds = 60,
                PlayerOrderMode = PlayerOrderMode.Manual,
            },
            Players =
            [
                new PlayerState
                {
                    Id = "player-1",
                    DisplayName = "Host1",
                    NormalizedDisplayName = displayNameNormalizer.Normalize("Host1"),
                    IsHost = true,
                    OrderIndex = 0,
                    Score = 4,
                },
                new PlayerState
                {
                    Id = "player-2",
                    DisplayName = "Guest",
                    NormalizedDisplayName = displayNameNormalizer.Normalize("Guest"),
                    IsActive = false,
                    OrderIndex = 1,
                    Score = 2,
                },
            ],
            Words =
            [
                new WordEntry { Id = "word-1", Text = "echo", SubmittedByPlayerId = "player-1" },
                new WordEntry { Id = "word-2", Text = "echo", SubmittedByPlayerId = "player-2" },
                new WordEntry { Id = "word-3", Text = "forest", SubmittedByPlayerId = "player-1" },
            ],
            Rounds =
            [
                new RoundState
                {
                    RoundNumber = 1,
                    Rule = RoundRule.ExplainNoSynonyms,
                    RemainingWordIds = ["word-2"],
                    GuessedWordIds = ["word-1"],
                    StartedAtUtc = timestamp,
                },
            ],
            CurrentRoundNumber = 1,
            CurrentTurn = new TurnState
            {
                TurnNumber = 2,
                ExplainerPlayerId = "player-1",
                GuesserPlayerId = "player-2",
                ActiveWordId = "word-3",
                StartedAtUtc = timestamp,
            },
            CreatedAtUtc = timestamp,
            UpdatedAtUtc = timestamp,
        };
    }

    public void Dispose()
    {
        SqliteConnection.ClearAllPools();

        if (File.Exists(_databasePath))
        {
            File.Delete(_databasePath);
        }
    }
}
