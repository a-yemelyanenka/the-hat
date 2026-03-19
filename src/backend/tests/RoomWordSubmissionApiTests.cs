using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using TheHat.Backend.Contracts;
using TheHat.Backend.Domain;
using TheHat.Backend.Persistence;
using Xunit;

namespace TheHat.Backend.Tests;

public sealed class RoomWordSubmissionApiTests : IAsyncDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"the-hat-word-api-tests-{Guid.NewGuid():N}.db");
    private readonly WebApplicationFactory<Program> _factory;

    public RoomWordSubmissionApiTests()
    {
        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseSetting(WebHostDefaults.EnvironmentKey, Environments.Development);
                builder.UseSetting("ConnectionStrings:TheHat", $"Data Source={_databasePath}");
            });
    }

    [Fact]
    public async Task GetPlayerWords_ReturnsOnlyRequestedPlayersWords()
    {
        var seededRoom = await SeedRoomAsync();

        using var client = _factory.CreateClient();

        var response = await client.GetAsync($"/api/rooms/{seededRoom.RoomId}/players/{seededRoom.HostPlayerId}/words");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<PlayerWordSubmissionDto>(JsonOptions);
        Assert.NotNull(payload);
        Assert.Equal(seededRoom.HostPlayerId, payload!.PlayerId);
        Assert.Equal(2, payload.RequiredCount);
        Assert.Equal(["meteor"], payload.Words.Select(word => word.Text).ToArray());
    }

    [Fact]
    public async Task SubmitWords_UpdatesLobbyProgressAndKeepsRoomSnapshotSanitized()
    {
        var seededRoom = await SeedRoomAsync();

        using var client = _factory.CreateClient();

        var response = await client.PutAsJsonAsync($"/api/rooms/{seededRoom.RoomId}/words", new SubmitWordsRequestDto(
            seededRoom.HostPlayerId,
            [" echo ", "echo"]));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<RoomSnapshotDto>(JsonOptions);
        Assert.NotNull(payload);
        Assert.Empty(payload!.Words);

        var hostProgress = payload.SubmissionProgress.Single(progress => progress.PlayerId == seededRoom.HostPlayerId);
        Assert.True(hostProgress.IsComplete);
        Assert.Equal(2, hostProgress.SubmittedCount);

        await using var scope = _factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<TheHatDbContext>();
        var persistedRoom = await dbContext.Rooms.SingleAsync(room => room.RoomId == seededRoom.RoomId);
        Assert.Equal(2, persistedRoom.Words.Count(word => word.SubmittedByPlayerId == seededRoom.HostPlayerId));
        Assert.Equal(2, persistedRoom.Words.Count(word => word.SubmittedByPlayerId == seededRoom.HostPlayerId && word.Text == "echo"));
    }

    [Fact]
    public async Task GetPlayerWords_ReturnsBadRequestAfterGameStarts()
    {
        var seededRoom = await SeedStartedRoomAsync();

        using var client = _factory.CreateClient();

        var response = await client.GetAsync($"/api/rooms/{seededRoom.RoomId}/players/{seededRoom.HostPlayerId}/words");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<LocalizedValidationProblemDetails>(JsonOptions);
        Assert.NotNull(payload);
        Assert.Contains("Words can only be viewed or edited before the game starts.", payload!.Errors![nameof(RoomState.Phase)]);
        Assert.True(payload.MessageErrors?.ContainsKey(nameof(RoomState.Phase)));
        Assert.Contains(payload.MessageErrors![nameof(RoomState.Phase)], message => message.Key == "backend.wordSubmission.lobbyOnly");
    }

    private async Task<SeededRoom> SeedRoomAsync()
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<TheHatDbContext>();
        await dbContext.Database.EnsureCreatedAsync();

        var room = CreateRoom();
        dbContext.Rooms.Add(room);
        await dbContext.SaveChangesAsync();

        return new SeededRoom(room.RoomId, room.HostPlayerId);
    }

    private async Task<SeededRoom> SeedStartedRoomAsync()
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<TheHatDbContext>();
        await dbContext.Database.EnsureCreatedAsync();

        var room = CreateRoom();
        room.Words.Add(new WordEntry
        {
            Id = "word-4",
            Text = "canyon",
            SubmittedByPlayerId = room.HostPlayerId,
        });
        new RoomEngine(new DisplayNameNormalizer()).StartGame(room, seed: 4, nowUtc: new DateTime(2026, 3, 18, 12, 0, 30, DateTimeKind.Utc));
        dbContext.Rooms.Add(room);
        await dbContext.SaveChangesAsync();

        return new SeededRoom(room.RoomId, room.HostPlayerId);
    }

    private static RoomState CreateRoom()
    {
        var normalizer = new DisplayNameNormalizer();
        var room = new RoomFactory(normalizer).CreateRoom(
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
            inviteCode: "WORDS999");

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

        room.Words.Add(new WordEntry
        {
            Id = "word-2",
            Text = "forest",
            SubmittedByPlayerId = "player-guest",
        });

        room.Words.Add(new WordEntry
        {
            Id = "word-3",
            Text = "harbor",
            SubmittedByPlayerId = "player-guest",
        });

        return room;
    }

    public async ValueTask DisposeAsync()
    {
        await _factory.DisposeAsync();

        if (File.Exists(_databasePath))
        {
            File.Delete(_databasePath);
        }
    }

    private sealed record SeededRoom(string RoomId, string HostPlayerId);
}