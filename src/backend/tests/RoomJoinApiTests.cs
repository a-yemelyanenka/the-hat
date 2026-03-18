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

public sealed class RoomJoinApiTests : IAsyncDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"the-hat-join-api-tests-{Guid.NewGuid():N}.db");
    private readonly WebApplicationFactory<Program> _factory;

    public RoomJoinApiTests()
    {
        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseSetting(WebHostDefaults.EnvironmentKey, Environments.Development);
                builder.UseSetting("ConnectionStrings:TheHat", $"Data Source={_databasePath}");
            });
    }

    [Fact]
    public async Task JoinRoom_AddsPlayerAndReturnsUpdatedLobbySnapshot()
    {
        await SeedRoomAsync();

        using var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/rooms/invite/ROOM1234/join", new JoinRoomRequestDto("  Bob  "));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<RoomSnapshotDto>(JsonOptions);
        Assert.NotNull(payload);
        Assert.Equal("ROOM1234", payload!.InviteCode);
        Assert.Equal(2, payload.Players.Count);
        Assert.Contains(payload.Players, player => player.IsHost && player.DisplayName == "Alice");
        Assert.Contains(payload.Players, player => !player.IsHost && player.DisplayName == "Bob");

        await using var scope = _factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<TheHatDbContext>();
        var persistedRoom = await dbContext.Rooms.AsNoTracking().SingleAsync();

        Assert.Equal(2, persistedRoom.Players.Count);
    }

    [Fact]
    public async Task JoinRoom_ReturnsBadRequestForAmbiguousDuplicateDisplayName()
    {
        await SeedRoomAsync();

        using var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/rooms/invite/ROOM1234/join", new JoinRoomRequestDto(" alice "));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private async Task SeedRoomAsync()
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<TheHatDbContext>();
        await dbContext.Database.EnsureCreatedAsync();

        if (await dbContext.Rooms.AnyAsync())
        {
            return;
        }

        var room = new RoomFactory(new DisplayNameNormalizer()).CreateRoom(
            "Alice",
            new RoomSettings
            {
                WordsPerPlayer = 4,
                TurnDurationSeconds = 75,
                PlayerOrderMode = PlayerOrderMode.Random,
            },
            nowUtc: DateTime.UtcNow,
            inviteCode: "ROOM1234");

        dbContext.Rooms.Add(room);
        await dbContext.SaveChangesAsync();
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