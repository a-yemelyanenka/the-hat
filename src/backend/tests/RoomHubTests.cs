using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Http.Features;
using TheHat.Backend.Api;
using TheHat.Backend.Contracts;
using TheHat.Backend.Domain;
using Xunit;

namespace TheHat.Backend.Tests;

public sealed class RoomHubTests
{
    [Fact]
    public async Task SubscribeToRoom_AddsConnectionToGroupAndSendsCurrentSnapshot()
    {
        var room = new RoomFactory(new DisplayNameNormalizer()).CreateRoom(
            "Alice",
            new RoomSettings
            {
                WordsPerPlayer = 4,
                TurnDurationSeconds = 75,
                PlayerOrderMode = PlayerOrderMode.Random,
            },
            nowUtc: new DateTime(2026, 3, 18, 10, 0, 0, DateTimeKind.Utc),
            roomId: "room-123",
            hostPlayerId: "player-host",
            inviteCode: "ROOM1234");

        var clientProxy = new RecordingClientProxy();
        var groupManager = new RecordingGroupManager();
        var presenceService = new RecordingRoomPresenceService();
        var notifier = new RecordingRealtimeNotifier();
        var tracker = new RoomConnectionTracker();
        var hub = new RoomHub(new StubRoomLobbyService(room), presenceService, notifier, tracker, new RoomEngine(new DisplayNameNormalizer()))
        {
            Clients = new StubHubCallerClients(clientProxy),
            Context = new StubHubCallerContext("connection-123"),
            Groups = groupManager,
        };

        await hub.SubscribeToRoom(room.RoomId);

        var groupJoin = Assert.Single(groupManager.GroupAdds);
        Assert.Equal("connection-123", groupJoin.ConnectionId);
        Assert.Equal($"room:{room.RoomId}", groupJoin.GroupName);

        var sentMessage = Assert.Single(clientProxy.Messages);
        Assert.Equal(RoomHub.RoomUpdatedMethodName, sentMessage.MethodName);

        var payload = Assert.IsType<RoomSnapshotDto>(Assert.Single(sentMessage.Arguments));
        Assert.Equal(room.RoomId, payload.RoomId);
        Assert.Equal(room.InviteCode, payload.InviteCode);
        Assert.Single(payload.Players);
    }

    [Fact]
    public async Task SubscribeToRoom_WithPlayerId_SendsGameplayViewToCaller()
    {
        var room = CreateStartedRoom();

        var clientProxy = new RecordingClientProxy();
        var hub = new RoomHub(
            new StubRoomLobbyService(room),
            new RecordingRoomPresenceService(),
            new RecordingRealtimeNotifier(),
            new RoomConnectionTracker(),
            new RoomEngine(new DisplayNameNormalizer()))
        {
            Clients = new StubHubCallerClients(clientProxy),
            Context = new StubHubCallerContext("connection-123"),
            Groups = new RecordingGroupManager(),
        };

        await hub.SubscribeToRoom(room.RoomId, room.HostPlayerId);

        var gameplayMessage = Assert.Single(clientProxy.Messages, message => message.MethodName == RoomHub.GameplayUpdatedMethodName);
        var payload = Assert.IsType<GameplayViewDto>(Assert.Single(gameplayMessage.Arguments));
        Assert.True(payload.IsCurrentPlayerExplainer);
        Assert.False(string.IsNullOrWhiteSpace(payload.ActiveWord));
    }

    [Fact]
    public async Task OnDisconnectedAsync_DeactivatesTrackedPlayerAndPublishesRoomUpdate()
    {
        var room = new RoomFactory(new DisplayNameNormalizer()).CreateRoom(
            "Alice",
            new RoomSettings
            {
                WordsPerPlayer = 4,
                TurnDurationSeconds = 75,
                PlayerOrderMode = PlayerOrderMode.Random,
            },
            nowUtc: new DateTime(2026, 3, 18, 10, 0, 0, DateTimeKind.Utc),
            roomId: "room-123",
            hostPlayerId: "player-host",
            inviteCode: "ROOM1234");

        var presenceService = new RecordingRoomPresenceService
        {
            RoomToReturn = room,
        };

        var tracker = new RoomConnectionTracker();
        tracker.TrackConnection("connection-123", room.RoomId, room.HostPlayerId);

        var hub = new RoomHub(new StubRoomLobbyService(room), presenceService, new RecordingRealtimeNotifier(), tracker, new RoomEngine(new DisplayNameNormalizer()))
        {
            Clients = new StubHubCallerClients(new RecordingClientProxy()),
            Context = new StubHubCallerContext("connection-123"),
            Groups = new RecordingGroupManager(),
        };

        await hub.OnDisconnectedAsync(null);

        var disconnectCall = Assert.Single(presenceService.DeactivateCalls);
        Assert.Equal(room.RoomId, disconnectCall.RoomId);
        Assert.Equal(room.HostPlayerId, disconnectCall.PlayerId);
    }

    [Fact]
    public async Task OnDisconnectedAsync_DoesNotDeactivatePlayerWhenAnotherConnectionIsStillTracked()
    {
        var room = new RoomFactory(new DisplayNameNormalizer()).CreateRoom(
            "Alice",
            new RoomSettings
            {
                WordsPerPlayer = 4,
                TurnDurationSeconds = 75,
                PlayerOrderMode = PlayerOrderMode.Random,
            },
            nowUtc: new DateTime(2026, 3, 18, 10, 0, 0, DateTimeKind.Utc),
            roomId: "room-123",
            hostPlayerId: "player-host",
            inviteCode: "ROOM1234");

        var presenceService = new RecordingRoomPresenceService
        {
            RoomToReturn = room,
        };

        var tracker = new RoomConnectionTracker();
        tracker.TrackConnection("connection-123", room.RoomId, room.HostPlayerId);
        tracker.TrackConnection("connection-456", room.RoomId, room.HostPlayerId);

        var hub = new RoomHub(new StubRoomLobbyService(room), presenceService, new RecordingRealtimeNotifier(), tracker, new RoomEngine(new DisplayNameNormalizer()))
        {
            Clients = new StubHubCallerClients(new RecordingClientProxy()),
            Context = new StubHubCallerContext("connection-123"),
            Groups = new RecordingGroupManager(),
        };

        await hub.OnDisconnectedAsync(null);

        Assert.Empty(presenceService.DeactivateCalls);
    }

    private sealed class StubRoomLobbyService(RoomState room) : IRoomLobbyService
    {
        public Task<RoomState> GetRoomAsync(string roomId, CancellationToken cancellationToken = default)
        {
            if (!StringComparer.Ordinal.Equals(room.RoomId, roomId))
            {
                throw new RoomNotFoundException(roomId);
            }

            return Task.FromResult(room);
        }

        public Task<RoomState> UpdateRoomSettingsAsync(
            string roomId,
            string hostPlayerId,
            RoomSettings settings,
            IReadOnlyList<string>? orderedPlayerIds,
            CancellationToken cancellationToken = default) => throw new NotSupportedException();

        public Task<RoomState> StartGameAsync(
            string roomId,
            string hostPlayerId,
            CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }

    private sealed class RecordingRoomPresenceService : IRoomPresenceService
    {
        public List<(string RoomId, string PlayerId)> ReactivateCalls { get; } = [];
        public List<(string RoomId, string PlayerId)> DeactivateCalls { get; } = [];
        public RoomState? RoomToReturn { get; set; }

        public Task<RoomState?> ReactivatePlayerAsync(string roomId, string playerId, CancellationToken cancellationToken = default)
        {
            ReactivateCalls.Add((roomId, playerId));
            return Task.FromResult<RoomState?>(RoomToReturn);
        }

        public Task<RoomState?> DeactivatePlayerAsync(string roomId, string playerId, CancellationToken cancellationToken = default)
        {
            DeactivateCalls.Add((roomId, playerId));
            return Task.FromResult<RoomState?>(RoomToReturn);
        }
    }

    private sealed class RecordingRealtimeNotifier : IRoomRealtimeNotifier
    {
        public List<RoomState> PublishedRooms { get; } = [];

        public Task PublishRoomUpdatedAsync(RoomState room, CancellationToken cancellationToken = default)
        {
            PublishedRooms.Add(room);
            return Task.CompletedTask;
        }
    }

    private static RoomState CreateStartedRoom()
    {
        var normalizer = new DisplayNameNormalizer();
        var room = new RoomFactory(normalizer).CreateRoom(
            "Alice",
            new RoomSettings
            {
                WordsPerPlayer = 1,
                TurnDurationSeconds = 60,
                PlayerOrderMode = PlayerOrderMode.Manual,
            },
            nowUtc: new DateTime(2026, 3, 18, 10, 0, 0, DateTimeKind.Utc),
            roomId: "room-live",
            hostPlayerId: "player-host",
            inviteCode: "LIVE1234");

        room.Players.Add(new PlayerState
        {
            Id = "player-guest",
            DisplayName = "Bob",
            NormalizedDisplayName = normalizer.Normalize("Bob"),
            IsActive = true,
            OrderIndex = 1,
        });

        room.Words.Add(new WordEntry
        {
            Id = "word-1",
            Text = "meteor",
            SubmittedByPlayerId = room.HostPlayerId,
        });

        new RoomEngine(normalizer).StartGame(room, seed: 7, nowUtc: new DateTime(2026, 3, 18, 10, 0, 1, DateTimeKind.Utc));
        return room;
    }

    private sealed class RecordingGroupManager : IGroupManager
    {
        public List<(string ConnectionId, string GroupName)> GroupAdds { get; } = [];
        public List<(string ConnectionId, string GroupName)> GroupRemovals { get; } = [];

        public Task AddToGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default)
        {
            GroupAdds.Add((connectionId, groupName));
            return Task.CompletedTask;
        }

        public Task RemoveFromGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default)
        {
            GroupRemovals.Add((connectionId, groupName));
            return Task.CompletedTask;
        }
    }

    private sealed class RecordingClientProxy : IClientProxy
    {
        public List<(string MethodName, IReadOnlyList<object?> Arguments)> Messages { get; } = [];

        public Task SendCoreAsync(string method, object?[] args, CancellationToken cancellationToken = default)
        {
            Messages.Add((method, args));
            return Task.CompletedTask;
        }
    }

    private sealed class StubHubCallerClients(RecordingClientProxy clientProxy) : IHubCallerClients
    {
        public IClientProxy Caller => clientProxy;
        public IClientProxy All => clientProxy;
        public IClientProxy Others => clientProxy;
        public IClientProxy AllExcept(IReadOnlyList<string> excludedConnectionIds) => clientProxy;
        public IClientProxy Client(string connectionId) => clientProxy;
        public IClientProxy Clients(IReadOnlyList<string> connectionIds) => clientProxy;
        public IClientProxy Group(string groupName) => clientProxy;
        public IClientProxy GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds) => clientProxy;
        public IClientProxy Groups(IReadOnlyList<string> groupNames) => clientProxy;
        public IClientProxy OthersInGroup(string groupName) => clientProxy;
        public IClientProxy User(string userId) => clientProxy;
        public IClientProxy Users(IReadOnlyList<string> userIds) => clientProxy;
    }

    private sealed class StubHubCallerContext(string connectionId) : HubCallerContext
    {
        private readonly Dictionary<object, object?> _items = [];

        public override string ConnectionId { get; } = connectionId;

        public override string? UserIdentifier => null;

        public override ClaimsPrincipal? User => null;

        public override IDictionary<object, object?> Items => _items;

        public override IFeatureCollection Features { get; } = new FeatureCollection();

        public override CancellationToken ConnectionAborted => CancellationToken.None;

        public override void Abort()
        {
        }
    }
}