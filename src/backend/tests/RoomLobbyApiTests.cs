using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using TheHat.Backend.Contracts;
using TheHat.Backend.Domain;
using TheHat.Backend.Persistence;
using Xunit;

namespace TheHat.Backend.Tests;

public sealed class RoomLobbyApiTests : IAsyncDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"the-hat-lobby-api-tests-{Guid.NewGuid():N}.db");
    private readonly WebApplicationFactory<Program> _factory;

    public RoomLobbyApiTests()
    {
        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseSetting(WebHostDefaults.EnvironmentKey, Environments.Development);
                builder.UseSetting("ConnectionStrings:TheHat", $"Data Source={_databasePath}");
            });
    }

    [Fact]
    public async Task GetRoom_ReturnsSubmissionProgressAndReadiness()
    {
        var seededRoom = await SeedRoomAsync();

        using var client = _factory.CreateClient();

        var response = await client.GetAsync($"/api/rooms/{seededRoom.RoomId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<RoomSnapshotDto>(JsonOptions);
        Assert.NotNull(payload);
        Assert.Equal(3, payload!.SubmissionProgress.Count);

        var hostProgress = payload.SubmissionProgress.Single(progress => progress.PlayerId == seededRoom.HostPlayerId);
        Assert.Equal(1, hostProgress.SubmittedCount);
        Assert.Equal(2, hostProgress.RequiredCount);
        Assert.False(hostProgress.IsComplete);
        Assert.False(payload.LobbyReadiness.CanStart);
        Assert.Contains(payload.LobbyReadiness.BlockingReasons, reason => reason.Contains("Bob", StringComparison.Ordinal));
    }

    [Fact]
    public async Task UpdateRoomSettings_StoresManualPlayerOrderAndNewValues()
    {
        var seededRoom = await SeedRoomAsync();

        using var client = _factory.CreateClient();

        var response = await client.PutAsJsonAsync($"/api/rooms/{seededRoom.RoomId}/settings", new UpdateRoomSettingsRequestDto(
            seededRoom.HostPlayerId,
            new RoomSettingsDto(3, 90, PlayerOrderMode.Manual),
            [seededRoom.GuestPlayerIds[1], seededRoom.HostPlayerId, seededRoom.GuestPlayerIds[0]]));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<RoomSnapshotDto>(JsonOptions);
        Assert.NotNull(payload);
        Assert.Equal(3, payload!.Settings.WordsPerPlayer);
        Assert.Equal(90, payload.Settings.TurnDurationSeconds);
        Assert.Equal(PlayerOrderMode.Manual, payload.Settings.PlayerOrderMode);
        Assert.Equal(seededRoom.GuestPlayerIds[1], payload.Players[0].PlayerId);
        Assert.Equal(seededRoom.HostPlayerId, payload.Players[1].PlayerId);
        Assert.Equal(seededRoom.GuestPlayerIds[0], payload.Players[2].PlayerId);
    }

    [Fact]
    public async Task StartGame_ReturnsBadRequestWhenWordSubmissionsAreIncomplete()
    {
        var seededRoom = await SeedRoomAsync();

        using var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync($"/api/rooms/{seededRoom.RoomId}/start", new StartGameRequestDto(seededRoom.HostPlayerId));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(JsonOptions);
        Assert.NotNull(payload);
        Assert.True(payload!.Errors?.ContainsKey("startGame"));
        Assert.Contains(payload.Errors!["startGame"], error => error.Contains("still needs", StringComparison.Ordinal));
    }

    private async Task<SeededRoom> SeedRoomAsync()
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<TheHatDbContext>();
        await dbContext.Database.EnsureCreatedAsync();

        var displayNameNormalizer = new DisplayNameNormalizer();
        var room = new RoomFactory(displayNameNormalizer).CreateRoom(
            "Alice",
            new RoomSettings
            {
                WordsPerPlayer = 2,
                TurnDurationSeconds = 60,
                PlayerOrderMode = PlayerOrderMode.Manual,
            },
            nowUtc: new DateTime(2026, 3, 18, 10, 0, 0, DateTimeKind.Utc),
            roomId: Guid.NewGuid().ToString("N"),
            hostPlayerId: "player-host",
            inviteCode: "ROOM9999");

        room.Players.Add(new PlayerState
        {
            Id = "player-bob",
            DisplayName = "Bob",
            NormalizedDisplayName = displayNameNormalizer.Normalize("Bob"),
            OrderIndex = 1,
            IsActive = true,
        });

        room.Players.Add(new PlayerState
        {
            Id = "player-cara",
            DisplayName = "Cara",
            NormalizedDisplayName = displayNameNormalizer.Normalize("Cara"),
            OrderIndex = 2,
            IsActive = true,
        });

        room.Words.Add(new WordEntry
        {
            Id = "word-1",
            Text = "meteor",
            SubmittedByPlayerId = room.HostPlayerId,
        });

        dbContext.Rooms.Add(room);
        await dbContext.SaveChangesAsync();

        return new SeededRoom(room.RoomId, room.HostPlayerId, ["player-bob", "player-cara"]);
    }

    public async ValueTask DisposeAsync()
    {
        await _factory.DisposeAsync();

        if (File.Exists(_databasePath))
        {
            File.Delete(_databasePath);
        }
    }

    private sealed record SeededRoom(string RoomId, string HostPlayerId, IReadOnlyList<string> GuestPlayerIds);
}
