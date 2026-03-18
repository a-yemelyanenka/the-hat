using Microsoft.AspNetCore.SignalR;
using TheHat.Backend.Domain;

namespace TheHat.Backend.Api;

internal sealed class RoomRealtimeNotifier(
    IHubContext<RoomHub> hubContext,
    IRoomConnectionTracker roomConnectionTracker,
    IRoomEngine roomEngine) : IRoomRealtimeNotifier
{
    public async Task PublishRoomUpdatedAsync(RoomState room, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(room);

        await hubContext.Clients
            .Group(RoomHub.GetRoomGroupName(room.RoomId))
            .SendAsync(RoomHub.RoomUpdatedMethodName, room.ToDto(), cancellationToken);

        var gameplayRecipients = roomConnectionTracker
            .GetRoomConnections(room.RoomId)
            .Where(registration => !string.IsNullOrWhiteSpace(registration.PlayerId))
            .ToList();

        foreach (var registration in gameplayRecipients)
        {
            try
            {
                var gameplayState = roomEngine.CreateGameplayState(room, registration.PlayerId!);
                await hubContext.Clients
                    .Client(registration.ConnectionId)
                    .SendAsync(RoomHub.GameplayUpdatedMethodName, gameplayState.ToDto(), cancellationToken);
            }
            catch (DomainValidationException)
            {
            }
        }
    }
}