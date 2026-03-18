namespace TheHat.Backend.Domain;

public interface IRoomJoinService
{
    Task<RoomState> JoinRoomAsync(
        string inviteCode,
        string displayName,
        CancellationToken cancellationToken = default);
}