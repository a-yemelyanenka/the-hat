using TheHat.Backend.Domain;

namespace TheHat.Backend.Api;

public interface IRoomRealtimeNotifier
{
    Task PublishRoomUpdatedAsync(RoomState room, CancellationToken cancellationToken = default);
}