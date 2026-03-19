using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using TheHat.Backend.Contracts;
using TheHat.Backend.Domain;
using TheHat.Backend.Persistence;
using Xunit;

namespace TheHat.Backend.Tests;

public sealed class RoomGameplayApiTests : IAsyncDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"the-hat-gameplay-api-tests-{Guid.NewGuid():N}.db");
    private readonly WebApplicationFactory<Program> _factory;

    public RoomGameplayApiTests()
    {
        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseSetting(WebHostDefaults.EnvironmentKey, Environments.Development);
                builder.UseSetting("ConnectionStrings:TheHat", $"Data Source={_databasePath}");
            });
    }

    [Fact]
    public async Task GetGameplay_ShowsActiveWordOnlyToExplainer()
    {
        var seededRoom = await SeedStartedRoomAsync(singleWord: false);

        using var client = _factory.CreateClient();

        var explainerResponse = await client.GetAsync($"/api/rooms/{seededRoom.RoomId}/gameplay?playerId={seededRoom.HostPlayerId}");
        var guesserResponse = await client.GetAsync($"/api/rooms/{seededRoom.RoomId}/gameplay?playerId={seededRoom.GuestPlayerId}");

        Assert.Equal(HttpStatusCode.OK, explainerResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, guesserResponse.StatusCode);

        var explainerPayload = await explainerResponse.Content.ReadFromJsonAsync<GameplayViewDto>(JsonOptions);
        var guesserPayload = await guesserResponse.Content.ReadFromJsonAsync<GameplayViewDto>(JsonOptions);

        Assert.NotNull(explainerPayload);
        Assert.NotNull(guesserPayload);
        Assert.True(explainerPayload!.IsCurrentPlayerExplainer);
        Assert.False(explainerPayload.IsCurrentPlayerGuesser);
        Assert.False(string.IsNullOrWhiteSpace(explainerPayload.ActiveWord));
        Assert.Null(guesserPayload!.ActiveWord);
        Assert.True(guesserPayload.IsCurrentPlayerGuesser);
    }

    [Fact]
    public async Task StartTurn_OnlyAssignedExplainerCanStartPreparedTurn()
    {
        var seededRoom = await SeedPreparedRoomAsync();

        using var client = _factory.CreateClient();

        var guestResponse = await client.PostAsJsonAsync(
            $"/api/rooms/{seededRoom.RoomId}/gameplay/start-turn",
            new StartTurnRequestDto(seededRoom.GuestPlayerId));

        Assert.Equal(HttpStatusCode.BadRequest, guestResponse.StatusCode);

        var hostResponse = await client.PostAsJsonAsync(
            $"/api/rooms/{seededRoom.RoomId}/gameplay/start-turn",
            new StartTurnRequestDto(seededRoom.HostPlayerId));

        Assert.Equal(HttpStatusCode.OK, hostResponse.StatusCode);

        var startedRoom = await hostResponse.Content.ReadFromJsonAsync<RoomSnapshotDto>(JsonOptions);
        Assert.NotNull(startedRoom);
        Assert.Equal(RoomPhase.InProgress, startedRoom!.Phase);
        Assert.NotNull(startedRoom.CurrentTurn?.ActiveWordId);
    }

    [Fact]
    public async Task PauseAndResume_UpdateRoomPhaseAndTimerState()
    {
        var seededRoom = await SeedStartedRoomAsync(singleWord: false);

        using var client = _factory.CreateClient();

        var pauseResponse = await client.PostAsJsonAsync($"/api/rooms/{seededRoom.RoomId}/gameplay/pause", new PauseGameRequestDto(seededRoom.HostPlayerId));
        Assert.Equal(HttpStatusCode.OK, pauseResponse.StatusCode);

        var pausedRoom = await pauseResponse.Content.ReadFromJsonAsync<RoomSnapshotDto>(JsonOptions);
        Assert.NotNull(pausedRoom);
        Assert.Equal(RoomPhase.Paused, pausedRoom!.Phase);
        Assert.NotNull(pausedRoom.CurrentTurn?.RemainingSecondsWhenPaused);

        var resumeResponse = await client.PostAsJsonAsync($"/api/rooms/{seededRoom.RoomId}/gameplay/resume", new ResumeGameRequestDto(seededRoom.HostPlayerId));
        Assert.Equal(HttpStatusCode.OK, resumeResponse.StatusCode);

        var resumedRoom = await resumeResponse.Content.ReadFromJsonAsync<RoomSnapshotDto>(JsonOptions);
        Assert.NotNull(resumedRoom);
        Assert.Equal(RoomPhase.InProgress, resumedRoom!.Phase);
        Assert.Null(resumedRoom.CurrentTurn?.RemainingSecondsWhenPaused);
    }

    [Fact]
    public async Task ConfirmGuess_EndsRoundAndContinueRoundStartsNextRule()
    {
        var seededRoom = await SeedStartedRoomAsync(singleWord: true);

        using var client = _factory.CreateClient();

        var confirmResponse = await client.PostAsJsonAsync(
            $"/api/rooms/{seededRoom.RoomId}/gameplay/guesses/confirm",
            new ConfirmGuessRequestDto(seededRoom.HostPlayerId));

        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);

        var roundSummaryRoom = await confirmResponse.Content.ReadFromJsonAsync<RoomSnapshotDto>(JsonOptions);
        Assert.NotNull(roundSummaryRoom);
        Assert.Equal(RoomPhase.RoundSummary, roundSummaryRoom!.Phase);
        Assert.Equal(1, roundSummaryRoom.Players.Single(player => player.PlayerId == seededRoom.HostPlayerId).Score);
        Assert.Equal(1, roundSummaryRoom.Players.Single(player => player.PlayerId == seededRoom.GuestPlayerId).Score);

        var continueResponse = await client.PostAsJsonAsync(
            $"/api/rooms/{seededRoom.RoomId}/gameplay/continue",
            new ContinueRoundRequestDto(seededRoom.HostPlayerId));

        Assert.Equal(HttpStatusCode.OK, continueResponse.StatusCode);

        var continuedRoom = await continueResponse.Content.ReadFromJsonAsync<RoomSnapshotDto>(JsonOptions);
        Assert.NotNull(continuedRoom);
        Assert.Equal(RoomPhase.AwaitingTurnStart, continuedRoom!.Phase);
        Assert.Equal(2, continuedRoom.CurrentRoundNumber);
        Assert.Equal(RoundRule.GesturesOnly, continuedRoom.Rounds.Single(round => round.RoundNumber == 2).Rule);
    }

    [Fact]
    public async Task EndTurn_WhenTurnIsInterrupted_EndsTurnForExplainer()
    {
        var seededRoom = await SeedStartedRoomAsync(singleWord: false);

        await using (var scope = _factory.Services.CreateAsyncScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<TheHatDbContext>();
            var room = await dbContext.Rooms.SingleAsync(room => room.RoomId == seededRoom.RoomId);
            room.Players.Single(player => player.Id == seededRoom.GuestPlayerId).IsActive = false;
            await dbContext.SaveChangesAsync();
        }

        using var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/rooms/{seededRoom.RoomId}/gameplay/end-turn",
            new EndTurnRequestDto(seededRoom.HostPlayerId));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var updatedRoom = await response.Content.ReadFromJsonAsync<RoomSnapshotDto>(JsonOptions);
        Assert.NotNull(updatedRoom);
        Assert.Equal(RoomPhase.Paused, updatedRoom!.Phase);
        Assert.Null(updatedRoom.CurrentTurn);
        Assert.False(updatedRoom.Players.Single(player => player.PlayerId == seededRoom.GuestPlayerId).IsActive);
    }

    [Fact]
    public async Task GetGameplay_WhenTurnTimerExpires_AdvancesToPreparedNextTurn()
    {
        var seededRoom = await SeedStartedRoomAsync(singleWord: false);

        await using (var scope = _factory.Services.CreateAsyncScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<TheHatDbContext>();
            var room = await dbContext.Rooms.SingleAsync(room => room.RoomId == seededRoom.RoomId);
            room.CurrentTurn!.EndsAtUtc = DateTime.UtcNow.AddMilliseconds(-250);
            await dbContext.SaveChangesAsync();
        }

        using var client = _factory.CreateClient();

        var response = await client.GetAsync($"/api/rooms/{seededRoom.RoomId}/gameplay?playerId={seededRoom.HostPlayerId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<GameplayViewDto>(JsonOptions);
        Assert.NotNull(payload);
        Assert.Equal(RoomPhase.AwaitingTurnStart, payload!.Room.Phase);
        Assert.NotNull(payload.Room.CurrentTurn);
        Assert.Equal(seededRoom.GuestPlayerId, payload.Room.CurrentTurn!.ExplainerPlayerId);
        Assert.Null(payload.ActiveWord);
    }

    private async Task<SeededRoom> SeedStartedRoomAsync(bool singleWord)
    {
        var seededRoom = await SeedPreparedRoomAsync(singleWord);

        await using var scope = _factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<TheHatDbContext>();
        var room = await dbContext.Rooms.SingleAsync(existingRoom => existingRoom.RoomId == seededRoom.RoomId);
        new RoomEngine(new DisplayNameNormalizer()).StartTurn(room, nowUtc: DateTime.UtcNow.AddSeconds(2));
        await dbContext.SaveChangesAsync();

        return seededRoom;
    }

    private async Task<SeededRoom> SeedPreparedRoomAsync(bool singleWord = false)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<TheHatDbContext>();
        await dbContext.Database.EnsureCreatedAsync();

        var normalizer = new DisplayNameNormalizer();
        var nowUtc = DateTime.UtcNow;
        var room = new RoomFactory(normalizer).CreateRoom(
            "Alice",
            new RoomSettings
            {
                WordsPerPlayer = singleWord ? 1 : 2,
                TurnDurationSeconds = 600,
                PlayerOrderMode = PlayerOrderMode.Manual,
            },
            nowUtc: nowUtc,
            roomId: Guid.NewGuid().ToString("N"),
            hostPlayerId: "player-host",
            inviteCode: singleWord ? "ROUND999" : "GAME9999");

        room.Players.Add(new PlayerState
        {
            Id = "player-guest",
            DisplayName = "Bob",
            NormalizedDisplayName = normalizer.Normalize("Bob"),
            OrderIndex = 1,
            IsActive = true,
        });

        room.Words.Add(new WordEntry
        {
            Id = "word-1",
            Text = "meteor",
            SubmittedByPlayerId = room.HostPlayerId,
        });

        if (!singleWord)
        {
            room.Words.Add(new WordEntry
            {
                Id = "word-2",
                Text = "harbor",
                SubmittedByPlayerId = "player-guest",
            });
        }

        new RoomEngine(new DisplayNameNormalizer()).StartGame(room, seed: 7, nowUtc: nowUtc.AddSeconds(1));
        dbContext.Rooms.Add(room);
        await dbContext.SaveChangesAsync();

        return new SeededRoom(room.RoomId, room.HostPlayerId, "player-guest");
    }

    public async ValueTask DisposeAsync()
    {
        await _factory.DisposeAsync();

        if (File.Exists(_databasePath))
        {
            File.Delete(_databasePath);
        }
    }

    private sealed record SeededRoom(string RoomId, string HostPlayerId, string GuestPlayerId);
}
