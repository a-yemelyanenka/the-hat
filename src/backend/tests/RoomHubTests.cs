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
        var hub = new RoomHub(new StubRoomLobbyService(room))
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