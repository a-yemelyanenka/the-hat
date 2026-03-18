namespace TheHat.Backend.Domain;

public interface IRoomLobbyService
{
    Task<RoomState> GetRoomAsync(string roomId, CancellationToken cancellationToken = default);

    Task<RoomState> UpdateRoomSettingsAsync(
        string roomId,
        string hostPlayerId,
        RoomSettings settings,
        IReadOnlyList<string>? orderedPlayerIds,
        CancellationToken cancellationToken = default);

    Task<RoomState> StartGameAsync(
        string roomId,
        string hostPlayerId,
        CancellationToken cancellationToken = default);
}