using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.AspNetCore.Hosting;
using TheHat.Backend.Contracts;
using TheHat.Backend.Domain;
using TheHat.Backend.Persistence;
using Xunit;

namespace TheHat.Backend.Tests;

public sealed class RoomCreationApiTests : IAsyncDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"the-hat-api-tests-{Guid.NewGuid():N}.db");
    private readonly WebApplicationFactory<Program> _factory;

    public RoomCreationApiTests()
    {
        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseSetting(WebHostDefaults.EnvironmentKey, Environments.Development);
                builder.UseSetting("ConnectionStrings:TheHat", $"Data Source={_databasePath}");
            });
    }

    [Fact]
    public async Task CreateRoom_CreatesLobbyRoomWithHostAndInviteLink()
    {
        using var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("http://localhost"),
        });

        var request = JsonContent.Create(new
        {
            hostDisplayName = "  Alice  ",
            settings = new
            {
                wordsPerPlayer = 3,
                turnDurationSeconds = 75,
                playerOrderMode = "manual",
            },
        });

        var response = await client.PostAsync("/api/rooms", request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<CreateRoomResponseDto>(JsonOptions);
        Assert.NotNull(payload);
        Assert.False(string.IsNullOrWhiteSpace(payload!.Room.RoomId));
        Assert.False(string.IsNullOrWhiteSpace(payload.Room.HostPlayerId));
        Assert.Equal(payload.Room.InviteCode, payload.Room.InviteCode.ToUpperInvariant());
        Assert.Equal($"http://localhost/join/{payload.Room.InviteCode}", payload.InviteLink);
        Assert.Equal(RoomPhase.Lobby, payload.Room.Phase);
        Assert.Null(payload.Room.CurrentRoundNumber);
        Assert.Null(payload.Room.CurrentTurn);
        Assert.Empty(payload.Room.Words);
        Assert.Empty(payload.Room.Rounds);
        Assert.Single(payload.Room.Players);

        var host = payload.Room.Players[0];
        Assert.Equal(payload.Room.HostPlayerId, host.PlayerId);
        Assert.Equal("Alice", host.DisplayName);
        Assert.True(host.IsHost);
        Assert.True(host.IsActive);
        Assert.Equal(0, host.OrderIndex);
        Assert.Equal(0, host.Score);
        Assert.Equal(3, payload.Room.Settings.WordsPerPlayer);
        Assert.Equal(75, payload.Room.Settings.TurnDurationSeconds);
        Assert.Equal(PlayerOrderMode.Manual, payload.Room.Settings.PlayerOrderMode);

        await using var scope = _factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<TheHatDbContext>();
        var displayNameNormalizer = scope.ServiceProvider.GetRequiredService<IDisplayNameNormalizer>();
        var persistedRoom = await dbContext.Rooms.AsNoTracking().SingleAsync();

        Assert.Equal(payload.Room.RoomId, persistedRoom.RoomId);
        Assert.Equal(payload.Room.InviteCode, persistedRoom.InviteCode);
        Assert.Equal(payload.Room.HostPlayerId, persistedRoom.HostPlayerId);
        Assert.Equal(displayNameNormalizer.Normalize("Alice"), persistedRoom.Players.Single().NormalizedDisplayName);
        Assert.Equal(PlayerOrderMode.Manual, persistedRoom.Settings.PlayerOrderMode);
    }

    [Fact]
    public async Task CreateRoom_ReturnsBadRequestForInvalidSettings()
    {
        using var client = _factory.CreateClient();

        var request = JsonContent.Create(new
        {
            hostDisplayName = "   ",
            settings = new
            {
                wordsPerPlayer = 0,
                turnDurationSeconds = 0,
                playerOrderMode = "random",
            },
        });

        var response = await client.PostAsync("/api/rooms", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    public async ValueTask DisposeAsync()
    {
        await _factory.DisposeAsync();

        if (File.Exists(_databasePath))
        {
            File.Delete(_databasePath);
        }
    }
}