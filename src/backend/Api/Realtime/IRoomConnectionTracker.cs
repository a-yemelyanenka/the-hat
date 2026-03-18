namespace TheHat.Backend.Api;

public interface IRoomConnectionTracker
{
    void TrackConnection(string connectionId, string roomId, string? playerId);

    RoomConnectionRegistration? RemoveConnection(string connectionId);

    IReadOnlyList<RoomConnectionRegistration> GetRoomConnections(string roomId);
}

public sealed record RoomConnectionRegistration(string ConnectionId, string RoomId, string? PlayerId);