namespace TheHat.Backend.Domain;

public interface IRoomPresenceService
{
    Task<RoomState?> ReactivatePlayerAsync(
        string roomId,
        string playerId,
        CancellationToken cancellationToken = default);

    Task<RoomState?> DeactivatePlayerAsync(
        string roomId,
        string playerId,
        CancellationToken cancellationToken = default);
}