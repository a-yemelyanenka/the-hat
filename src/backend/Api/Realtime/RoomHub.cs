using Microsoft.AspNetCore.SignalR;
using TheHat.Backend.Domain;

namespace TheHat.Backend.Api;

public sealed class RoomHub(IRoomLobbyService roomLobbyService) : Hub
{
    public const string RoomUpdatedMethodName = "roomUpdated";

    public async Task SubscribeToRoom(string roomId)
    {
        if (string.IsNullOrWhiteSpace(roomId))
        {
            throw new HubException("A room id is required.");
        }

        var normalizedRoomId = roomId.Trim();
        var groupName = GetRoomGroupName(normalizedRoomId);

        await Groups.AddToGroupAsync(Context.ConnectionId, groupName, Context.ConnectionAborted);

        try
        {
            var room = await roomLobbyService.GetRoomAsync(normalizedRoomId, Context.ConnectionAborted);
            await Clients.Caller.SendAsync(RoomUpdatedMethodName, room.ToDto(), Context.ConnectionAborted);
        }
        catch (RoomNotFoundException)
        {
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

        return Groups.RemoveFromGroupAsync(Context.ConnectionId, GetRoomGroupName(roomId.Trim()), Context.ConnectionAborted);
    }

    internal static string GetRoomGroupName(string roomId) => $"room:{roomId}";
}