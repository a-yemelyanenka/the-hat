using System.Collections.Concurrent;

namespace TheHat.Backend.Api;

public sealed class RoomConnectionTracker : IRoomConnectionTracker
{
    private readonly ConcurrentDictionary<string, RoomConnectionRegistration> _connections = new(StringComparer.Ordinal);

    public void TrackConnection(string connectionId, string roomId, string? playerId)
    {
        _connections[connectionId] = new RoomConnectionRegistration(connectionId, roomId, string.IsNullOrWhiteSpace(playerId) ? null : playerId.Trim());
    }

    public RoomConnectionRegistration? RemoveConnection(string connectionId)
    {
        return _connections.TryRemove(connectionId, out var registration)
            ? registration
            : null;
    }
}