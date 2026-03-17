namespace TheHat.Backend.Domain;

public interface IRoomCreationService
{
    Task<RoomState> CreateRoomAsync(
        string hostDisplayName,
        RoomSettings settings,
        CancellationToken cancellationToken = default);
}
