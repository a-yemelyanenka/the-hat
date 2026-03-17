namespace TheHat.Backend.Domain;

public interface IRoomFactory
{
    void ValidateCreateRoom(string hostDisplayName, RoomSettings settings);

    RoomState CreateRoom(
        string hostDisplayName,
        RoomSettings settings,
        DateTime? nowUtc = null,
        string? roomId = null,
        string? hostPlayerId = null,
        string? inviteCode = null);
}
