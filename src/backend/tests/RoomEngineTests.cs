using TheHat.Backend.Domain;
using Xunit;

namespace TheHat.Backend.Tests;

public sealed class RoomEngineTests
{
    private readonly IDisplayNameNormalizer _displayNameNormalizer = new DisplayNameNormalizer();
    private readonly IRoomEngine _roomEngine;

    public RoomEngineTests()
    {
        _roomEngine = new RoomEngine(_displayNameNormalizer);
    }

    [Fact]
    public void NormalizeDisplayName_TrimsAndIgnoresCase()
    {
        var normalized = _displayNameNormalizer.Normalize("  aLiCe  ");

        Assert.Equal("ALICE", normalized);
    }

    [Fact]
    public void FindRejoinCandidate_MatchesTrimmedCaseInsensitiveName()
    {
        var room = CreateRoom();

        var player = _roomEngine.FindRejoinCandidate(room, "  alice  ");

        Assert.NotNull(player);
        Assert.Equal("player-1", player!.Id);
    }

    [Fact]
    public void StartGame_UsesConfiguredPlayerOrderAndDrawsFirstWord()
    {
        var room = CreateRoom();

        _roomEngine.StartGame(room, seed: 7, nowUtc: new DateTime(2026, 3, 17, 12, 0, 0, DateTimeKind.Utc));

        Assert.NotNull(room.CurrentTurn);
        Assert.Equal("player-1", room.CurrentTurn!.ExplainerPlayerId);
        Assert.Equal("player-2", room.CurrentTurn.GuesserPlayerId);
        Assert.NotNull(room.CurrentTurn.ActiveWordId);
        Assert.Equal(RoomPhase.InProgress, room.Phase);
        Assert.Equal(RoundRule.ExplainNoSynonyms, room.Rounds.Single().Rule);
    }

    [Fact]
    public void ExpireTurn_ReturnsActiveWordToHatAndRotatesTurn()
    {
        var room = CreateRoom();
        _roomEngine.StartGame(room, seed: 11, nowUtc: new DateTime(2026, 3, 17, 12, 0, 0, DateTimeKind.Utc));

        var firstRound = room.Rounds.Single(round => round.RoundNumber == 1);
        var activeWordId = room.CurrentTurn!.ActiveWordId;
        var expectedRemainingCount = firstRound.RemainingWordIds.Count;

        _roomEngine.ExpireTurn(room, nowUtc: new DateTime(2026, 3, 17, 12, 0, 30, DateTimeKind.Utc));

        Assert.Equal(expectedRemainingCount, firstRound.RemainingWordIds.Count);
        Assert.Equal(activeWordId, room.CurrentTurn!.ActiveWordId);
        Assert.Equal("player-2", room.CurrentTurn!.ExplainerPlayerId);
        Assert.Equal("player-3", room.CurrentTurn.GuesserPlayerId);
    }

    [Fact]
    public void RecordCorrectGuess_AddsPointToExplainerAndGuesser()
    {
        var room = CreateRoom();
        _roomEngine.StartGame(room, seed: 3, nowUtc: new DateTime(2026, 3, 17, 12, 0, 0, DateTimeKind.Utc));

        var previousWordId = room.CurrentTurn!.ActiveWordId;
        _roomEngine.RecordCorrectGuess(room, nowUtc: new DateTime(2026, 3, 17, 12, 0, 5, DateTimeKind.Utc));

        Assert.Equal(1, room.Players.Single(player => player.Id == "player-1").Score);
        Assert.Equal(1, room.Players.Single(player => player.Id == "player-2").Score);
        Assert.NotNull(room.CurrentTurn!.ActiveWordId);
        Assert.NotEqual(previousWordId, room.CurrentTurn.ActiveWordId);
    }

    [Fact]
    public void RecordCorrectGuess_EndsRoundAndRequiresExplicitContinue()
    {
        var room = CreateTwoPlayerRoomWithSingleWord();
        _roomEngine.StartGame(room, seed: 1, nowUtc: new DateTime(2026, 3, 17, 12, 0, 0, DateTimeKind.Utc));

        _roomEngine.RecordCorrectGuess(room, nowUtc: new DateTime(2026, 3, 17, 12, 0, 1, DateTimeKind.Utc));

        Assert.Equal(RoomPhase.RoundSummary, room.Phase);
        Assert.Null(room.CurrentTurn);
        Assert.Single(room.Rounds);
        Assert.True(room.Rounds.Single().IsCompleted);
    }

    [Fact]
    public void ContinueToNextRound_KeepsRotationAndReshufflesWordPool()
    {
        var room = CreateTwoPlayerRoomWithSingleWord();
        _roomEngine.StartGame(room, seed: 1, nowUtc: new DateTime(2026, 3, 17, 12, 0, 0, DateTimeKind.Utc));

        _roomEngine.RecordCorrectGuess(room, nowUtc: new DateTime(2026, 3, 17, 12, 0, 1, DateTimeKind.Utc));
        _roomEngine.ContinueToNextRound(room, seed: 2, nowUtc: new DateTime(2026, 3, 17, 12, 0, 2, DateTimeKind.Utc));

        Assert.Equal(RoomPhase.InProgress, room.Phase);
        Assert.Equal(2, room.CurrentRoundNumber);
        Assert.Equal(RoundRule.GesturesOnly, room.Rounds.Single(round => round.RoundNumber == 2).Rule);
        Assert.Equal("player-2", room.CurrentTurn!.ExplainerPlayerId);
        Assert.Equal("player-1", room.CurrentTurn.GuesserPlayerId);
        Assert.NotNull(room.CurrentTurn.ActiveWordId);
    }

    [Fact]
    public void CompleteThirdRound_CompletesGame()
    {
        var room = CreateTwoPlayerRoomWithSingleWord();
        _roomEngine.StartGame(room, seed: 1, nowUtc: new DateTime(2026, 3, 17, 12, 0, 0, DateTimeKind.Utc));

        for (var roundNumber = 1; roundNumber <= 3; roundNumber++)
        {
            _roomEngine.RecordCorrectGuess(room, nowUtc: new DateTime(2026, 3, 17, 12, 0, roundNumber, DateTimeKind.Utc));
            if (roundNumber < 3)
            {
                _roomEngine.ContinueToNextRound(room, seed: roundNumber + 10, nowUtc: new DateTime(2026, 3, 17, 12, 0, roundNumber + 10, DateTimeKind.Utc));
            }
        }

        Assert.Equal(RoomPhase.Completed, room.Phase);
        Assert.Null(room.CurrentTurn);
        Assert.Equal(3, room.Rounds.Count);
        Assert.All(room.Rounds, round => Assert.True(round.IsCompleted));
    }

    [Fact]
    public void StartNextTurn_SkipsInactivePlayers()
    {
        var room = CreateRoom();
        room.Players.Single(player => player.Id == "player-2").IsActive = false;

        _roomEngine.StartGame(room, seed: 9, nowUtc: new DateTime(2026, 3, 17, 12, 0, 0, DateTimeKind.Utc));

        Assert.Equal("player-1", room.CurrentTurn!.ExplainerPlayerId);
        Assert.Equal("player-3", room.CurrentTurn.GuesserPlayerId);

        _roomEngine.ExpireTurn(room, nowUtc: new DateTime(2026, 3, 17, 12, 0, 30, DateTimeKind.Utc));

        Assert.Equal("player-3", room.CurrentTurn!.ExplainerPlayerId);
        Assert.Equal("player-1", room.CurrentTurn.GuesserPlayerId);
    }

    [Fact]
    public void PauseAndResume_PreserveRemainingTurnTime()
    {
        var room = CreateRoom();
        _roomEngine.StartGame(room, seed: 5, nowUtc: new DateTime(2026, 3, 17, 12, 0, 0, DateTimeKind.Utc));

        _roomEngine.PauseGame(room, nowUtc: new DateTime(2026, 3, 17, 12, 0, 20, DateTimeKind.Utc));

        Assert.Equal(RoomPhase.Paused, room.Phase);
        Assert.Equal(40, _roomEngine.GetRemainingTurnSeconds(room, new DateTime(2026, 3, 17, 12, 0, 30, DateTimeKind.Utc)));

        _roomEngine.ResumeGame(room, nowUtc: new DateTime(2026, 3, 17, 12, 0, 50, DateTimeKind.Utc));

        Assert.Equal(RoomPhase.InProgress, room.Phase);
        Assert.Equal(40, _roomEngine.GetRemainingTurnSeconds(room, new DateTime(2026, 3, 17, 12, 0, 50, DateTimeKind.Utc)));
    }

    [Fact]
    public void DeactivatePlayer_PreservesAffectedTurnAndKeepsScores()
    {
        var room = CreateRoom();
        _roomEngine.StartGame(room, seed: 5, nowUtc: new DateTime(2026, 3, 17, 12, 0, 0, DateTimeKind.Utc));
        room.Players.Single(player => player.Id == "player-1").Score = 3;
        var activeWordId = room.CurrentTurn!.ActiveWordId;

        var changed = _roomEngine.DeactivatePlayer(room, "player-2", new DateTime(2026, 3, 17, 12, 0, 15, DateTimeKind.Utc));

        Assert.True(changed);
        Assert.False(room.Players.Single(player => player.Id == "player-2").IsActive);
        Assert.Equal(3, room.Players.Single(player => player.Id == "player-1").Score);
        Assert.Equal(RoomPhase.InProgress, room.Phase);
        Assert.NotNull(room.CurrentTurn);
        Assert.Equal("player-1", room.CurrentTurn!.ExplainerPlayerId);
        Assert.Equal("player-2", room.CurrentTurn.GuesserPlayerId);
        Assert.Equal(activeWordId, room.CurrentTurn.ActiveWordId);
    }

    [Fact]
    public void EndTurn_AfterInterruptedTurnRotatesToNextEligiblePair()
    {
        var room = CreateRoom();
        _roomEngine.StartGame(room, seed: 5, nowUtc: new DateTime(2026, 3, 17, 12, 0, 0, DateTimeKind.Utc));

        _roomEngine.DeactivatePlayer(room, "player-2", new DateTime(2026, 3, 17, 12, 0, 10, DateTimeKind.Utc));
        _roomEngine.EndTurn(room, new DateTime(2026, 3, 17, 12, 0, 11, DateTimeKind.Utc));

        Assert.Equal(RoomPhase.InProgress, room.Phase);
        Assert.NotNull(room.CurrentTurn);
        Assert.Equal("player-3", room.CurrentTurn!.ExplainerPlayerId);
        Assert.Equal("player-1", room.CurrentTurn.GuesserPlayerId);
    }

    [Fact]
    public void EndTurn_WithTooFewActivePlayers_PausesGameUntilSomeoneReturns()
    {
        var room = CreateTwoPlayerRoomWithSingleWord();
        _roomEngine.StartGame(room, seed: 1, nowUtc: new DateTime(2026, 3, 17, 12, 0, 0, DateTimeKind.Utc));

        var changed = _roomEngine.DeactivatePlayer(room, "player-2", new DateTime(2026, 3, 17, 12, 0, 10, DateTimeKind.Utc));

        Assert.True(changed);
        Assert.Equal(RoomPhase.InProgress, room.Phase);
        Assert.NotNull(room.CurrentTurn);

        _roomEngine.EndTurn(room, new DateTime(2026, 3, 17, 12, 0, 11, DateTimeKind.Utc));

        Assert.Equal(RoomPhase.Paused, room.Phase);
        Assert.Null(room.CurrentTurn);

        var reactivated = _roomEngine.ReactivatePlayer(room, "player-2", new DateTime(2026, 3, 17, 12, 0, 20, DateTimeKind.Utc));

        Assert.True(reactivated);
        Assert.Equal(RoomPhase.InProgress, room.Phase);
        Assert.NotNull(room.CurrentTurn);
        Assert.Equal("player-2", room.CurrentTurn!.ExplainerPlayerId);
        Assert.Equal("player-1", room.CurrentTurn.GuesserPlayerId);
    }

    [Fact]
    public void AdvanceState_ExpiresElapsedTurns()
    {
        var room = CreateRoom();
        _roomEngine.StartGame(room, seed: 5, nowUtc: new DateTime(2026, 3, 17, 12, 0, 0, DateTimeKind.Utc));

        var changed = _roomEngine.AdvanceState(room, nowUtc: new DateTime(2026, 3, 17, 12, 1, 0, DateTimeKind.Utc));

        Assert.True(changed);
        Assert.Equal("player-2", room.CurrentTurn!.ExplainerPlayerId);
    }

    [Fact]
    public void StartGame_AllowsDuplicateWords()
    {
        var room = CreateRoom();

        _roomEngine.StartGame(room, seed: 5, nowUtc: new DateTime(2026, 3, 17, 12, 0, 0, DateTimeKind.Utc));

        Assert.Equal(4, room.Words.Count);
        Assert.Equal(2, room.Words.Count(word => word.Text == "banana"));
        Assert.Equal(3, room.Rounds.Single(round => round.RoundNumber == 1).RemainingWordIds.Count);
    }

    private static RoomState CreateRoom()
    {
        var createdAt = new DateTime(2026, 3, 17, 11, 55, 0, DateTimeKind.Utc);

        return new RoomState
        {
            RoomId = "room-1",
            InviteCode = "ABC123",
            HostPlayerId = "player-1",
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
                    DisplayName = "Alice",
                    NormalizedDisplayName = new DisplayNameNormalizer().Normalize("Alice"),
                    IsHost = true,
                    OrderIndex = 0,
                },
                new PlayerState
                {
                    Id = "player-2",
                    DisplayName = "Bob",
                    NormalizedDisplayName = new DisplayNameNormalizer().Normalize("Bob"),
                    OrderIndex = 1,
                },
                new PlayerState
                {
                    Id = "player-3",
                    DisplayName = "Cara",
                    NormalizedDisplayName = new DisplayNameNormalizer().Normalize("Cara"),
                    OrderIndex = 2,
                },
            ],
            Words =
            [
                new WordEntry { Id = "word-1", Text = "banana", SubmittedByPlayerId = "player-1" },
                new WordEntry { Id = "word-2", Text = "banana", SubmittedByPlayerId = "player-1" },
                new WordEntry { Id = "word-3", Text = "planet", SubmittedByPlayerId = "player-2" },
                new WordEntry { Id = "word-4", Text = "lantern", SubmittedByPlayerId = "player-3" },
            ],
            CreatedAtUtc = createdAt,
            UpdatedAtUtc = createdAt,
        };
    }

    private static RoomState CreateTwoPlayerRoomWithSingleWord()
    {
        var createdAt = new DateTime(2026, 3, 17, 11, 55, 0, DateTimeKind.Utc);

        return new RoomState
        {
            RoomId = "room-2",
            InviteCode = "ONE123",
            HostPlayerId = "player-1",
            Settings = new RoomSettings
            {
                WordsPerPlayer = 1,
                TurnDurationSeconds = 60,
                PlayerOrderMode = PlayerOrderMode.Manual,
            },
            Players =
            [
                new PlayerState
                {
                    Id = "player-1",
                    DisplayName = "Alice",
                    NormalizedDisplayName = new DisplayNameNormalizer().Normalize("Alice"),
                    IsHost = true,
                    OrderIndex = 0,
                },
                new PlayerState
                {
                    Id = "player-2",
                    DisplayName = "Bob",
                    NormalizedDisplayName = new DisplayNameNormalizer().Normalize("Bob"),
                    OrderIndex = 1,
                },
            ],
            Words =
            [
                new WordEntry { Id = "word-1", Text = "meteor", SubmittedByPlayerId = "player-1" },
            ],
            CreatedAtUtc = createdAt,
            UpdatedAtUtc = createdAt,
        };
    }
}
