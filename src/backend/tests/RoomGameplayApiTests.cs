using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
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
        Assert.Equal(RoomPhase.InProgress, continuedRoom!.Phase);
        Assert.Equal(2, continuedRoom.CurrentRoundNumber);
        Assert.Equal(RoundRule.GesturesOnly, continuedRoom.Rounds.Single(round => round.RoundNumber == 2).Rule);
    }

    private async Task<SeededRoom> SeedStartedRoomAsync(bool singleWord)
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
