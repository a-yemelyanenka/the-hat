using Microsoft.AspNetCore.SignalR;
using TheHat.Backend.Domain;

namespace TheHat.Backend.Api;

public sealed class RoomHub(
    IRoomLobbyService roomLobbyService,
    IRoomPresenceService roomPresenceService,
    IRoomRealtimeNotifier roomRealtimeNotifier,
    IRoomConnectionTracker roomConnectionTracker) : Hub
{
    public const string RoomUpdatedMethodName = "roomUpdated";

    public async Task SubscribeToRoom(string roomId, string? playerId = null)
    {
        if (string.IsNullOrWhiteSpace(roomId))
        {
            throw new HubException("A room id is required.");
        }

        var normalizedRoomId = roomId.Trim();
        var groupName = GetRoomGroupName(normalizedRoomId);

        await Groups.AddToGroupAsync(Context.ConnectionId, groupName, Context.ConnectionAborted);
        roomConnectionTracker.TrackConnection(Context.ConnectionId, normalizedRoomId, playerId);

        try
        {
            var room = await roomLobbyService.GetRoomAsync(normalizedRoomId, Context.ConnectionAborted);

            if (!string.IsNullOrWhiteSpace(playerId))
            {
                try
                {
                    var reactivatedRoom = await roomPresenceService.ReactivatePlayerAsync(normalizedRoomId, playerId, Context.ConnectionAborted);
                    if (reactivatedRoom is not null)
                    {
                        room = reactivatedRoom;
                        await roomRealtimeNotifier.PublishRoomUpdatedAsync(room, Context.ConnectionAborted);
                    }
                }
                catch (DomainValidationException)
                {
                }
            }

            await Clients.Caller.SendAsync(RoomUpdatedMethodName, room.ToDto(), Context.ConnectionAborted);
        }
        catch (RoomNotFoundException)
        {
            roomConnectionTracker.RemoveConnection(Context.ConnectionId);
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName, Context.ConnectionAborted);
            throw new HubException("The requested room could not be found.");
        }
    }

    public Task UnsubscribeFromRoom(string roomId)
    {
        if (string.IsNullOrWhiteSpace(roomId))
        {
            return Task.CompletedTask;
        }

        roomConnectionTracker.RemoveConnection(Context.ConnectionId);
        return Groups.RemoveFromGroupAsync(Context.ConnectionId, GetRoomGroupName(roomId.Trim()), Context.ConnectionAborted);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var registration = roomConnectionTracker.RemoveConnection(Context.ConnectionId);

        if (registration is not null)
        {
            try
            {
                if (!string.IsNullOrWhiteSpace(registration.PlayerId))
                {
                    var room = await roomPresenceService.DeactivatePlayerAsync(registration.RoomId, registration.PlayerId, CancellationToken.None);
                    if (room is not null)
                    {
                        await roomRealtimeNotifier.PublishRoomUpdatedAsync(room, CancellationToken.None);
                    }
                }
            }
            catch (RoomNotFoundException)
            {
            }
            catch (DomainValidationException)
            {
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    internal static string GetRoomGroupName(string roomId) => $"room:{roomId}";
}