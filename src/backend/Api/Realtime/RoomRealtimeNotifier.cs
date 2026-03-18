using Microsoft.AspNetCore.SignalR;
using TheHat.Backend.Domain;

namespace TheHat.Backend.Api;

internal sealed class RoomRealtimeNotifier(IHubContext<RoomHub> hubContext) : IRoomRealtimeNotifier
{
    public Task PublishRoomUpdatedAsync(RoomState room, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(room);

        return hubContext.Clients
            .Group(RoomHub.GetRoomGroupName(room.RoomId))
            .SendAsync(RoomHub.RoomUpdatedMethodName, room.ToDto(), cancellationToken);
    }
}