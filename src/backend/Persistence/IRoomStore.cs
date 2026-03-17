using TheHat.Backend.Domain;

namespace TheHat.Backend.Persistence;

public interface IRoomStore
{
    Task SaveAsync(RoomState room, CancellationToken cancellationToken = default);

    Task<RoomState?> LoadAsync(string roomId, CancellationToken cancellationToken = default);

    Task<RoomState?> LoadByInviteCodeAsync(string inviteCode, CancellationToken cancellationToken = default);
}
